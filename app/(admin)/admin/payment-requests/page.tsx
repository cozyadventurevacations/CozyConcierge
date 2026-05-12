import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type PaymentRequestRow = {
  id: string;
  status: string | null;
  requested_amount: number | null;
  requested_payment_date: string | null;
  requested_at: string | null;
  trip_id: string | null;
  client_account_id: string | null;
  trips: { trip_name: string | null }[] | { trip_name: string | null } | null;
  client_accounts: { first_name: string | null; last_name: string | null }[] | { first_name: string | null; last_name: string | null } | null;
};

type PaymentFilter = "all" | "new" | "open" | "sent" | "paid" | "closed";

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function normalizeStatus(value: string | null | undefined) {
  return (value || "new").toLowerCase();
}

function isClosed(row: PaymentRequestRow) {
  return ["completed", "paid", "cancelled", "declined"].includes(normalizeStatus(row.status));
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function matchesFilter(row: PaymentRequestRow, filter: PaymentFilter) {
  const status = normalizeStatus(row.status);
  if (filter === "all") return true;
  if (filter === "new") return status === "new";
  if (filter === "open") return !isClosed(row);
  if (filter === "sent") return status === "sent";
  if (filter === "paid") return status === "paid" || status === "completed";
  if (filter === "closed") return status === "cancelled" || status === "declined";
  return true;
}

function getFirst<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const statusColors: Record<string, { background: string; color: string }> = {
  new: { background: "#fff7ed", color: "#c2410c" },
  pending: { background: "#fff7ed", color: "#c2410c" },
  sent: { background: "#e6f0fb", color: "#185fa5" },
  completed: { background: "#ecfdf3", color: "#027a48" },
  paid: { background: "#ecfdf3", color: "#027a48" },
  cancelled: { background: "#fff1f2", color: "#be123c" },
  declined: { background: "#fff1f2", color: "#be123c" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status || "new";
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: colors.background, color: colors.color }}>{label}</span>;
}

function SummaryCard({ label, value, helper, tone = "neutral" }: { label: string; value: string | number; helper: string; tone?: "neutral" | "warning" | "danger" | "good" }) {
  const colors = {
    neutral: { border: "#e6f0f2", background: "#ffffff", color: "var(--accent-dark)" },
    warning: { border: "#fed7aa", background: "#fff7ed", color: "#c2410c" },
    danger: { border: "#fecaca", background: "#fff1f2", color: "#be123c" },
    good: { border: "#bbf7d0", background: "#ecfdf3", color: "#027a48" },
  }[tone];
  return <div className="card" style={{ border: `1px solid ${colors.border}`, background: colors.background }}><span className="label">{label}</span><p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: colors.color }}>{value}</p><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{helper}</p></div>;
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "8px 12px", fontSize: 13 }}>{children}</Link>;
}

export default async function AdminPaymentRequestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const activeFilter = (["all", "new", "open", "sent", "paid", "closed"].includes(String(rawFilter)) ? rawFilter : "all") as PaymentFilter;
  const { supabase } = await requireAdmin();

  const { data: paymentRequests, error } = await supabase
    .from("payment_requests")
    .select(`
      id, status, requested_amount, requested_payment_date, requested_at, trip_id, client_account_id,
      trips!payment_requests_trip_id_fkey (trip_name),
      client_accounts!payment_requests_client_account_id_fkey (first_name, last_name)
    `)
    .order("requested_at", { ascending: false });

  if (error) {
    return <PageShell title="Payment Requests" subtitle="Review payment link requests and keep payments moving."><div className="card"><p><strong>Error loading payment requests:</strong></p><pre>{JSON.stringify(error, null, 2)}</pre></div></PageShell>;
  }

  const allRows = (paymentRequests ?? []) as PaymentRequestRow[];
  const rows = allRows.filter((row) => matchesFilter(row, activeFilter));
  const newRows = allRows.filter((row) => matchesFilter(row, "new"));
  const openRows = allRows.filter((row) => matchesFilter(row, "open"));
  const pastDueRows = openRows.filter((row) => isPastDue(row.requested_payment_date));
  const openTotal = openRows.reduce((sum, row) => sum + Number(row.requested_amount ?? 0), 0);
  const base = "/admin/payment-requests";

  return (
    <PageShell title="Payment Requests" subtitle="Review payment link requests and keep payments moving.">
      <div className="grid grid-4">
        <SummaryCard label="New Requests" value={newRows.length} helper="Need first action" tone={newRows.length > 0 ? "warning" : "neutral"} />
        <SummaryCard label="Open / Pending" value={openRows.length} helper={formatMoney(openTotal)} tone={openRows.length > 0 ? "warning" : "good"} />
        <SummaryCard label="Past Due" value={pastDueRows.length} helper="Payment date has passed" tone={pastDueRows.length > 0 ? "danger" : "good"} />
        <SummaryCard label="Total Requests" value={allRows.length} helper="All payment requests" />
      </div>

      <div className="card stack">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <FilterLink href={base} active={activeFilter === "all"}>All</FilterLink>
          <FilterLink href={`${base}?filter=new`} active={activeFilter === "new"}>New</FilterLink>
          <FilterLink href={`${base}?filter=open`} active={activeFilter === "open"}>Open</FilterLink>
          <FilterLink href={`${base}?filter=sent`} active={activeFilter === "sent"}>Sent</FilterLink>
          <FilterLink href={`${base}?filter=paid`} active={activeFilter === "paid"}>Paid</FilterLink>
          <FilterLink href={`${base}?filter=closed`} active={activeFilter === "closed"}>Closed</FilterLink>
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No payment requests match this view.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead><tr><th>Status</th><th>Client</th><th>Trip</th><th>Amount</th><th>Date to Pay</th><th>Submitted</th><th>Open</th></tr></thead>
              <tbody>
                {rows.map((request) => {
                  const client = getFirst(request.client_accounts);
                  const trip = getFirst(request.trips);
                  const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "-" : "-";
                  const tripName = trip?.trip_name ?? "-";
                  const pastDue = !isClosed(request) && isPastDue(request.requested_payment_date);
                  return (
                    <tr key={request.id} style={{ background: pastDue ? "#fff7ed" : undefined }}>
                      <td><StatusBadge status={request.status} /></td>
                      <td><strong>{clientName}</strong></td>
                      <td>{tripName}</td>
                      <td>{formatMoney(request.requested_amount)}</td>
                      <td><span style={{ color: pastDue ? "#c2410c" : undefined, fontWeight: pastDue ? 800 : undefined }}>{formatDate(request.requested_payment_date)}</span>{pastDue ? <span style={{ display: "block", color: "#c2410c", fontSize: 12, fontWeight: 800 }}>Past due</span> : null}</td>
                      <td>{formatDateTime(request.requested_at)}</td>
                      <td><Link href={`/admin/payment-requests/${request.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
