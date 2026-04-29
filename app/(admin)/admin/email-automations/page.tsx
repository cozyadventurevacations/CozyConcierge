import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type AutomationTemplate = {
  template: string;
  type: string;
  status: string;
  trigger: string;
};

const automationTemplates: AutomationTemplate[] = [
  {
    template: "Final Payment Reminder",
    type: "final_payment_10",
    status: "Active",
    trigger: "10 days before final payment due date",
  },
  {
    template: "30-Day Pre-Travel Email",
    type: "pre_travel_30",
    status: "Active",
    trigger: "30 days before departure",
  },
  {
    template: "7-Day Pre-Travel Email",
    type: "pre_travel_7",
    status: "Active",
    trigger: "7 days before departure",
  },
  {
    template: "7-Day Post-Travel Follow-Up",
    type: "post_travel_7",
    status: "Active",
    trigger: "7 days after return",
  },
  {
    template: "60-Day Post-Travel Follow-Up",
    type: "post_travel_60",
    status: "Active",
    trigger: "60 days after return",
  },
  {
    template: "Birthday Email",
    type: "birthday",
    status: "Active",
    trigger: "Client birthday",
  },
  {
    template: "Anniversary Email",
    type: "anniversary",
    status: "Active",
    trigger: "Client anniversary date",
  },
  {
    template: "Passport Expiration Reminder",
    type: "passport_expiration_180",
    status: "Active",
    trigger: "180 days before passport expiration",
  },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: "#f0f7f8",
        color: "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

export default async function AdminEmailAutomationsPage() {
  await requireAdmin();

  return (
    <PageShell
      title="Email Automations"
      subtitle="Review active client email automation templates and sending rules."
    >
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
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
          Cozy Concierge
        </p>

        <h2 style={{ margin: 0 }}>Automation Overview</h2>

        <div className="grid grid-3">
          <div className="card">
            <span className="label">Templates</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {automationTemplates.length}
            </p>
          </div>

          <div className="card">
            <span className="label">Active</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {
                automationTemplates.filter(
                  (template) => template.status.toLowerCase() === "active",
                ).length
              }
            </p>
          </div>

          <div className="card">
            <span className="label">Mode</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              Auto
            </p>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Automation reminder:</strong> Automated emails should never request
        credit card numbers, passwords, passport scans, or highly sensitive details by
        normal email.
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Email Templates</h2>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Template</th>
                <th>Type</th>
                <th>Trigger</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {automationTemplates.map((template) => (
                <tr key={template.type}>
                  <td>{template.template}</td>
                  <td>{template.type}</td>
                  <td>{template.trigger}</td>
                  <td>
                    <StatusBadge status={template.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Automation Tools</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>

          <Link href="/admin/follow-ups" className="btn btn-primary">
            View Follow-Ups
          </Link>
        </div>
      </div>
    </PageShell>
  );
}