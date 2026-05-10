const fs = require("fs");
const path = require("path");

const filePath = path.join(
  process.cwd(),
  "app",
  "(admin)",
  "admin",
  "trips",
  "[tripId]",
  "page.tsx"
);

if (!fs.existsSync(filePath)) {
  console.error("Could not find the admin trip page at:");
  console.error(filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let changed = false;

function saveChange(label) {
  changed = true;
  console.log(`Patched: ${label}`);
}

console.log("Patching admin trip page...");
console.log(filePath);

// ------------------------------------------------------------
// 1) Add deposit fields to TripRow type if needed
// ------------------------------------------------------------
if (code.includes("deposit_amount: number | null;")) {
  console.log("Already patched: TripRow deposit fields");
} else {
  const tripRowFinalPaymentRegex =
    /(final_payment_due_date:\s*string\s*\|\s*null;)/;

  if (tripRowFinalPaymentRegex.test(code)) {
    code = code.replace(
      tripRowFinalPaymentRegex,
      `$1
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;`
    );
    saveChange("TripRow deposit fields");
  } else {
    console.warn(
      "Could not find TripRow final_payment_due_date type line. Skipping type patch."
    );
  }
}

// ------------------------------------------------------------
// 2) Add deposit fields to tripUpdates save object
// ------------------------------------------------------------
if (code.includes('formData.get("deposit_amount")')) {
  console.log("Already patched: tripUpdates deposit save fields");
} else {
  const tripUpdatesRegex =
    /(balance_due:\s*toMoneyNumber\(formData\.get\("balance_due"\)\),\s*final_payment_due_date:\s*String\(formData\.get\("final_payment_due_date"\)\s*\?\?\s*""\)\.trim\(\)\s*\|\|\s*null,)/;

  if (tripUpdatesRegex.test(code)) {
    code = code.replace(
      tripUpdatesRegex,
      `$1
    deposit_amount: toMoneyNumber(formData.get("deposit_amount")),
    deposit_due_date:
      String(formData.get("deposit_due_date") ?? "").trim() || null,
    deposit_paid: formData.get("deposit_paid") === "true",`
    );
    saveChange("tripUpdates deposit save fields");
  } else {
    console.error("Could not find the tripUpdates payment section.");
    console.error(
      "Look for total_paid, balance_due, and final_payment_due_date in the saveTrip action."
    );
  }
}

// ------------------------------------------------------------
// 3) Add deposit fields to the admin form after final payment date
// ------------------------------------------------------------
if (code.includes('name="deposit_amount"')) {
  console.log("Already patched: admin form deposit fields");
} else {
  const finalPaymentInputIndex = code.indexOf('name="final_payment_due_date"');

  if (finalPaymentInputIndex === -1) {
    console.error('Could not find name="final_payment_due_date" in the form.');
  } else {
    const labelStart = code.lastIndexOf("<label", finalPaymentInputIndex);
    const labelEnd = code.indexOf("</label>", finalPaymentInputIndex);

    if (labelStart === -1 || labelEnd === -1) {
      console.error("Could not locate the full Final Payment Due Date label block.");
    } else {
      const insertAfter = labelEnd + "</label>".length;

      const depositFields = `

              <label>
                <span className="label">Deposit Amount</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="deposit_amount"
                  defaultValue={trip.deposit_amount ?? 0}
                />
              </label>

              <label>
                <span className="label">Deposit Due Date</span>
                <input
                  className="input"
                  type="date"
                  name="deposit_due_date"
                  defaultValue={trip.deposit_due_date ?? ""}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  name="deposit_paid"
                  value="true"
                  defaultChecked={trip.deposit_paid === true}
                />
                <span className="label" style={{ margin: 0 }}>
                  Deposit Paid
                </span>
              </label>`;

      code =
        code.slice(0, insertAfter) +
        depositFields +
        code.slice(insertAfter);

      saveChange("admin form deposit fields");
    }
  }
}

if (!changed) {
  console.log("");
  console.log("No changes were written.");
  console.log("The file may already be patched, or one of the sections still did not match.");
  process.exit(0);
}

fs.writeFileSync(filePath, code, "utf8");

console.log("");
console.log("Done. The admin trip page was patched.");
console.log("Now run: npm run build");