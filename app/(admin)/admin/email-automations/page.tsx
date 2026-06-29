import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmailAutomationsClient } from "@/components/email-automations/email-automations-client";
import {
  emailAutomationTemplates,
  labelForEmailAutomationType,
  type EmailAutomationType,
} from "@/lib/email-automations/config";
import { revalidatePath } from "next/cache";

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

type AutomationSettingRow = {
  email_type: string;
  enabled: boolean | null;
  subject_override: string | null;
  custom_note: string | null;
  updated_at: string | null;
};

type UpcomingEmail = {
  key: string;
  sendDate: string;
  emailType: EmailAutomationType;
  clientName: string;
  email: string | null;
  tripName: string | null;
  reason: string;
  enabled: boolean;
};

function labelForType(type: string): string {
  return labelForEmailAutomationType(type);
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

function AutomationStateBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        background: enabled ? "#f0fdf4" : "#fef2f2",
        color: enabled ? "#166534" : "#991b1b",
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {enabled ? "Active" : "Paused"}
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

function cleanText(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function toIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function clientDisplayName(client: any) {
  return (
    client?.preferred_name?.trim() ||
    [client?.first_name, client?.last_name].filter(Boolean).join(" ").trim() ||
    client?.email ||
    "Unknown client"
  );
}

async function updateAutomationSetting(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const emailType = String(formData.get("email_type") ?? "").trim();
  const templateExists = emailAutomationTemplates.some((template) => template.type === emailType);

  if (!templateExists) {
    throw new Error("Unknown email automation type.");
  }

  const enabled = formData.get("enabled") === "on";
  const subjectOverride = cleanText(formData, "subject_override");
  const customNote = cleanText(formData, "custom_note");

  const { error } = await supabase
    .from("email_automation_settings")
    .upsert({
      email_type: emailType,
      enabled,
      subject_override: subjectOverride,
      custom_note: customNote,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/email-automations");
}

async function buildUpcomingEmails({
  supabase,
  settings,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  settings: Map<string, AutomationSettingRow>;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: UpcomingEmail[] = [];

  function isEnabled(type: EmailAutomationType) {
    return settings.get(type)?.enabled !== false;
  }

  const targetDates = {
    finalPayment: toIsoDate(addDays(today, 10)),
    preTravel30: toIsoDate(addDays(today, 30)),
    preTravel7: toIsoDate(addDays(today, 7)),
    postTravel7: toIsoDate(addDays(today, -7)),
    postTravel60: toIsoDate(addDays(today, -60)),
    passportExpiry: toIsoDate(addMonths(today, 6)),
  };

  const [
    finalPayments,
    preTravel30,
    preTravel7,
    postTravel7,
    postTravel60,
    passportDocs,
    clients,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_name, final_payment_due_date, balance_due, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("final_payment_due_date", targetDates.finalPayment)
      .neq("trip_status", "cancelled"),
    supabase
      .from("trips")
      .select("id, trip_name, departure_date, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("departure_date", targetDates.preTravel30)
      .neq("trip_status", "cancelled"),
    supabase
      .from("trips")
      .select("id, trip_name, departure_date, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("departure_date", targetDates.preTravel7)
      .neq("trip_status", "cancelled"),
    supabase
      .from("trips")
      .select("id, trip_name, return_date, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("return_date", targetDates.postTravel7)
      .neq("trip_status", "cancelled"),
    supabase
      .from("trips")
      .select("id, trip_name, return_date, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("return_date", targetDates.postTravel60)
      .neq("trip_status", "cancelled"),
    supabase
      .from("client_documents")
      .select("id, expiry_date, client_accounts(first_name, last_name, preferred_name, email)")
      .eq("document_type", "passport")
      .eq("expiry_date", targetDates.passportExpiry),
    supabase
      .from("client_accounts")
      .select("id, first_name, last_name, preferred_name, email, date_of_birth, anniversary_date")
      .not("email", "is", null),
  ]);

  function pushTripEmail(rows: any[] | null, type: EmailAutomationType, reason: string, dateField: string) {
    for (const row of rows ?? []) {
      const client = Array.isArray(row.client_accounts) ? row.client_accounts[0] : row.client_accounts;
      upcoming.push({
        key: `${type}:${row.id}`,
        sendDate: toIsoDate(today),
        emailType: type,
        clientName: clientDisplayName(client),
        email: client?.email ?? null,
        tripName: row.trip_name ?? null,
        reason: `${reason}: ${formatDate(row[dateField])}`,
        enabled: isEnabled(type),
      });
    }
  }

  pushTripEmail(finalPayments.data, "final_payment_10_day", "Final payment due in 10 days", "final_payment_due_date");
  pushTripEmail(preTravel30.data, "pre_travel_30_day", "Departure in 30 days", "departure_date");
  pushTripEmail(preTravel7.data, "pre_travel_7_day", "Departure in 7 days", "departure_date");
  pushTripEmail(postTravel7.data, "post_travel_7_day", "Returned 7 days ago", "return_date");
  pushTripEmail(postTravel60.data, "post_travel_60_day", "Returned 60 days ago", "return_date");

  for (const doc of passportDocs.data ?? []) {
    const client = Array.isArray(doc.client_accounts) ? doc.client_accounts[0] : doc.client_accounts;
    upcoming.push({
      key: `passport_expiry_6mo:${doc.id}`,
      sendDate: toIsoDate(today),
      emailType: "passport_expiry_6mo",
      clientName: clientDisplayName(client),
      email: client?.email ?? null,
      tripName: null,
      reason: `Passport expires in about 6 months: ${formatDate(doc.expiry_date)}`,
      enabled: isEnabled("passport_expiry_6mo"),
    });
  }

  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  for (const client of clients.data ?? []) {
    if (client.date_of_birth) {
      const birthday = new Date(client.date_of_birth);
      if (birthday.getMonth() === todayMonth && birthday.getDate() === todayDay) {
        upcoming.push({
          key: `birthday:${client.id}`,
          sendDate: toIsoDate(today),
          emailType: "birthday",
          clientName: clientDisplayName(client),
          email: client.email ?? null,
          tripName: null,
          reason: "Client birthday today",
          enabled: isEnabled("birthday"),
        });
      }
    }

    if (client.anniversary_date) {
      const anniversary = new Date(client.anniversary_date);
      if (anniversary.getMonth() === todayMonth && anniversary.getDate() === todayDay) {
        upcoming.push({
          key: `anniversary:${client.id}`,
          sendDate: toIsoDate(today),
          emailType: "anniversary",
          clientName: clientDisplayName(client),
          email: client.email ?? null,
          tripName: null,
          reason: "Client anniversary today",
          enabled: isEnabled("anniversary"),
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export default async function AdminEmailAutomationsPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();

  const { data: logData } = await supabase
    .from("email_automation_log")
    .select(
      "id, client_account_id, trip_id, email_type, scheduled_send_date, sent_at, status, error_message, client_accounts(first_name, preferred_name, email)",
    )
    .order("scheduled_send_date", { ascending: false })
    .limit(50);

  const logs = (logData ?? []) as unknown as EmailLogRow[];

  const { data: settingsData } = await supabase
    .from("email_automation_settings")
    .select("email_type, enabled, subject_override, custom_note, updated_at");

  const settingsMap = new Map(
    ((settingsData ?? []) as AutomationSettingRow[]).map((setting) => [
      setting.email_type,
      setting,
    ]),
  );

  const settings = emailAutomationTemplates.map((template) => ({
    ...template,
    setting: settingsMap.get(template.type) ?? {
      email_type: template.type,
      enabled: template.defaultEnabled,
      subject_override: null,
      custom_note: null,
      updated_at: null,
    },
  }));

  const upcomingEmails = await buildUpcomingEmails({ supabase, settings: settingsMap });

  const sentCount = logs.filter((l) => l.status === "sent").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const totalCount = logs.length;
  const activeCount = settings.filter((automation) => automation.setting.enabled !== false).length;
  const customizedCount = settings.filter(
    (automation) => automation.setting.subject_override || automation.setting.custom_note,
  ).length;

  return (
    <PageShell
      title="Email Automations"
      subtitle="Manage and monitor automated client email workflows."
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
              {emailAutomationTemplates.length}
            </p>
          </div>
          <div className="card">
            <span className="label">Active</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {activeCount}
            </p>
          </div>
          <div className="card">
            <span className="label">Customized</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{customizedCount}</p>
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
        <strong>Automation reminder:</strong> Automated emails should never
        request credit card numbers, passwords, passport scans, or highly
        sensitive details by normal email.
      </div>

      <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
        <h2 style={{ margin: 0 }}>Recent Activity (Last 50 Entries)</h2>
        <div className="grid grid-3">
          <div className="card">
            <span className="label">Total Logged</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{totalCount}</p>
          </div>
          <div className="card">
            <span className="label">Successfully Sent</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, color: "#166534" }}>
              {sentCount}
            </p>
          </div>
          <div className="card">
            <span className="label">Failed</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, color: failedCount > 0 ? "#991b1b" : undefined }}>
              {failedCount}
            </p>
          </div>
        </div>
      </div>

      <EmailAutomationsClient />

      <div className="card stack">
        <div>
          <h2 style={{ margin: 0 }}>Ready To Send Today</h2>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            These are the clients who currently match an automation trigger for today.
            Run the automation manually to send these now, or let the daily cron job handle them.
          </p>
        </div>

        {upcomingEmails.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>
            No automated emails are scheduled for today.
          </p>
        ) : (
          <div className="grid grid-2">
            {upcomingEmails.map((email) => (
              <div
                key={email.key}
                className="card stack-sm"
                style={{
                  border: email.enabled ? "1px solid #e6f0f2" : "1px solid #fecaca",
                  background: email.enabled ? "#ffffff" : "#fef2f2",
                  borderRadius: 14,
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{email.clientName}</strong>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                      {email.email ?? "No email on file"}
                    </p>
                  </div>
                  <AutomationStateBadge enabled={email.enabled} />
                </div>
                <p style={{ margin: 0, fontWeight: 800 }}>
                  {labelForType(email.emailType)}
                </p>
                <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                  {email.reason}
                  {email.tripName ? ` | ${email.tripName}` : ""}
                </p>
                {!email.enabled ? (
                  <p style={{ margin: 0, color: "#991b1b", fontWeight: 800, fontSize: 13 }}>
                    Automation is paused, so this will not send.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Email Log</h2>
        {logs.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#888", fontSize: 15 }}>
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
                      <td style={{ fontSize: 13, color: "#555" }}>{client?.email ?? "—"}</td>
                      <td style={{ fontSize: 13 }}>{labelForType(log.email_type)}</td>
                      <td style={{ fontSize: 13 }}>{formatDate(log.scheduled_send_date)}</td>
                      <td style={{ fontSize: 13 }}>{formatDateTime(log.sent_at)}</td>
                      <td>
                        <LogStatusBadge status={log.status} />
                        {log.error_message && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#991b1b" }}>
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

      <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
        <div>
          <h2 style={{ margin: 0 }}>Automation Controls</h2>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            Pause an automation, change its subject line, or add a short custom advisor note.
            Leaving a subject or note blank uses the default email.
          </p>
        </div>

        <div className="grid grid-2">
          {settings.map((automation) => {
            const enabled = automation.setting.enabled !== false;

            return (
              <form
                key={automation.type}
                action={updateAutomationSetting}
                className="card stack"
                style={{
                  border: enabled ? "1px solid #e6f0f2" : "1px solid #fecaca",
                  background: enabled ? "#ffffff" : "#fef2f2",
                  borderRadius: 14,
                }}
              >
                <input type="hidden" name="email_type" value={automation.type} />

                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{automation.template}</h3>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                      {automation.trigger}
                    </p>
                  </div>
                  <AutomationStateBadge enabled={enabled} />
                </div>

                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                  <input type="checkbox" name="enabled" defaultChecked={enabled} />
                  Enabled
                </label>

                <label className="stack-sm">
                  <span className="label">Subject Override</span>
                  <input
                    className="input"
                    name="subject_override"
                    defaultValue={automation.setting.subject_override ?? ""}
                    placeholder="Leave blank to use default subject"
                  />
                </label>

                <label className="stack-sm">
                  <span className="label">Custom Advisor Note</span>
                  <textarea
                    className="textarea"
                    name="custom_note"
                    defaultValue={automation.setting.custom_note ?? ""}
                    placeholder="Optional note inserted into this automated email"
                    style={{ minHeight: 90 }}
                  />
                </label>

                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>
                    {automation.setting.updated_at
                      ? `Updated ${formatDateTime(automation.setting.updated_at)}`
                      : "Default settings"}
                  </span>
                  <button type="submit" className="btn btn-primary">
                    Save Automation
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
