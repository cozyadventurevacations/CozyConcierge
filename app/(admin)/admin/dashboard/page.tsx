import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TripRow = {
  id: string;
  trip_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  destinations: string | null;
  trip_status: string | null;
  final_payment_due_date?: string | null;
  balance_due?: number | null;
};

type QuoteRequestRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  destinations: string | null;
  departure_date: string | null;
  status: string | null;
  submitted_at: string | null;
};

type CommissionRow = {
  id: string;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  client_name_snapshot: string | null;
  trip_name_snapshot: string | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
};

type ClientFollowUpRow = {
  id: string;
  client_account_id: string;
  note_type: string;
  title: string | null;
  content: string | null;
  follow_up_date: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  client_accounts:
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
};

type RecentClientDocRow = {
  id: string;
  document_title: string | null;
  document_type: string | null;
  created_at: string | null;
  client_accounts:
    | { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }
    | { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }[]
    | null;
};

type MessageThreadRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  subject: string;
  status: string | null;
  priority: string | null;
  admin_unread_count: number | null;
  client_unread_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
  client_accounts:
    | { id: string; first_name: string | null; last_name: string | null; email: string | null; preferred_name: string | null }
    | { id: string; first_name: string | null; last_name: string | null; email: string | null; preferred_name: string | null }[]
    | null;
  trips:
    | { id: string; trip_name: string | null; destinations: string | null; departure_date: string | null }
    | { id: string; trip_name: string | null; destinations: string | null; departure_date: string | null }[]
    | null;
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function calculateExpectedCommission(
  fullCommissionAmount: number | null | undefined,
  agencyCommissionPercent: number | null | undefined,
) {
  const fullCommission = Number(fullCommissionAmount ?? 0);
  const percentage = Number(agencyCommissionPercent ?? 90);

  return Math.round(fullCommission * (percentage / 100) * 100) / 100;
}

function getExpectedCommission(row: CommissionRow) {
  return (
    Number(row.expected_commission_amount ?? 0) ||
    calculateExpectedCommission(row.full_commission_amount, row.agency_commission_percent)
  );
}

function getOutstandingCommission(row: CommissionRow) {
  return getExpectedCommission(row) - Number(row.received_commission_amount ?? 0);
}

function getClientFromFollowUp(row: ClientFollowUpRow) {
  if (Array.isArray(row.client_accounts)) return row.client_accounts[0] ?? null;
  return row.client_accounts ?? null;
}

function getClientDisplayName(row: ClientFollowUpRow) {
  const client = getClientFromFollowUp(row);
  if (!client) return "Unknown Client";

  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  return name || client.email || "Unnamed Client";
}

function getClientFromMessageThread(row: MessageThreadRow) {
  if (Array.isArray(row.client_accounts)) return row.client_accounts[0] ?? null;
  return row.client_accounts ?? null;
}

function getTripFromMessageThread(row: MessageThreadRow) {
  if (Array.isArray(row.trips)) return row.trips[0] ?? null;
  return row.trips ?? null;
}

