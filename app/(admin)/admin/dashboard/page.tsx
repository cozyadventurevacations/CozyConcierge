import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  deposit_due_date?: string | null;
  deposit_paid?: boolean | null;
  balance_due?: number | null;
  deposit_amount?: number | null;
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

type QuoteRequestRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  destinations: string | null;
  departure_date: string | null;
  travel_types_requested: string[] | null;
  status: string | null;
  created_at: string | null;
};

type CruisePriceWatchResultRow = {
  id: string;
  trip_id: string;
  component_id: string;
  cruise_line: string | null;
  ship_name: string | null;
  cabin_match_code: string | null;
  booked_total: number | null;
  found_total: number | null;
  savings_amount: number | null;
  promo_codes: string | null;
  status: string | null;
  public_url: string | null;
  checked_at: string | null;
  message: string | null;
  trips:
    | { id: string; trip_name: string | null }
    | { id: string; trip_name: string | null }[]
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

function getTripFromCruisePriceWatch(row: CruisePriceWatchResultRow) {
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
  const border = tone === "warning" ? "1px solid #fdba74" : "1px solid #dbeafe";
  const accent = tone === "warning" ? "#c2410c" : "#123f5b";

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        background: bg,
        border,
        borderRadius: 14,
        padding: 18,
        boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span className="label" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      <strong style={{ fontSize: "2rem", lineHeight: 1, color: accent }}>{value}</strong>
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
    neutral: { background: "#ffffff", border: "1px solid #dbeafe", accent: "#123f5b" },
    warning: { background: "#fff7ed", border: "1px solid #fdba74", accent: "#c2410c" },
    danger: { background: "#fff1f2", border: "1px solid #fecdd3", accent: "#be123c" },
    good: { background: "#f0fdf4", border: "1px solid #bbf7d0", accent: "#027a48" },
  }[tone];

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        background: styles.background,
        border: styles.border,
        borderRadius: 16,
        padding: 18,
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 10,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
      }}
    >
      <span className="label" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      <strong style={{ fontSize: "2.35rem", lineHeight: 1, color: styles.accent }}>{value}</strong>
      <span style={{ color: "#64748b", lineHeight: 1.45 }}>{helper}</span>
    </Link>
  );
}

