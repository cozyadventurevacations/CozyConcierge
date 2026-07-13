import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";

const updatedSections = [
  "Advisor and third-party supplier responsibilities",
  "Quotes, pricing, deposits, and payment deadlines",
  "Changes, cancellations, refunds, and chargebacks",
  "Travel documents, entry requirements, and passports",
  "Travel insurance acceptance or waiver",
  "Air travel, schedule changes, and independent arrangements",
  "Special requests, accessibility needs, and traveler conduct",
  "Privacy, electronic communications, and secure portal use",
];

export default function ClientTermsAndConditionsPage() {
  return (
    <PageShell
      title="Terms and Conditions"
      subtitle="Current Cozy Adventure Vacations client terms for travel planning and booked trips."
    >
      <div className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent-dark)",
              fontWeight: 800,
            }}
          >
            Cozy Adventure Vacations LLC
          </p>
          <h2 style={{ margin: "6px 0 0" }}>Client Terms and Conditions</h2>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>
            Effective July 13, 2026. These terms explain the responsibilities of Cozy Adventure Vacations, third-party travel suppliers, and each traveler when travel services are requested, booked, changed, or cancelled.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <a
            href="/legal/cozy-adventure-vacations-terms-and-conditions.pdf"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            View PDF
          </a>
          <a
            href="/legal/cozy-adventure-vacations-terms-and-conditions.docx"
            className="btn btn-outline"
          >
            Download DOCX
          </a>
        </div>
      </div>

      <div className="card stack" style={{ border: "1px solid #e6f0f2", background: "#f7fbfc" }}>
        <h2 style={{ margin: 0 }}>What is covered</h2>
        <div className="grid grid-2">
          {updatedSections.map((section) => (
            <div key={section} className="card" style={{ background: "#ffffff" }}>
              <p style={{ margin: 0, fontWeight: 800, color: "var(--accent-dark)" }}>
                {section}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Please contact your advisor before booking if you have questions about payment deadlines, supplier policies, travel insurance, documentation, accessibility needs, or special requests.
        </p>
      </div>

      <div className="row">
        <Link href="/dashboard" className="btn btn-outline">
          Back to Dashboard
        </Link>
        <Link href="/messages" className="btn btn-primary">
          Message Advisor
        </Link>
      </div>
    </PageShell>
  );
}
