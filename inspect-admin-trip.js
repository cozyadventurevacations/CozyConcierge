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
  console.error("Could not find:");
  console.error(filePath);
  process.exit(1);
}

const code = fs.readFileSync(filePath, "utf8");
const lines = code.split(/\r?\n/);

function printMatches(label, searchTerms, context = 12) {
  console.log("\n==================================================");
  console.log(label);
  console.log("==================================================");

  let foundAny = false;

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();

    const matched = searchTerms.some((term) =>
      lowerLine.includes(term.toLowerCase())
    );

    if (!matched) return;

    foundAny = true;

    const start = Math.max(0, index - context);
    const end = Math.min(lines.length, index + context + 1);

    console.log(`\n--- Match around line ${index + 1} ---`);

    for (let i = start; i < end; i++) {
      const lineNumber = String(i + 1).padStart(5, " ");
      console.log(`${lineNumber}: ${lines[i]}`);
    }
  });

  if (!foundAny) {
    console.log("No matches found.");
  }
}

console.log(`Scanning file: ${filePath}`);
console.log(`Total lines: ${lines.length}`);

printMatches("FINAL PAYMENT / BALANCE / DEPOSIT REFERENCES", [
  "final_payment",
  "final payment",
  "balance_due",
  "balance due",
  "deposit",
]);

printMatches("FORM DATA REFERENCES", [
  "formData.get",
  "formdata.get",
]);

printMatches("TRIP TYPE / ROW REFERENCES", [
  "type TripRow",
  "TripRow",
  "final_payment_due_date",
  "balance_due",
]);

printMatches("SUPABASE UPDATE REFERENCES", [
  ".update(",
  "updatePayload",
  "tripUpdates",
  "tripUpdate",
  "payload",
]);