function SectionTitle({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>
          Work Queue
        </p>
        <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{title}</h2>
      </div>
      <Link href={href} className="btn btn-outline" style={{ fontSize: 13, padding: "8px 12px" }}>{linkLabel}</Link>
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
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "14px 16px",
        border: "1px solid #e6f0f2",
        borderRadius: 14,
        background: tone === "warning" ? "#fff7ed" : "#ffffff",
        gap: 12,
        flexWrap: "wrap",
        boxShadow: tone === "warning" ? "0 10px 24px rgba(194, 65, 12, 0.08)" : "0 8px 20px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ minWidth: 240, flex: "1 1 360px" }}>
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

async function quickReplyFromDashboard(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId) throw new Error("Missing thread ID.");
  if (!body) throw new Error("Message is required.");

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, status, thread_type, client_unread_count")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Message thread not found.");
  }

  if (thread.thread_type !== "private") {
    throw new Error("Dashboard quick replies are only available for private threads.");
  }

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: threadId,
    client_account_id: thread.client_account_id,
    trip_id: thread.trip_id,
    sender_type: "admin",
    audience: "private",
    body,
    is_read_by_admin: true,
    is_read_by_client: false,
  });

  if (messageError) throw new Error(messageError.message);

  const { error: updateError } = await supabase
    .from("message_threads" as any)
    .update({
      status: thread.status === "archived" ? "open" : thread.status,
      client_unread_count: Number(thread.client_unread_count ?? 0) + 1,
      admin_unread_count: 0,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/messages");
  redirect("/admin/dashboard?quickReply=sent");
}

async function deleteCruisePriceWatchNotification(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const resultId = String(formData.get("result_id") ?? "").trim();

  if (!resultId) throw new Error("Missing cruise price watch notification ID.");

  const { error } = await supabase
    .from("cruise_price_watch_results" as any)
    .delete()
    .eq("id", resultId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/dashboard");
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ quickReply?: string }>;
}) {
  const { quickReply } = await searchParams;
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
    depositsDue21Result,
    finalPaymentsDue21Result,
    upcomingClientFollowUpsResult,
    openClientFollowUpsResult,
    soonClientFollowUpsResult,
    openMessageThreadsResult,
    unreadPrivateMessageThreadsResult,
    privateMessageThreadsResult,
    deletionRequestsResult,
    cruisePriceWatchResultsResult,
    newQuoteRequestsListResult,
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
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, deposit_due_date, deposit_amount, deposit_paid")
      .eq("deposit_paid", false)
      .gte("deposit_due_date", todayStr)
      .lte("deposit_due_date", in21DaysStr)
      .order("deposit_due_date", { ascending: true })
      .limit(10),
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, final_payment_due_date, balance_due")
      .gte("final_payment_due_date", todayStr)
      .lte("final_payment_due_date", in21DaysStr)
      .gt("balance_due", 0)
      .order("final_payment_due_date", { ascending: true })
      .limit(10),
    supabase
      .from("client_notes")
      .select("id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)")
      .eq("is_completed", false)
      .gte("follow_up_date", todayStr)
      .lte("follow_up_date", in7DaysStr)
      .order("follow_up_date", { ascending: true })
      .limit(8),
    supabase
      .from("client_notes")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false),
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
    supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .eq("thread_type", "private")
      .gt("admin_unread_count", 0),
    supabase
      .from("message_threads")
      .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at, client_accounts!message_threads_client_account_id_fkey(id, first_name, last_name, email, preferred_name), trips(id, trip_name, destinations, departure_date)")
      .eq("status", "open")
      .eq("thread_type", "private")
      .order("admin_unread_count", { ascending: false })
      .order("last_message_at", { ascending: false })
      .limit(8),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .not("deletion_requested_at", "is", null)
      .is("deleted_at", null),
    supabase
      .from("cruise_price_watch_results" as any)
      .select("id, trip_id, component_id, cruise_line, ship_name, cabin_match_code, booked_total, found_total, savings_amount, promo_codes, status, public_url, checked_at, message, trips(id, trip_name)")
      .in("status", ["lower_price_found", "manual_review", "error"])
      .order("checked_at", { ascending: false })
      .limit(6),
    supabase
      .from("quote_requests")
      .select("id, full_name, email, destinations, departure_date, travel_types_requested, status, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const upcomingDepartures = (upcomingDeparturesResult.data ?? []) as TripRow[];
  const depositsDue21 = (depositsDue21Result.data ?? []) as TripRow[];
  const finalPaymentsDue21 = (finalPaymentsDue21Result.data ?? []) as TripRow[];
  const upcomingClientFollowUps = (upcomingClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];
  const privateMessageThreads = (privateMessageThreadsResult.data ?? []) as MessageThreadRow[];
  const newQuoteRequestsList = (newQuoteRequestsListResult.data ?? []) as QuoteRequestRow[];
  const cruisePriceWatchResults =
    (cruisePriceWatchResultsResult.data ?? []) as CruisePriceWatchResultRow[];
  const cruiseLowerPriceCount = cruisePriceWatchResults.filter(
    (row) => row.status === "lower_price_found",
  ).length;
  const cruiseReviewCount = cruisePriceWatchResults.filter(
    (row) => row.status === "manual_review" || row.status === "error",
  ).length;
  const cruiseWatchAttentionCount = cruiseLowerPriceCount + cruiseReviewCount;

  const finalPaymentsDue21Total = finalPaymentsDue21.reduce(
    (sum, trip) => sum + Number(trip.balance_due ?? 0),
    0,
  );
  const depositsDue21Total = depositsDue21.reduce(
    (sum, trip) => sum + Number(trip.deposit_amount ?? 0),
    0,
  );

  const unreadPrivateCount = unreadPrivateMessageThreadsResult.count ?? 0;
  const openFollowUpsCount = openClientFollowUpsResult.count ?? 0;
  const soonFollowUpsCount = soonClientFollowUpsResult.count ?? 0;
  const deletionRequestCount = deletionRequestsResult.count ?? 0;
  const followUpCardTone: "warning" | "neutral" = soonFollowUpsCount > 0 ? "warning" : "neutral";
  const finalPaymentsHref =
    finalPaymentsDue21.length === 1
      ? `/admin/trips/${finalPaymentsDue21[0].id}`
      : "/admin/dashboard#final-payments-due";
  const tripRemindersHref =
    depositsDue21.length + finalPaymentsDue21.length === 1
      ? `/admin/trips/${[...depositsDue21, ...finalPaymentsDue21][0].id}#advisor-reminders`
      : "/admin/trip-reminders";
  const privateMessagesHref =
    privateMessageThreads.length === 1
      ? `/admin/messages?threadId=${privateMessageThreads[0].id}&type=private`
      : "/admin/dashboard#private-client-messages";
  const followUpsHref =
    upcomingClientFollowUps.length === 1 && getClientFromFollowUp(upcomingClientFollowUps[0])?.id
      ? `/admin/clients/${getClientFromFollowUp(upcomingClientFollowUps[0])!.id}`
      : "/admin/dashboard#client-follow-ups";
  const upcomingDeparturesHref =
    upcomingDepartures.length === 1
      ? `/admin/trips/${upcomingDepartures[0].id}`
      : "/admin/dashboard#upcoming-departures";

  const urgentOpsItems =
    Number(departuresResult.count ?? 0) +
    Number(newQuoteRequestsResult.count ?? 0) +
    Number(paymentRequestsResult.count ?? 0) +
    depositsDue21.length +
    finalPaymentsDue21.length +
    deletionRequestCount +
    cruiseWatchAttentionCount;

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle={`Operations overview - ${today.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`}
    >
      {quickReply === "sent" ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Quick reply sent.</p>
        </div>
      ) : null}

      {/* Command Center banner */}
      <div
        style={{
          border: "1px solid #dbeafe",
          borderRadius: 18,
          padding: 22,
          background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 62%, #fff7ed 100%)",
          boxShadow: "0 18px 46px rgba(15, 23, 42, 0.08)",
          display: "grid",
          gap: 18,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
              Cozy Concierge Command Center
            </p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28, lineHeight: 1.15 }}>Today&apos;s Priority Work</h2>
            <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6, maxWidth: 660 }}>
              Start with final payments due soon, cruise price alerts, deletion requests, unread private messages, and upcoming departures.
            </p>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/trips" className="btn btn-primary">Final Payments</Link>
            <Link href="/admin/dashboard#cruise-price-watch" className="btn btn-outline">Cruise Price Watch</Link>
            <Link href="/admin/trips?filter=deletion-requested#deletion-requests" className="btn btn-outline">Deletion Requests</Link>
            <Link href="/admin/messages?type=private" className="btn btn-primary">Private Messages</Link>
          </div>
        </div>

        <div className="grid grid-3">
          <OpsHighlightCard
            title="Priority Items"
            value={urgentOpsItems}
            helper="Final payments, cruise alerts, deletion requests, new requests, payment requests, and upcoming departures"
            href="/admin/dashboard#cruise-price-watch"
            tone={urgentOpsItems > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Final Payments Due (21 Days)"
            value={finalPaymentsDue21.length}
            helper={`${formatMoney(finalPaymentsDue21Total)} total outstanding`}
            href={finalPaymentsHref}
            tone={finalPaymentsDue21.length > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Deletion Requests"
            value={deletionRequestCount}
            helper="Client requested trip removal"
            href="/admin/trips?filter=deletion-requested#deletion-requests"
            tone={deletionRequestCount > 0 ? "warning" : "good"}
          />
          <OpsHighlightCard
            title="Cruise Price Watch"
            value={cruiseWatchAttentionCount}
            helper={`${cruiseLowerPriceCount} lower price${cruiseLowerPriceCount === 1 ? "" : "s"}, ${cruiseReviewCount} review item${cruiseReviewCount === 1 ? "" : "s"}`}
            href="/admin/dashboard#cruise-price-watch"
            tone={cruiseLowerPriceCount > 0 ? "warning" : cruiseReviewCount > 0 ? "danger" : "good"}
          />
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-3">
        <SummaryCard
          title="Trip Reminders"
          value={depositsDue21.length + finalPaymentsDue21.length}
          subtitle={`${formatMoney(depositsDue21Total + finalPaymentsDue21Total)} due within 21 days`}
          href={tripRemindersHref}
          tone={depositsDue21.length + finalPaymentsDue21.length > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          title="Final Payments Due Soon"
          value={finalPaymentsDue21.length}
          subtitle={`${formatMoney(finalPaymentsDue21Total)} due in 21 days`}
          href={finalPaymentsHref}
          tone={finalPaymentsDue21.length > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          title="Open Follow-Ups"
          value={openFollowUpsCount}
          subtitle={
            soonFollowUpsCount > 0
              ? `${soonFollowUpsCount} due within 3 days`
              : "Client notes still open"
          }
          href={followUpsHref}
          tone={followUpCardTone}
        />
        <SummaryCard
          title="Private Messages"
          value={unreadPrivateCount}
          subtitle={`${openMessageThreadsResult.count ?? 0} open thread${(openMessageThreadsResult.count ?? 0) === 1 ? "" : "s"} total`}
          href={privateMessagesHref}
          tone={unreadPrivateCount > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          title="New Travel Requests"
          value={newQuoteRequestsResult.count ?? 0}
          subtitle="Waiting for review"
          href="/admin/quote-requests"
          tone={(newQuoteRequestsResult.count ?? 0) > 0 ? "warning" : "neutral"}
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
          href={upcomingDeparturesHref}
        />
        <SummaryCard
          title="Cruise Price Watch"
          value={cruiseWatchAttentionCount}
          subtitle={`${cruiseLowerPriceCount} price drop${cruiseLowerPriceCount === 1 ? "" : "s"} found`}
          href="/admin/dashboard#cruise-price-watch"
          tone={cruiseWatchAttentionCount > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          title="Deletion Requests"
          value={deletionRequestCount}
          subtitle="Waiting for admin review"
          href="/admin/trips?filter=deletion-requested#deletion-requests"
          tone={deletionRequestCount > 0 ? "warning" : "neutral"}
        />
      </div>

      <div id="cruise-price-watch" className="card stack">
        <SectionTitle
          title="Cruise Price Watch"
          href="/admin/trips"
          linkLabel="Open Trips"
        />
        {cruisePriceWatchResultsResult.error ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            Cruise price alerts need a database setup step before they can be used.
          </p>
        ) : cruisePriceWatchResults.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No cruise price alerts or review items.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {cruisePriceWatchResults.map((result) => {
              const trip = getTripFromCruisePriceWatch(result);
              const tripName = trip?.trip_name ?? "Trip";
              const isLowerPrice = result.status === "lower_price_found";
              const savings = Number(result.savings_amount ?? 0);
              const bookedTotal = Number(result.booked_total ?? 0);
              const foundTotal = Number(result.found_total ?? 0);

              return (
                <CompactListItem
                  key={result.id}
                  title={isLowerPrice ? `${tripName}: lower cruise price found` : `${tripName}: cruise price needs review`}
                  subtitle={`${result.cruise_line ?? "Cruise"}${result.ship_name ? ` - ${result.ship_name}` : ""} · Cabin ${result.cabin_match_code ?? "not set"} · Checked ${formatDateTime(result.checked_at)}`}
                  href={`/admin/trips/${result.trip_id}#cruise-component`}
                  cta="Open Cruise"
                  tone={isLowerPrice ? "warning" : "neutral"}
                >
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <StatusBadge status={String(result.status ?? "review").replace(/_/g, " ")} />
                      {isLowerPrice ? (
                        <span
                          style={{
                            borderRadius: 999,
                            padding: "5px 10px",
                            background: "#dcfce7",
                            color: "#166534",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          Save {formatMoney(savings)}
                        </span>
                      ) : null}
                      <form action={deleteCruisePriceWatchNotification}>
                        <input type="hidden" name="result_id" value={result.id} />
                        <button
                          type="submit"
                          className="btn btn-outline"
                          style={{ fontSize: 13, padding: "5px 10px" }}
                        >
                          Delete Notification
                        </button>
                      </form>
                    </div>
                    <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>
                      Booked: {bookedTotal > 0 ? formatMoney(bookedTotal) : "not saved"} · Found: {foundTotal > 0 ? formatMoney(foundTotal) : "not confirmed"}
                      {result.promo_codes ? ` · Promo codes: ${result.promo_codes}` : ""}
                    </p>
                    {result.message ? (
                      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>{result.message}</p>
                    ) : null}
                  </div>
                </CompactListItem>
              );
            })}
          </div>
        )}
      </div>

      {/* New Travel Requests work queue */}
      <div className="card stack">
        <SectionTitle
          title="New Travel Requests"
          href="/admin/quote-requests"
          linkLabel="View All Requests"
        />
        {newQuoteRequestsListResult.error ? (
          <pre>{JSON.stringify(newQuoteRequestsListResult.error, null, 2)}</pre>
        ) : newQuoteRequestsList.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No new travel requests.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {newQuoteRequestsList.map((req) => (
              <CompactListItem
                key={req.id}
                title={req.full_name ?? "Unknown"}
                subtitle={`${req.destinations ?? "No destination"} · Departing ${formatDate(req.departure_date)} · Submitted ${formatDate(req.created_at)}`}
                href={`/admin/quote-requests/${req.id}`}
                cta="Review"
                tone="warning"
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <StatusBadge status="new" />
                  {(req.travel_types_requested ?? []).slice(0, 3).map((type) => (
                    <span
                      key={type}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "#f0f7f8",
                        color: "var(--accent-dark)",
                        fontWeight: 700,
                      }}
                    >
                      {type.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </CompactListItem>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* Final Payments Due in 21 Days */}
        <div id="final-payments-due" className="card stack">
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
                  subtitle={`${formatMoney(trip.balance_due)} due ${formatDate(trip.final_payment_due_date)} - Departing ${formatDate(trip.departure_date)}`}
                  href={`/admin/trips/${trip.id}`}
                  cta="Open Trip"
                  tone="warning"
                />
              ))}
            </div>
          )}
        </div>

        {/* Private Messages */}
        <div id="private-client-messages" className="card stack">
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
                    subtitle={`${thread.subject}${trip?.trip_name ? ` - ${trip.trip_name}` : ""} - Last message ${formatDateTime(thread.last_message_at)}`}
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
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", color: "var(--accent-dark)", fontSize: 13, fontWeight: 800 }}>
                        Quick reply
                      </summary>
                      <div className="stack" style={{ marginTop: 8, gap: 8 }}>
                        <form action={quickReplyFromDashboard} className="stack" style={{ gap: 8 }}>
                          <input type="hidden" name="thread_id" value={thread.id} />
                          <textarea
                            className="textarea"
                            name="body"
                            rows={3}
                            placeholder="Write a quick reply..."
                            style={{ minHeight: 90 }}
                          />
                          <div className="row" style={{ gap: 8 }}>
                            <button type="submit" className="btn btn-primary" style={{ fontSize: 13, padding: "7px 12px" }}>
                              Send Reply
                            </button>
                          </div>
                        </form>
                        <div className="row" style={{ gap: 8 }}>
                          <form action={quickReplyFromDashboard}>
                            <input type="hidden" name="thread_id" value={thread.id} />
                            <input type="hidden" name="body" value="Thank you for the message. I am reviewing this and will follow up shortly." />
                            <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>
                              Reviewing
                            </button>
                          </form>
                          <form action={quickReplyFromDashboard}>
                            <input type="hidden" name="thread_id" value={thread.id} />
                            <input type="hidden" name="body" value="Thanks for the update. I have this noted on your trip file." />
                            <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>
                              Noted
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>
                  </CompactListItem>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* Client Follow-Ups */}
        <div id="client-follow-ups" className="card stack">
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
                    subtitle={`${followUp.title ?? followUp.note_type} - ${formatDate(followUp.follow_up_date)}`}
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

        {/* Upcoming Departures */}
        <div id="upcoming-departures" className="card stack">
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
                  subtitle={`${trip.destinations ?? "Not set"} - ${formatDate(trip.departure_date)} to ${formatDate(trip.return_date)}`}
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
      </div>
    </PageShell>
  );
}
