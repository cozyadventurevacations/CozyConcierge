import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const resolve = (name) => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/") ? load(path.join("lib", name.slice(6)) + ".ts", mocks) : require(name);
  new Function("require", "module", "exports", code)(resolve, loaded, loaded.exports);
  return loaded.exports;
}
const helpers = load("lib/payment-links.ts");
const signedLink = "https://payments.example.com/Checkout/AbC%2fD?signature=x%2By%2Fz%3D&return=keep#token";
test("host paylinks retain signed URLs and reject executable, insecure and ambiguous destinations", () => {
  assert.equal(helpers.normalizeHostPaylink(`  ${signedLink}  `), signedLink);
  for (const value of ["javascript:alert(1)", "data:text/html,test", "http://payments.example.com", "//payments.example.com",
    "https://trusted.example.com@evil.example.com", "https://name:secret@example.com", "https://localhost/pay", "https://127.0.0.1/pay",
    "https://2130706433/pay", "https://[::1]/pay", "https://host.internal/pay", "https://host.local/pay", "https://host.test/pay",
    "https://payments.example.com/\ncheckout", "https://payments.example.com/has space", "https://payments.example.com\\@evil.example.com", "", "https://example.com/" + "a".repeat(8192)]) {
    assert.throws(() => helpers.normalizeHostPaylink(value), undefined, value);
  }
});
test("only shared active requests expose a paylink; payment amounts and dates must be valid", () => {
  const row = { id: "request", payment_link_url: signedLink, requested_amount: 100, requested_payment_date: "2030-05-01" };
  assert.equal(helpers.availableHostPaylink({ ...row, status: "sent" }), signedLink);
  for (const status of ["new", "completed", "cancelled", "declined", "archived", null]) assert.equal(helpers.availableHostPaylink({ ...row, status }), null);
  assert.equal(helpers.availableHostPaylink({ ...row, status: "sent", payment_link_url: "javascript:alert(1)" }), null);
  assert.equal(helpers.validateHostPaylinkDetails("100.25", "2028-02-29").requested_amount, 100.25);
  for (const [amount, date] of [["0", "2030-05-01"], ["-1", "2030-05-01"], ["Infinity", "2030-05-01"], ["1.001", "2030-05-01"], ["100", "2030-02-30"], ["100", "bad"]]) assert.throws(() => helpers.validateHostPaylinkDetails(amount, date));
});

function fixture({ authorized = true } = {}) {
  const tripId = "11111111-1111-4111-8111-111111111111";
  const requestId = "22222222-2222-4222-8222-222222222222";
  const tables = { trips: [{ id: tripId, client_account_id: "actual-owner", deleted_at: null }], payment_requests: [] };
  let authCalls = 0, writes = 0;
  const supabase = { from(table) {
    assert(Object.hasOwn(tables, table), `Paylink sharing must not touch ${table}`);
    let operation, payload, filters = [];
    const query = {
      select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      async single() {
        if (operation === "insert") { const row = { id: requestId, ...payload }; tables[table].push(row); writes++; return { data: row }; }
        const row = tables[table].find(item => filters.every(([key, value]) => item[key] === value));
        if (!row) return { data: null, error: { message: "not found" } };
        if (operation === "update") { Object.assign(row, payload); writes++; }
        return { data: { ...row } };
      },
    };
    return query;
  } };
  const actions = load("lib/payment-links/actions.ts", {
    "@/lib/payment-links": helpers,
    "@/lib/auth/require-admin": { requireAdmin: async () => { authCalls++; if (!authorized) throw Error("ADMIN_REQUIRED"); return { supabase }; } },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(location) { throw Object.assign(Error("REDIRECT"), { location }); } },
  });
  const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
  return { actions, tables, tripId, requestId, form, get authCalls() { return authCalls; }, get writes() { return writes; } };
}
test("sharing uses the trip owner and never creates a payment or accepts a forged client ID", async () => {
  const f = fixture();
  await assert.rejects(f.actions.saveHostPaylink({}, f.form({ trip_id: f.tripId, client_account_id: "forged-owner", payment_link_url: signedLink, requested_amount: "250.50", requested_payment_date: "2030-05-01" })), error => error.location === `/admin/payment-requests/${f.requestId}?paylink=saved`);
  assert.equal(f.authCalls, 1); assert.equal(f.tables.payment_requests[0].client_account_id, "actual-owner");
  assert.equal(f.tables.payment_requests[0].status, "sent"); assert.equal(f.tables.payment_requests[0].requested_amount, 250.5);
  const invalid = await f.actions.saveHostPaylink({}, f.form({ trip_id: f.tripId, payment_link_url: "javascript:alert(1)" }));
  assert(invalid.error); assert.equal(f.writes, 1);
});
test("replacing or removing a link preserves payment amounts and completed requests cannot be reshared", async () => {
  const f = fixture();
  const row = { id: f.requestId, trip_id: f.tripId, status: "new", requested_amount: 500, completed_at: null };
  f.tables.payment_requests.push(row);
  await assert.rejects(f.actions.saveHostPaylink({}, f.form({ request_id: f.requestId, payment_link_url: signedLink, requested_amount: "1" })), /REDIRECT/);
  assert.equal(row.requested_amount, 500); assert.equal(row.status, "sent"); assert.equal(row.completed_at, null);
  await assert.rejects(f.actions.removeHostPaylink({}, f.form({ request_id: f.requestId })), /REDIRECT/);
  assert.equal(row.payment_link_url, null); assert.equal(row.status, "new");
  row.status = "completed";
  assert((await f.actions.saveHostPaylink({}, f.form({ request_id: f.requestId, payment_link_url: signedLink }))).error);
  assert.equal(row.status, "completed"); assert.equal(row.requested_amount, 500);
});
test("both mutations require verified admin access before validating or changing anything", async () => {
  const f = fixture({ authorized: false });
  for (const action of [f.actions.saveHostPaylink, f.actions.removeHostPaylink]) await assert.rejects(action({}, new FormData()), /ADMIN_REQUIRED/);
  assert.equal(f.authCalls, 2); assert.equal(f.writes, 0);
});