function getMessageClientDisplayName(row: MessageThreadRow) {
  const client = getClientFromMessageThread(row);
  if (!client) return "Unknown Client";

  const name = `${client.preferred_name ?? client.first_name ?? ""} ${client.last_name ?? ""}`
    .replace(/\s+/g, " ")
    .trim();

  return name || client.email || "Unnamed Client";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "unknown";

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
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const label = priority ?? "normal";
  const isUrgent = label === "urgent" || label === "high";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isUrgent ? "#fff1f2" : "#f0f7f8",
        color: isUrgent ? "#be123c" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FollowUpBadge({ isOverdue }: { isOverdue: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isOverdue ? "#fff1f2" : "#f0f7f8",
        color: isOverdue ? "#be123c" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {isOverdue ? "overdue" : "upcoming"}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card stack"
      style={{ textDecoration: "none", color: "inherit", border: "1px solid #e6f0f2" }}
    >
      <span className="label">{title}</span>
      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{value}</strong>
      {subtitle ? <span style={{ color: "#64748b", lineHeight: 1.45 }}>{subtitle}</span> : null}
    </Link>
  );
}

function OpsHighlightCard({
  title,
  value,
  helper,
  href,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  helper: string;
  href: string;
  tone?: "neutral" | "warning" | "danger" | "good";
}) {
  const styles = {
    neutral: { background: "#ffffff", border: "1px solid #e6f0f2" },
    warning: { background: "#fff7ed", border: "1px solid #fed7aa" },
    danger: { background: "#fff1f2", border: "1px solid #fecdd3" },
    good: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
  }[tone];

  return (
    <Link
      href={href}
      className="card stack"
      style={{ textDecoration: "none", color: "inherit", background: styles.background, border: styles.border }}
    >
      <span className="label">{title}</span>
      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{value}</strong>
      <span style={{ color: "#64748b", lineHeight: 1.45 }}>{helper}</span>
    </Link>
  );
}

function SectionTitle({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>
      <Link href={href} className="btn btn-primary">
        {linkLabel}
      </Link>
    </div>
  );
}

function CompactListItem({
  title,
  subtitle,
  href,
  cta = "Open",
  children,
  tone = "neutral",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  cta?: string;
  children?: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        border: "1px solid #e6f0f2",
        borderRadius: 12,
        background: tone === "warning" ? "#fff7ed" : "#f7fbfc",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 240 }}>
        <p style={{ margin: 0, fontWeight: 800 }}>{title}</p>
        {subtitle ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p> : null}
        {children}
      </div>
      {href ? (
        <Link href={href} className="btn btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const today = startOfToday();
  const in7Days = addDays(today, 7);
  const in14Days = addDays(today, 14);
  const in30Days = addDays(today, 30);
  const sevenDaysAgo = addDays(today, -7);

  const todayStr = today.toISOString().slice(0, 10);
  const in7DaysStr = in7Days.toISOString().slice(0, 10);
  const in14DaysStr = in14Days.toISOString().slice(0, 10);
  const in30DaysStr = in30Days.toISOString().slice(0, 10);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [
    newQuoteRequestsResult,
    paymentRequestsResult,
    finalPaymentsDueResult,
    departuresResult,
    recentClientDocsResult,
    upcomingDeparturesResult,
    recentQuoteRequestsResult,
    upcomingFinalPaymentsResult,
    upcomingCommissionsResult,
    overdueClientFollowUpsResult,
    upcomingClientFollowUpsResult,
    openClientFollowUpsResult,
    openMessageThreadsResult,
    unreadMessageThreadsResult,
    recentMessageThreadsResult,
  ] = await Promise.all([
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("payment_requests").select("id", { count: "exact", head: true }).in("status", ["new", "pending", "sent"]),
    supabase.from("trips").select("id", { count: "exact", head: true }).gte("final_payment_due_date", todayStr).lte("final_payment_due_date", in7DaysStr),
    supabase.from("trips").select("id", { count: "exact", head: true }).gte("departure_date", todayStr).lte("departure_date", in14DaysStr),
    supabase
      .from("client_documents")
      .select("id, document_title, document_type, created_at, client_accounts(id, first_name, last_name, preferred_name)")
      .gte("created_at", sevenDaysAgoIso)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("trips")
      .select("id, trip_name, departure_date, return_date, destinations, trip_status")
      .gte("departure_date", todayStr)
      .order("departure_date", { ascending: true })
      .limit(8),
    supabase
      .from("quote_requests")
      .select("id, full_name, email, destinations, departure_date, status, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(8),
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, final_payment_due_date, balance_due")
      .gte("final_payment_due_date", todayStr)
      .lte("final_payment_due_date", in30DaysStr)
      .order("final_payment_due_date", { ascending: true })
      .limit(8),
    supabase
      .from("commissions")
      .select("id, commission_name, booking_number, supplier_name_snapshot, client_name_snapshot, trip_name_snapshot, full_commission_amount, agency_commission_percent, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date")
      .neq("commission_status", "received")
      .neq("commission_status", "cancelled")
      .gte("expected_payment_date", todayStr)
      .lte("expected_payment_date", in30DaysStr)
      .order("expected_payment_date", { ascending: true })
      .limit(8),
    supabase
      .from("client_notes")
      .select("id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)")
      .eq("is_completed", false)
      .lt("follow_up_date", todayStr)
      .order("follow_up_date", { ascending: true })
      .limit(8),
    supabase
      .from("client_notes")
      .select("id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)")
      .eq("is_completed", false)
      .gte("follow_up_date", todayStr)
      .lte("follow_up_date", in7DaysStr)
      .order("follow_up_date", { ascending: true })
      .limit(8),
    supabase.from("client_notes").select("id", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gt("admin_unread_count", 0),
    supabase
      .from("message_threads")
      .select("id, client_account_id, trip_id, subject, status, priority, admin_unread_count, client_unread_count, last_message_at, created_at, client_accounts!message_threads_client_account_id_fkey(id, first_name, last_name, email, preferred_name), trips(id, trip_name, destinations, departure_date)")
      .eq("status", "open")
      .order("last_message_at", { ascending: false })
      .limit(8),
  ]);

  const upcomingCommissions = (upcomingCommissionsResult.data ?? []) as CommissionRow[];
  const upcomingDepartures = (upcomingDeparturesResult.data ?? []) as TripRow[];
  const recentQuoteRequests = (recentQuoteRequestsResult.data ?? []) as QuoteRequestRow[];
  const upcomingFinalPayments = (upcomingFinalPaymentsResult.data ?? []) as TripRow[];
  const overdueClientFollowUps = (overdueClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];
  const upcomingClientFollowUps = (upcomingClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];
  const recentClientDocs = (recentClientDocsResult.data ?? []) as RecentClientDocRow[];
  const recentMessageThreads = (recentMessageThreadsResult.data ?? []) as MessageThreadRow[];

  const upcomingCommissionTotal = upcomingCommissions.reduce((sum, commission) => sum + getOutstandingCommission(commission), 0);
  const upcomingFinalPaymentTotal = upcomingFinalPayments.reduce((sum, trip) => sum + Number(trip.balance_due ?? 0), 0);

  const urgentOpsItems =
    Number(unreadMessageThreadsResult.count ?? 0) +
    overdueClientFollowUps.length +
    Number(newQuoteRequestsResult.count ?? 0) +
    Number(paymentRequestsResult.count ?? 0) +
    Number(finalPaymentsDueResult.count ?? 0);

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle="Your Cozy Concierge operations hub for messages, quotes, payments, trips, commissions, follow-ups, and recent activity."
    >
      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
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
              Cozy Concierge Command Center
            </p>
            <h2 style={{ margin: "6px 0 0" }}>Today’s Priority Work</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Start with unread client messages, overdue follow-ups, new requests, and payment items before diving into the full dashboard.
            </p>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/messages" className="btn btn-primary">Open Messages</Link>
            <Link href="/admin/trips" className="btn btn-primary">Trips</Link>
            <Link href="/admin/quote-requests" className="btn btn-primary">Requests</Link>
          </div>
        </div>

        <div className="grid grid-3">
          <OpsHighlightCard
            title="Unread Client Messages"
            value={unreadMessageThreadsResult.count ?? 0}
            helper={`${openMessageThreadsResult.count ?? 0} open conversation${(openMessageThreadsResult.count ?? 0) === 1 ? "" : "s"}`}
            href="/admin/messages"
            tone={(unreadMessageThreadsResult.count ?? 0) > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Priority Items"
            value={urgentOpsItems}
            helper="Messages, follow-ups, new requests, payments, and final payments needing attention"
            href="/admin/messages"
            tone={urgentOpsItems > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Upcoming Travel"
            value={departuresResult.count ?? 0}
            helper="Trips departing in the next 14 days"
            href="/admin/trips"
            tone={(departuresResult.count ?? 0) > 0 ? "neutral" : "good"}
          />
        </div>
      </div>

      <div className="grid grid-3">
        <SummaryCard title="Client Messages" value={openMessageThreadsResult.count ?? 0} subtitle={`${unreadMessageThreadsResult.count ?? 0} unread`} href="/admin/messages" />
        <SummaryCard title="New Travel Requests" value={newQuoteRequestsResult.count ?? 0} subtitle="Requests waiting for review" href="/admin/quote-requests" />
        <SummaryCard title="Payment Requests" value={paymentRequestsResult.count ?? 0} subtitle="New, pending, or sent" href="/admin/payment-requests" />
        <SummaryCard title="Open Follow-Ups" value={openClientFollowUpsResult.count ?? 0} subtitle="Client notes still open" href="/admin/clients" />
        <SummaryCard title="Overdue Follow-Ups" value={overdueClientFollowUps.length} subtitle="Follow-ups past due" href="/admin/clients" />
        <SummaryCard title="Trips Departing" value={departuresResult.count ?? 0} subtitle="Next 14 days" href="/admin/trips" />
        <SummaryCard title="Final Payments" value={formatMoney(upcomingFinalPaymentTotal)} subtitle={`${upcomingFinalPayments.length} trip balance${upcomingFinalPayments.length === 1 ? "" : "s"} due soon`} href="/admin/trips" />
        <SummaryCard title="Commissions" value={formatMoney(upcomingCommissionTotal)} subtitle={`${upcomingCommissions.length} expected commission${upcomingCommissions.length === 1 ? "" : "s"}`} href="/admin/commissions" />
        <SummaryCard title="New Documents" value={recentClientDocs.length} subtitle="Uploaded in the last 7 days" href="/admin/client-documents" />
      </div>

      <div className="card stack">
        <SectionTitle title="Concierge Messages" href="/admin/messages" linkLabel="Open Message Inbox" />
        {recentMessageThreadsResult.error ? (
          <pre>{JSON.stringify(recentMessageThreadsResult.error, null, 2)}</pre>
        ) : recentMessageThreads.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No open client conversations right now. The inbox is peacefully quiet — suspicious, but lovely.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {recentMessageThreads.map((thread) => {
              const client = getClientFromMessageThread(thread);
              const trip = getTripFromMessageThread(thread);
              const hasUnread = Number(thread.admin_unread_count ?? 0) > 0;
              return (
                <CompactListItem
                  key={thread.id}
                  title={getMessageClientDisplayName(thread)}
                  subtitle={`${thread.subject} • ${trip?.trip_name ? `${trip.trip_name} • ` : ""}Last message ${formatDateTime(thread.last_message_at)}`}
                  href={`/admin/messages?threadId=${thread.id}`}
                  cta="Open Thread"
                  tone={hasUnread ? "warning" : "neutral"}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {hasUnread ? <StatusBadge status={`${thread.admin_unread_count} unread`} /> : null}
                    <PriorityBadge priority={thread.priority} />
                    {client?.id ? <Link href={`/admin/clients/${client.id}`}>Client</Link> : null}
                    {trip?.id ? <Link href={`/admin/trips/${trip.id}`}>Trip</Link> : null}
                  </div>
                </CompactListItem>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <SectionTitle title="Client Follow-Ups" href="/admin/clients" linkLabel="View Clients" />
          {overdueClientFollowUpsResult.error || upcomingClientFollowUpsResult.error ? (
            <pre>{JSON.stringify(overdueClientFollowUpsResult.error ?? upcomingClientFollowUpsResult.error, null, 2)}</pre>
          ) : overdueClientFollowUps.length === 0 && upcomingClientFollowUps.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No overdue or upcoming client follow-ups. Look at you, suspiciously organized.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {[...overdueClientFollowUps, ...upcomingClientFollowUps].slice(0, 8).map((followUp) => {
                const client = getClientFromFollowUp(followUp);
                const isOverdue = Boolean(followUp.follow_up_date) && followUp.follow_up_date! < todayStr;
                return (
                  <CompactListItem
                    key={followUp.id}
                    title={getClientDisplayName(followUp)}
                    subtitle={`${followUp.title ?? followUp.note_type} • ${formatDate(followUp.follow_up_date)}`}
                    href={client?.id ? `/admin/clients/${client.id}` : undefined}
                    cta="Open Client"
                    tone={isOverdue ? "warning" : "neutral"}
                  >
                    <div style={{ marginTop: 6 }}><FollowUpBadge isOverdue={isOverdue} /></div>
                  </CompactListItem>
                );
              })}
            </div>
          )}
        </div>

        <div className="card stack">
          <SectionTitle title="New Client Documents" href="/admin/client-documents" linkLabel="View Documents" />
          {recentClientDocsResult.error ? (
            <pre>{JSON.stringify(recentClientDocsResult.error, null, 2)}</pre>
          ) : recentClientDocs.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No new client documents uploaded in the last 7 days.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {recentClientDocs.map((doc) => {
                const client = Array.isArray(doc.client_accounts) ? doc.client_accounts[0] : doc.client_accounts;
                const clientName = client ? `${client.preferred_name ?? client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unknown Client" : "Unknown Client";
                return (
                  <CompactListItem
                    key={doc.id}
                    title={`${clientName} uploaded documentation`}
                    subtitle={`${doc.document_title ?? doc.document_type ?? "Document"} • ${formatDateTime(doc.created_at)}`}
                    href={client?.id ? `/admin/clients/${client.id}` : undefined}
                    cta="Open Client"
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card stack">
        <SectionTitle title="Commissions Expected in 30 Days" href="/admin/commissions" linkLabel="View Commissions" />
        {upcomingCommissionsResult.error ? (
          <pre>{JSON.stringify(upcomingCommissionsResult.error, null, 2)}</pre>
        ) : upcomingCommissions.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No commissions expected in the next 30 days.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 960 }}>
              <thead><tr><th>Commission</th><th>Client</th><th>Trip</th><th>Status</th><th>Outstanding</th><th>Expected Date</th><th>Open</th></tr></thead>
              <tbody>
                {upcomingCommissions.map((commission) => (
                  <tr key={commission.id}>
                    <td>{commission.commission_name}</td>
                    <td>{commission.client_name_snapshot ?? "Not provided"}</td>
                    <td>{commission.trip_name_snapshot ?? "Not provided"}</td>
                    <td><StatusBadge status={commission.commission_status} /></td>
                    <td>{formatMoney(getOutstandingCommission(commission))}</td>
                    <td>{formatDate(commission.expected_payment_date)}</td>
                    <td><Link href={`/admin/commissions/${commission.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <SectionTitle title="Upcoming Final Payments" href="/admin/trips" linkLabel="View Trips" />
          {upcomingFinalPaymentsResult.error ? (
            <pre>{JSON.stringify(upcomingFinalPaymentsResult.error, null, 2)}</pre>
          ) : upcomingFinalPayments.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No final payments due in the next 30 days.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {upcomingFinalPayments.map((trip) => (
                <CompactListItem
                  key={trip.id}
                  title={trip.trip_name ?? "Trip"}
                  subtitle={`${formatMoney(trip.balance_due)} due ${formatDate(trip.final_payment_due_date)} • Departing ${formatDate(trip.departure_date)}`}
                  href={`/admin/trips/${trip.id}`}
                  cta="Open Trip"
                  tone={Number(trip.balance_due ?? 0) > 0 ? "warning" : "neutral"}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card stack">
          <SectionTitle title="Upcoming Departures" href="/admin/trips" linkLabel="View Trips" />
          {upcomingDeparturesResult.error ? (
            <pre>{JSON.stringify(upcomingDeparturesResult.error, null, 2)}</pre>
          ) : upcomingDepartures.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No upcoming departures found.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {upcomingDepartures.map((trip) => (
                <CompactListItem
                  key={trip.id}
                  title={trip.trip_name ?? "Trip"}
                  subtitle={`${trip.destinations ?? "Not set"} • ${formatDate(trip.departure_date)} to ${formatDate(trip.return_date)}`}
                  href={`/admin/trips/${trip.id}`}
                  cta="Open Trip"
                >
                  <div style={{ marginTop: 6 }}><StatusBadge status={trip.trip_status} /></div>
                </CompactListItem>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card stack">
        <SectionTitle title="Recent Travel Requests" href="/admin/quote-requests" linkLabel="View Requests" />
        {recentQuoteRequestsResult.error ? (
          <pre>{JSON.stringify(recentQuoteRequestsResult.error, null, 2)}</pre>
        ) : recentQuoteRequests.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No travel requests found.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead><tr><th>Name</th><th>Email</th><th>Destination</th><th>Departure</th><th>Status</th><th>Submitted</th><th>Open</th></tr></thead>
              <tbody>
                {recentQuoteRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.full_name ?? ""}</td>
                    <td>{request.email ?? ""}</td>
                    <td>{request.destinations ?? ""}</td>
                    <td>{formatDate(request.departure_date)}</td>
                    <td><StatusBadge status={request.status} /></td>
                    <td>{formatDateTime(request.submitted_at)}</td>
                    <td><Link href={`/admin/quote-requests/${request.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
