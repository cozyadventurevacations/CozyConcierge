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

type MessageThreadRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  subject: string;
  status: string | null;
  priority: string | null;
  thread_type: "private" | "trip_group" | string;
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
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
      {status ?? "unknown"}
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

function FollowUpBadge({ isUpcoming }: { isUpcoming: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isUpcoming ? "#fff7ed" : "#f0f7f8",
        color: isUpcoming ? "#c2410c" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {isUpcoming ? "due soon" : "upcoming"}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  href,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href: string;
  tone?: "neutral" | "warning";
}) {
  const bg = tone === "warning" ? "#fff7ed" : "#ffffff";
  const border = tone === "warning" ? "1px solid #fed7aa" : "1px solid #e6f0f2";

  return (
    <Link
      href={href}
      className="card stack"
      style={{ textDecoration: "none", color: "inherit", background: bg, border }}
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
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <Link href={href} className="btn btn-primary">{linkLabel}</Link>
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
  const in3Days = addDays(today, 3);
  const in7Days = addDays(today, 7);
  const in14Days = addDays(today, 14);
  const in21Days = addDays(today, 21);

  const todayStr = today.toISOString().slice(0, 10);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);
  const in7DaysStr = in7Days.toISOString().slice(0, 10);
  const in14DaysStr = in14Days.toISOString().slice(0, 10);
  const in21DaysStr = in21Days.toISOString().slice(0, 10);

  const [
    newQuoteRequestsResult,
    paymentRequestsResult,
    departuresResult,
    upcomingDeparturesResult,
    finalPaymentsDue21Result,
    upcomingClientFollowUpsResult,
    openClientFollowUpsResult,
    soonClientFollowUpsResult,
    openMessageThreadsResult,
    unreadPrivateMessageThreadsResult,
    privateMessageThreadsResult,
  ] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "pending", "sent"]),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .gte("departure_date", todayStr)
      .lte("departure_date", in14DaysStr),
    supabase
      .from("trips")
      .select("id, trip_name, departure_date, return_date, destinations, trip_status")
      .gte("departure_date", todayStr)
      .order("departure_date", { ascending: true })
      .limit(8),
    // Final payments due in next 21 days
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, final_payment_due_date, balance_due")
      .gte("final_payment_due_date", todayStr)
      .lte("final_payment_due_date", in21DaysStr)
      .gt("balance_due", 0)
      .order("final_payment_due_date", { ascending: true })
      .limit(10),
    // Upcoming follow-ups in the next 7 days
    supabase
      .from("client_notes")
      .select("id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)")
      .eq("is_completed", false)
      .gte("follow_up_date", todayStr)
      .lte("follow_up_date", in7DaysStr)
      .order("follow_up_date", { ascending: true })
      .limit(8),
    // Total open follow-ups count
    supabase
      .from("client_notes")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false),
    // Follow-ups due within 3 days (for warning color on summary card)
    supabase
      .from("client_notes")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .gte("follow_up_date", todayStr)
      .lte("follow_up_date", in3DaysStr),
    supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    // Unread private threads only
    supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .eq("thread_type", "private")
      .gt("admin_unread_count", 0),
    // Private threads — unread first, then most recent
    supabase
      .from("message_threads")
      .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at, client_accounts!message_threads_client_account_id_fkey(id, first_name, last_name, email, preferred_name), trips(id, trip_name, destinations, departure_date)")
      .eq("status", "open")
      .eq("thread_type", "private")
      .order("admin_unread_count", { ascending: false })
      .order("last_message_at", { ascending: false })
      .limit(8),
  ]);

  const upcomingDepartures = (upcomingDeparturesResult.data ?? []) as TripRow[];
  const finalPaymentsDue21 = (finalPaymentsDue21Result.data ?? []) as TripRow[];
  const upcomingClientFollowUps = (upcomingClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];
  const privateMessageThreads = (privateMessageThreadsResult.data ?? []) as MessageThreadRow[];

  const finalPaymentsDue21Total = finalPaymentsDue21.reduce(
    (sum, trip) => sum + Number(trip.balance_due ?? 0),
    0,
  );

  const unreadPrivateCount = unreadPrivateMessageThreadsResult.count ?? 0;
  const openFollowUpsCount = openClientFollowUpsResult.count ?? 0;
  const soonFollowUpsCount = soonClientFollowUpsResult.count ?? 0;
  // Card turns warning if any follow-up is due within 3 days
  const followUpCardTone: "warning" | "neutral" = soonFollowUpsCount > 0 ? "warning" : "neutral";

  // Priority: upcoming departures + new quote requests + payment requests + final payments due soon
  const urgentOpsItems =
    Number(departuresResult.count ?? 0) +
    Number(newQuoteRequestsResult.count ?? 0) +
    Number(paymentRequestsResult.count ?? 0) +
    finalPaymentsDue21.length;

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle={`Operations overview · ${today.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`}
    >
      {/* ── Command Center banner ── */}
      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
              Cozy Concierge Command Center
            </p>
            <h2 style={{ margin: "6px 0 0" }}>Today&apos;s Priority Work</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Start with final payments due soon, unread private messages, and upcoming departures.
            </p>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/trips" className="btn btn-primary">Final Payments</Link>
            <Link href="/admin/messages?type=private" className="btn btn-primary">Private Messages</Link>
            <Link href="/admin/trips" className="btn btn-primary">Trips</Link>
          </div>
        </div>

        <div className="grid grid-3">
          <OpsHighlightCard
            title="Priority Items"
            value={urgentOpsItems}
            helper="Final payments due, new requests, payment requests, and upcoming departures"
            href="/admin/trips"
            tone={urgentOpsItems > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Final Payments Due (21 Days)"
            value={finalPaymentsDue21.length}
            helper={`${formatMoney(finalPaymentsDue21Total)} total outstanding`}
            href="/admin/trips"
            tone={finalPaymentsDue21.length > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Upcoming Departures"
            value={departuresResult.count ?? 0}
            helper="Trips departing in the next 14 days"
            href="/admin/trips"
            tone={(departuresResult.count ?? 0) > 0 ? "neutral" : "good"}
          />
        </div>
      </div>

      {/* ── Summary grid ── */}
      <div className="grid grid-3">
        <SummaryCard
          title="Final Payments Due Soon"
          value={finalPaymentsDue21.length}
          subtitle={`${formatMoney(finalPaymentsDue21Total)} due in 21 days`}
          href="/admin/trips"
          tone={finalPaymentsDue21.length > 0 ? "warning" : "neutral"}
        />
        {/* Open Follow-Ups turns orange when any are due within 3 days */}
        <SummaryCard
          title="Open Follow-Ups"
          value={openFollowUpsCount}
          subtitle={
            soonFollowUpsCount > 0
              ? `${soonFollowUpsCount} due within 3 days`
              : "Client notes still open"
          }
          href="/admin/clients"
          tone={followUpCardTone}
        />
        <SummaryCard
          title="Private Messages"
          value={unreadPrivateCount}
          subtitle={`${openMessageThreadsResult.count ?? 0} open thread${(openMessageThreadsResult.count ?? 0) === 1 ? "" : "s"} total`}
          href="/admin/messages?type=private"
          tone={unreadPrivateCount > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          title="New Travel Requests"
          value={newQuoteRequestsResult.count ?? 0}
          subtitle="Waiting for review"
          href="/admin/quote-requests"
        />
        <SummaryCard
          title="Payment Requests"
          value={paymentRequestsResult.count ?? 0}
          subtitle="New, pending, or sent"
          href="/admin/payment-requests"
        />
        <SummaryCard
          title="Trips Departing Soon"
          value={departuresResult.count ?? 0}
          subtitle="Next 14 days"
          href="/admin/trips"
        />
      </div>

      {/* ── 1. Final Payments Due in 21 Days ── */}
      <div className="card stack">
        <SectionTitle title="Final Payments Due in 21 Days" href="/admin/trips" linkLabel="View All Trips" />
        {finalPaymentsDue21Result.error ? (
          <pre>{JSON.stringify(finalPaymentsDue21Result.error, null, 2)}</pre>
        ) : finalPaymentsDue21.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No final payments due in the next 21 days.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {finalPaymentsDue21.map((trip) => (
              <CompactListItem
                key={trip.id}
                title={trip.trip_name ?? "Trip"}
                subtitle={`${formatMoney(trip.balance_due)} due ${formatDate(trip.final_payment_due_date)} · Departing ${formatDate(trip.departure_date)}`}
                href={`/admin/trips/${trip.id}`}
                cta="Open Trip"
                tone="warning"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Private Messages ── */}
      <div className="card stack">
        <SectionTitle title="Private Client Messages" href="/admin/messages?type=private" linkLabel="Open Message Inbox" />
        {privateMessageThreadsResult.error ? (
          <pre>{JSON.stringify(privateMessageThreadsResult.error, null, 2)}</pre>
        ) : privateMessageThreads.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No open private messages.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {privateMessageThreads.map((thread) => {
              const client = getClientFromMessageThread(thread);
              const trip = getTripFromMessageThread(thread);
              const hasUnread = Number(thread.admin_unread_count ?? 0) > 0;
              return (
                <CompactListItem
                  key={thread.id}
                  title={getMessageClientDisplayName(thread)}
                  subtitle={`${thread.subject}${trip?.trip_name ? ` · ${trip.trip_name}` : ""} · Last message ${formatDateTime(thread.last_message_at)}`}
                  href={`/admin/messages?threadId=${thread.id}&type=private`}
                  cta="Open Thread"
                  tone={hasUnread ? "warning" : "neutral"}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {hasUnread ? <StatusBadge status={`${thread.admin_unread_count} unread`} /> : null}
                    <PriorityBadge priority={thread.priority} />
                    {client?.id ? (
                      <Link href={`/admin/clients/${client.id}`} style={{ fontSize: 13 }}>Client</Link>
                    ) : null}
                    {trip?.id ? (
                      <Link href={`/admin/trips/${trip.id}`} style={{ fontSize: 13 }}>Trip</Link>
                    ) : null}
                  </div>
                </CompactListItem>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Client Follow-Ups ── */}
      <div className="card stack">
        <SectionTitle title="Upcoming Client Follow-Ups" href="/admin/clients" linkLabel="View Clients" />
        {upcomingClientFollowUpsResult.error ? (
          <pre>{JSON.stringify(upcomingClientFollowUpsResult.error, null, 2)}</pre>
        ) : upcomingClientFollowUps.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No client follow-ups due in the next 7 days.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {upcomingClientFollowUps.map((followUp) => {
              const client = getClientFromFollowUp(followUp);
              const isDueSoon =
                Boolean(followUp.follow_up_date) && followUp.follow_up_date! <= in3DaysStr;
              return (
                <CompactListItem
                  key={followUp.id}
                  title={getClientDisplayName(followUp)}
                  subtitle={`${followUp.title ?? followUp.note_type} · ${formatDate(followUp.follow_up_date)}`}
                  href={client?.id ? `/admin/clients/${client.id}` : undefined}
                  cta="Open Client"
                  tone={isDueSoon ? "warning" : "neutral"}
                >
                  <div style={{ marginTop: 6 }}>
                    <FollowUpBadge isUpcoming={isDueSoon} />
                  </div>
                </CompactListItem>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Upcoming Departures ── */}
      <div className="card stack">
        <SectionTitle title="Upcoming Departures" href="/admin/trips" linkLabel="View Trips" />
        {upcomingDeparturesResult.error ? (
          <pre>{JSON.stringify(upcomingDeparturesResult.error, null, 2)}</pre>
        ) : upcomingDepartures.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No upcoming departures.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {upcomingDepartures.map((trip) => (
              <CompactListItem
                key={trip.id}
                title={trip.trip_name ?? "Trip"}
                subtitle={`${trip.destinations ?? "Not set"} · ${formatDate(trip.departure_date)} to ${formatDate(trip.return_date)}`}
                href={`/admin/trips/${trip.id}`}
                cta="Open Trip"
              >
                <div style={{ marginTop: 6 }}>
                  <StatusBadge status={trip.trip_status} />
                </div>
              </CompactListItem>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
