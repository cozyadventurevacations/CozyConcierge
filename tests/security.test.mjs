import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { NextRequest } from "next/server.js";
import { parse } from "csv-parse/sync";

const require = createRequire(import.meta.url);
const root = process.cwd();
function load(file, mocks = {}, cache = new Map()) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const loaded = { exports: {} }; cache.set(full, loaded);
  const code = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const resolve = (name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts", mocks, cache);
    return require(name);
  };
  new Function("require", "module", "exports", code)(resolve, loaded, loaded.exports);
  return loaded.exports;
}
function authClient({ user = { id: "test-uid" }, role = "client", aal = "aal1" } = {}) {
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }) },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role } : null }) }) }) }),
  };
  return client;
}
const request = (body) => new Request("https://example.test/api/register-client", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const registrationProfile = {
  first_name: "Test", last_name: "Traveler", date_of_birth: "1990-04-12",
  phone_primary: "+1 (555) 123-4567", address_line_1: "123 Test St", city: "Chicago", state: "IL", postal_code: "60601",
};
test("registration validates required profile fields, real dates and phones and allows only personal metadata", () => {
  const { validateRegistrationProfile } = load("lib/registration-profile.ts");
  for (const name of Object.keys(registrationProfile)) {
    assert(validateRegistrationProfile({ ...registrationProfile, [name]: "  " }).error, `${name} must be required`);
  }
  for (const date_of_birth of ["1990-02-30", "2025-02-29", "not-a-date", "2999-01-01"]) {
    assert(validateRegistrationProfile({ ...registrationProfile, date_of_birth }).error);
  }
  for (const phone_primary of ["abcdefg", "123", "1".repeat(16)]) {
    assert(validateRegistrationProfile({ ...registrationProfile, phone_primary }).error);
  }
  assert(validateRegistrationProfile({ ...registrationProfile, notes: "x".repeat(2001) }).error);
  assert(validateRegistrationProfile({ ...registrationProfile, notify_trip_updates: "false" }).error);
  const { profile, error } = validateRegistrationProfile({ ...registrationProfile, middle_name: " Middle ", notes: "Morning flights",
    anniversary_date: "2000-02-29", food_allergies: "Peanuts\nDairy", notify_trip_updates: false,
    role: "admin", user_profile_id: "forged", passport_number: "ignore-me", email: "forged@example.test" });
  assert.equal(error, undefined);
  assert.equal(profile.middle_name, "Middle"); assert.equal(profile.notes, "Morning flights");
  assert.equal(profile.food_allergies, "Other / Notes: Peanuts; Dairy");
  assert.equal(profile.notify_trip_updates, false); assert.equal(profile.notify_new_messages, true);
  for (const key of ["role", "user_profile_id", "passport_number", "email"]) assert.equal(profile[key], undefined);
});
test("redirect paths cannot escape to another origin", () => {
  const { safeNextPath } = load("lib/security/paths.ts");
  for (const value of ["//evil.test", "/\n/evil.test", "/\t/evil.test", "/\\evil.test", "\\evil.test", "https://evil.test", null, ""]) {
    assert.equal(new URL(safeNextPath(value), "https://example.test").origin, "https://example.test");
  }
  assert.equal(safeNextPath("/admin/trips?page=2"), "/admin/trips?page=2");
});
test("uploads reject forged MIME, executable contents, empty and oversized documents", async () => {
  const { validateDocumentUpload } = load("lib/security/uploads.ts");
  assert.equal(await validateDocumentUpload(new File(["%PDF-1.7\nexample"], "trip.pdf", { type: "application/pdf" })), "application/pdf");
  assert.equal(await validateDocumentUpload(new File([Uint8Array.from([255,216,255,0])], "photo.jpg", { type: "image/jpeg" })), "image/jpeg");
  for (const file of [
    new File(["<script>bad</script>"], "passport.pdf", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "photo.jpg", { type: "image/jpeg" }),
    new File([], "blank.pdf", { type: "application/pdf" }),
    new File([new Uint8Array(15*1024*1024+1)], "large.pdf", { type: "application/pdf" }),
    new File(["PK\u0003\u0004not-a-word-document"], "fake.docx"),
  ]) await assert.rejects(validateDocumentUpload(file));
});
test("paid APIs reject anonymous callers and admins without MFA before consuming quota", async () => {
  for (const [settings, status] of [[{user:null},401],[{role:"admin"},403],[{role:null},403]]) {
    let calls = 0;
    const { protectPaidEndpoint } = load("lib/security/request-limits.ts", {
      "@/lib/supabase/server": { createServerSupabaseClient: async () => authClient(settings) },
      "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: () => { calls++; throw Error("unexpected"); } }) },
    });
    assert.equal((await protectPaidEndpoint(request({}), "places")).status, status);
    assert.equal(calls, 0);
  }
});
test("paid quota stops provider access; storage failures fail closed", async () => {
  for (const [result,status] of [[{data:{allowed:false,retry_after:30}},429],[{error:Error("offline")},503]]) {
    const { protectPaidEndpoint } = load("lib/security/request-limits.ts", {
      "@/lib/supabase/server": { createServerSupabaseClient: async () => authClient() },
      "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: async () => result }) },
    });
    const response=await protectPaidEndpoint(request({}),"places");
    assert.equal(response.status,status);
    if(status===429)assert.equal(response.headers.get("Retry-After"),"30");
  }
});
test("MFA verified admins consume account and global quotas using hashed actor keys", async () => {
  const calls=[];
  const { protectPaidEndpoint } = load("lib/security/request-limits.ts", {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => authClient({role:"admin",aal:"aal2"}) },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: async (name,args) => {calls.push(args);return {data:{allowed:true,retry_after:1}};} }) },
  });
  assert.equal(await protectPaidEndpoint(request({}),"places"),null);
  assert.equal(calls.length,3);
  calls.forEach(args=>assert.match(args.p_key,/^[a-f0-9]{64}$/));
});
test("registration requires CAPTCHA and emails an unconfirmed signup; it never pre-links client records", async () => {
  process.env.TURNSTILE_SECRET_KEY="test-only";
  const originalFetch=global.fetch;
  let captchaValid=false, generated=0, mailed=0;
  global.fetch=async ()=>Response.json({success:captchaValid});
  try {
    const { POST }=load("app/api/register-client/route.ts",{
      "@/lib/security/request-limits": {protectPublicRequest:async()=>null,requestIp:()=>"unknown"},
      "@/lib/supabase/admin":{createSupabaseAdminClient:()=>({
        auth:{admin:{generateLink:async args=>{
          assert.equal(args.type,"signup"); assert.equal(args.password,"Strong!123");
          assert.equal(args.email,"traveler@example.test");
          assert.equal(args.options.data.role,undefined);
          assert.equal(args.options.data.date_of_birth,registrationProfile.date_of_birth);
          assert.equal(args.options.data.address_line_1,registrationProfile.address_line_1);
          assert.equal(args.options.data.notify_trip_updates,false);
          assert.equal(args.options.data.passport_number,undefined);
          generated++;return {data:{user:{email_confirmed_at:null},properties:{hashed_token:"test-hash"}}};
        }}},
        from:()=>{throw Error("No records should be linked before email verification");},
      })},
      "@/lib/email/confirm-registration":{sendRegistrationConfirmation:async(email,hash)=>{
        assert.equal(email,"traveler@example.test");assert.equal(hash,"test-hash");mailed++;
      }},
    });
    const body={profile:{...registrationProfile,notify_trip_updates:false,role:"admin",passport_number:"ignored"},email:"traveler@example.test",password:"Strong!123",captchaToken:"test"};
    assert.equal((await POST(request(body))).status,400);
    assert.equal(generated,0);assert.equal(mailed,0);
    captchaValid=true;
    for (const name of Object.keys(registrationProfile)) {
      assert.equal((await POST(request({...body,profile:{...body.profile,[name]:""}}))).status,400);
    }
    assert.equal(generated,0);assert.equal(mailed,0);
    const response=await POST(request(body));
    assert.equal(response.status,200);assert.equal((await response.json()).requiresEmailConfirmation,true);
    assert.equal(generated,1);assert.equal(mailed,1);
  } finally {global.fetch=originalFetch;delete process.env.TURNSTILE_SECRET_KEY;}
});
test("callback links accounts only after a successful OTP exchange", async () => {
  let verified=false, linked=0;
  const {GET}=load("app/auth/callback/route.ts",{
    "@/lib/supabase/server":{createServerSupabaseClient:async()=>({
      auth:{verifyOtp:async()=>({error:verified?null:Error("expired")}),getUser:async()=>({data:{user:{id:"test-uid",email_confirmed_at:"now"}}})},
    })},
    "@/lib/supabase/admin":{createSupabaseAdminClient:()=>({rpc:async(name,args)=>{
      assert.equal(name,"complete_client_registration");assert.equal(args.p_auth_user_id,"test-uid");linked++;return {error:null};
    }})},
  });
  const url="https://example.test/auth/callback?token_hash=test&type=signup&next="+encodeURIComponent("/\\evil.test");
  assert.match((await GET(new Request(url))).headers.get("location"),/^https:\/\/example.test\/login/);
  assert.equal(linked,0);verified=true;
  const response=await GET(new Request(url));
  assert.equal(response.headers.get("location"),"https://example.test/dashboard");assert.equal(linked,1);
  assert.equal(response.headers.get("Referrer-Policy"),"no-referrer");
});
test("middleware allows only the exact protected cron route and enforces MFA for admin APIs including dotted paths",async()=>{
  let settings={role:"admin",aal:"aal1"};
  const {middleware}=load("middleware.ts",{"@supabase/ssr":{createServerClient:()=>authClient(settings)}});
  const cron=await middleware(new NextRequest("https://example.test/api/admin/check-booking-windows"));
  assert.equal(cron.headers.get("x-middleware-next"),"1");
  assert.equal((await middleware(new NextRequest("https://example.test/api/admin/check-booking-windows/extra"))).status,403);
  assert.equal((await middleware(new NextRequest("https://example.test/api/admin/export.csv"))).status,403);
  settings={role:"client"};
  assert.equal((await middleware(new NextRequest("https://example.test/api/admin/clients/mailing-export"))).status,403);
  settings={role:"admin",aal:"aal2"};
  assert.equal((await middleware(new NextRequest("https://example.test/api/admin/clients/mailing-export"))).headers.get("x-middleware-next"),"1");
});
test("CSV major upgrade preserves airport/airline parsing and handles prototype column names safely",()=>{
  assert.deepEqual(parse('iata_code,name\nORD,"Chicago, O\'Hare"\n',{columns:true,skip_empty_lines:true}),[{iata_code:"ORD",name:"Chicago, O'Hare"}]);
  assert.deepEqual(parse('1,"Cozy Airlines",\\N,CA,"COZY",United States,Y\n',{relax_quotes:true,skip_empty_lines:true})[0].slice(0,4),["1","Cozy Airlines","\\N","CA"]);
  const row=parse('__proto__,name\nmalicious,Airport\n',{columns:true})[0];
  assert.equal(Object.getPrototypeOf(row),Object.prototype);
  assert.equal(row.name,"Airport");assert.equal({}.malicious,undefined);
});
