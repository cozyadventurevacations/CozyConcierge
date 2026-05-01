import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmailAutomationsClient } from "@/components/email-automations/email-automations-client";

type AutomationTemplate = {
  template: string;
  type: string;
  status: string;
  trigger: string;
};

type EmailLogRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  email_type: string;
  scheduled_send_date: string;
  sent_at: string | null;
  status: "sent" | "failed";
  error_message: string | null;
  client_accounts: {
    first_name: string | null;
    preferred_name: string | null;
    email: string | null;
  } | null;
};

const automationTemplates: AutomationTemplate[] = [
  {
    template: "Final Payment Reminder",
    type: "final_payment_10_day",
    status: "Active",
    trigger: "10 days before final payment due date",
  },
  {
    template: "30-Day Pre-Travel Email",
    type: "pre_travel_30_day",
    status: "Active",
    trigger: "30 days before departure",
  },
  {
    template: "7-Day Pre-Travel Email",
    type: "pre_travel_7_day",
    status: "Active",
    trigger: "7 days before departure",
  },
  {
    template: "7-Day Post-Travel Follow-Up",
    type: "post_travel_7_day",
    status: "Active",
    trigger: "7 days after return",
  },
  {
    template: "60-Day Post-Travel Follow-Up",
    type: "post_travel_60_day",
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
    type: "passport_expiry_6mo",
    status: "Active",
    trigger: "180 days before passport expiration",
  },
];

function labelForType(type: string): string {
  return (
    automationTemplates.find((t) => t.type === type)?.template ?? type
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === "active";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isActive ? "#f0f7f8" : "#fef2f2",
        color: isActive ? "var(--accent-dark)" : "#991b1b",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function LogStatusBadge({ status }: { status: "sent" | "failed" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        background: status === "sent" ? "#f0fdf4" : "#fef2f2",
        color: status === "sent" ? "#166534" : "#991b1b",
        fontWeight: 700,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {status === "sent" ? "Sent" : "Failed"}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminEmailAutomationsPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();

  // Fetch last 50 log entries with client info
  const { data: logData } = await supabase
    .from("email_automation_log")
    .select(
      "id, client_account_id, trip_id, email_type, scheduled_send_date, sent_at, status, error_message, client_accounts(first_name, preferred_name, email)",
    )
    .order("scheduled_send_date", { ascending: false })
    .limit(50);

  const logs = (logData ?? []) as EmailLogRow[];

  const sentCount = logs.filter((l) => l.status === "sent").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const totalCount = logs.length;

  return (
    <PageShell
      title="Email Automations"
      subtitle="Review active client email automation templates and sending rules."
    >
      {/* Overview Card */}
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
                  (t) => t.status.toLowerCase() === "active",
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

      {/* Security reminder */}
      <div
        className="card"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Automation reminder:</strong> Automated emails should never
        request credit card numbers, passwords, passport scans, or highly
        sensitive details by normal email.
      </div>

      {/* Log Stats */}
      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Recent Activity (Last 50 Entries)</h2>

        <div className="grid grid-3">
          <div className="card">
            <span className="label">Total Logged</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {totalCount}
            </p>
          </div>

          <div className="card">
            <span className="label">Successfully Sent</span>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 24,
                fontWeight: 800,
                color: "#166534",
              }}
            >
              {sentCount}
            </p>
          </div>

          <div className="card">
            <span className="label">Failed</span>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 24,
                fontWeight: 800,
                color: failedCount > 0 ? "#991b1b" : undefined,
              }}
            >
              {failedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Test Trigger */}
      <EmailAutomationsClient />

      {/* Email Log Table */}
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Email Log</h2>

        {logs.length === 0 ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              color: "#888",
              fontSize: 15,
            }}
          >
            No emails have been logged yet. The cron job runs daily at 9 AM
            Eastern and will log activity here.
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Scheduled Date</th>
                  <th>Sent At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const client = Array.isArray(log.client_accounts)
                    ? log.client_accounts[0]
                    : log.client_accounts;
                  const name =
                    client?.preferred_name?.trim() ||
                    client?.first_name?.trim() ||
                    "—";
                  return (
                    <tr key={log.id}>
                      <td>{name}</td>
                      <td style={{ fontSize: 13, color: "#555" }}>
                        {client?.email ?? "—"}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {labelForType(log.email_type)}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {formatDate(log.scheduled_send_date)}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {formatDateTime(log.sent_at)}
                      </td>
                      <td>
                        <LogStatusBadge status={log.status} />
                        {log.error_message && (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 11,
                              color: "#991b1b",
                            }}
                          >
                            {log.error_message}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Templates Table */}
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
                  <td style={{ fontSize: 13, color: "#555" }}>
                    {template.type}
                  </td>
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
    </PageShell>
  );
}
