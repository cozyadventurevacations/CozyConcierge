const fs = require("fs");
const path = require("path");

const filePath = path.join(
  process.cwd(),
  "app",
  "(client)",
  "trips",
  "[tripId]",
  "trip-detail-client.tsx"
);

if (!fs.existsSync(filePath)) {
  console.error("Could not find:");
  console.error(filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let changed = false;

function write(label) {
  changed = true;
  console.log(`Patched: ${label}`);
}

console.log("Patching proposal payment details...");
console.log(filePath);

// ------------------------------------------------------------
// 1) Make sure TripRow has the fields we need
// ------------------------------------------------------------
const tripRowStart = code.indexOf("type TripRow = {");

if (tripRowStart !== -1) {
  const tripRowEnd = code.indexOf("};", tripRowStart);
  const before = code.slice(0, tripRowStart);
  let tripRowBlock = code.slice(tripRowStart, tripRowEnd + 2);
  const after = code.slice(tripRowEnd + 2);

  const neededFields = [
    `  deposit_amount: number | null;`,
    `  deposit_due_date: string | null;`,
    `  final_payment_due_date: string | null;`,
  ];

  let addedAnyTypeField = false;

  if (!tripRowBlock.includes("deposit_amount:")) {
    tripRowBlock = tripRowBlock.replace(
      "};",
      `  deposit_amount: number | null;
};`
    );
    addedAnyTypeField = true;
  }

  if (!tripRowBlock.includes("deposit_due_date:")) {
    tripRowBlock = tripRowBlock.replace(
      "};",
      `  deposit_due_date: string | null;
};`
    );
    addedAnyTypeField = true;
  }

  if (!tripRowBlock.includes("final_payment_due_date:")) {
    tripRowBlock = tripRowBlock.replace(
      "};",
      `  final_payment_due_date: string | null;
};`
    );
    addedAnyTypeField = true;
  }

  if (addedAnyTypeField) {
    code = before + tripRowBlock + after;
    write("TripRow payment fields");
  } else {
    console.log("TripRow already has proposal payment fields.");
  }
} else {
  console.warn("Could not find TripRow type. Skipping type patch.");
}

// ------------------------------------------------------------
// 2) Add helper/component before OverviewTab
// ------------------------------------------------------------
if (!code.includes("function ProposalPaymentDetails")) {
  const componentCode = `
function formatProposalMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "Not set";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatProposalDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(value)
    ? new Date(\`\${value}T12:00:00\`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ProposalPaymentDetails({ trip }: { trip: TripRow }) {
  return (
    <section className="card stack" style={{ border: "1px solid #e6f0f2" }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Proposal Payment Details
        </p>

        <h3 style={{ margin: "4px 0 0" }}>Payment Milestones</h3>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Key deposit and final payment dates for this proposal.
        </p>
      </div>

      <div className="grid grid-3">
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Deposit Amount</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900 }}>
            {formatProposalMoney(trip.deposit_amount)}
          </p>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Deposit Due Date</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900 }}>
            {formatProposalDate(trip.deposit_due_date)}
          </p>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <span className="label">Final Payment Due Date</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900, color: "#6b3a08" }}>
            {formatProposalDate(trip.final_payment_due_date)}
          </p>
        </div>
      </div>
    </section>
  );
}

`;

  const overviewIndex = code.indexOf("function OverviewTab");

  if (overviewIndex !== -1) {
    code = code.slice(0, overviewIndex) + componentCode + code.slice(overviewIndex);
    write("ProposalPaymentDetails component");
  } else {
    console.error("Could not find function OverviewTab. Component was not inserted.");
  }
} else {
  console.log("ProposalPaymentDetails component already exists.");
}

// ------------------------------------------------------------
// 3) Add component under PaymentTimeline if present
// ------------------------------------------------------------
if (code.includes("<ProposalPaymentDetails trip={trip} />")) {
  console.log("Proposal payment details already rendered.");
} else {
  const paymentTimelineClose = "/>";

  const paymentTimelineStart = code.indexOf("<PaymentTimeline");

  if (paymentTimelineStart !== -1) {
    const paymentTimelineEnd = code.indexOf(paymentTimelineClose, paymentTimelineStart);

    if (paymentTimelineEnd !== -1) {
      const insertAt = paymentTimelineEnd + paymentTimelineClose.length;

      code =
        code.slice(0, insertAt) +
        `

      <ProposalPaymentDetails trip={trip} />` +
        code.slice(insertAt);

      write("Proposal payment details render after PaymentTimeline");
    } else {
      console.error("Found PaymentTimeline but could not find its closing />.");
    }
  } else {
    console.error("Could not find <PaymentTimeline. No render was added.");
    console.error("If your proposal section is elsewhere, paste trip-detail-client.tsx and I will patch it directly.");
  }
}

if (!changed) {
  console.log("");
  console.log("No changes were written.");
  process.exit(0);
}

fs.writeFileSync(filePath, code, "utf8");

console.log("");
console.log("Done. Now run: npm run build");