import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type CommissionRow = {
  id: string;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  client_name_snapshot: string | null;
  trip_name_snapshot: string | null;
  gross_booking_amount: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
  created_at: string | null;
};

type CommissionFilter = "all" | "expected" | "overdue" | "outstanding" | "received";

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "expected").toLowerCase();
}

function outstandingAmount(commission: CommissionRow) {
  return Math.max(0, Number(commission.expected_commission_amount ?? 0) - Number(commission.received_commission_amount ?? 0));
}

function isReceived(commission: CommissionRow) {
  const status = normalizeStatus(commission.commission_status);
  return status === "received" || outstandingAmount(commission) <= 0;
}

function isOverdueCommission(commission: CommissionRow) {
  return !isReceived(commission) && isPastDue(commission.expected_payment_date);
}

function commissionMatchesSearch(commission: CommissionRow, searchTerm: string) {
  if (!searchTerm) return true;
  const haystack = [
    commission.commission_name,
    commission.booking_number,
    commission.supplier_name_snapshot,
    commission.client_name_snapshot,
    commission.trip_name_snapshot,
    commission.commission_status,
    commission.expected_payment_date,
    commission.received_payment_date,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function commissionMatchesFilter(commission: CommissionRow, filter: CommissionFilter) {
  const status = normalizeStatus(commission.commission_status);
  if (filter === "all") return true;
  if (filter === "expected") return ["expected", "pending", "invoiced", "partial"].includes(status) && !isReceived(commission);
  if (filter === "overdue") return isOverdueCommission(commission);
  if (filter === "outstanding") return outstandingAmount(commission) > 0;
  if (filter === "received") return isReceived(commission);
  return true;
}

const statusColors: Record<string, { background: string; color: string }> = {
  expected: { background: "#fff7ed", color: "#c2410c" },
  pending: { background: "#fff7ed", color: "#c2410c" },
  invoiced: { background: "#e6f0fb", color: "#185fa5" },
  partial: { background: "#f5f3ff", color: "#6d28d9" },
  received: { background: "#ecfdf3", color: "#027a48" },
  cancelled: { background: "#fff1f2", color: "#be123c" },
  disputed: { background: "#fff1f2", color: "#be123c" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "expected";
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: colors.background, color: colors.color }}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value, helper, tone = "neutral" }: { label: string; value: string | number; helper: string; tone?: "neutral" | "warning" | "good" | "danger" }) {
  const colors = {
    neutral: { border: "#dbeafe", background: "#ffffff", color: "var(--accent-dark)" },
    warning: { border: "#fed7aa", background: "#fff7ed", color: "#c2410c" },
    danger: { border: "#fecaca", background: "#fff1f2", color: "#be123c" },
    good: { border: "#bbf7d0", background: "#ecfdf3", color: "#027a48" },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.background,
        borderRadius: 16,
        padding: 18,
        minHeight: 132,
        boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
      }}
    >
      <span className="label" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 900, color: colors.color }}>{value}</p>
      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{helper}</p>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={active ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "8px 12px", fontSize: 13 }}>
      {children}
    </Link>
  );
}

function SearchBox({ defaultValue, filter }: { defaultValue: string; filter: CommissionFilter }) {
  return (
    <form action="/admin/commissions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="filter" value={filter} />
      <input name="q" type="search" placeholder="Search by client, trip, supplier, booking number, status..." defaultValue={defaultValue} className="input" style={{ flex: "1 1 320px", minWidth: 260 }} />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? <Link href={`/admin/commissions?filter=${filter}`} className="btn btn-outline">Clear</Link> : null}
    </form>
  );
}

async function markCommissionReceivedFromList(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const commissionId = String(formData.get("commission_id") ?? "").trim();
  if (!commissionId) throw new Error("Missing commission ID.");

  const { data: commission, error: loadError } = await supabase
    .from("commissions")
    .select("id, expected_commission_amount")
    .eq("id", commissionId)
    .single();

  if (loadError || !commission) {
    throw new Error(loadError?.message ?? "Commission not found.");
  }

  const receivedAmount = Number(commission.expected_commission_amount ?? 0);

  const { error } = await supabase
    .from("commissions")
    .update({
      commission_status: "received",
      received_commission_amount: receivedAmount,
      received_payment_date: todayDateString(),
    })
    .eq("id", commissionId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/commissions");
  revalidatePath(`/admin/commissions/${commissionId}`);
}

async function deleteCommissionFromList(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const commissionId = String(formData.get("commission_id") ?? "").trim();

  if (!commissionId) throw new Error("Missing commission ID.");

  const { error } = await supabase
    .from("commissions")
    .delete()
    .eq("id", commissionId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/commissions");
}

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter: rawFilter } = await searchParams;
  const searchTerm = String(q ?? "").trim();
  const activeFilter = (["all", "expected", "overdue", "outstanding", "received"].includes(String(rawFilter)) ? rawFilter : "all") as CommissionFilter;

  const { supabase } = await requireAdmin();

  const { data: commissions, error } = await supabase
    .from("commissions")
    .select("id, commission_name, booking_number, supplier_name_snapshot, client_name_snapshot, trip_name_snapshot, gross_booking_amount, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <PageShell title="Commissions" subtitle="Track expected and received agency commissions.">
        <div className="card"><p><strong>Error loading commissions:</strong></p><pre>{JSON.stringify(error, null, 2)}</pre></div>
      </PageShell>
    );
  }

  const allRows = (commissions ?? []) as CommissionRow[];
  const rows = allRows
    .filter((commission) => commissionMatchesFilter(commission, activeFilter))
    .filter((commission) => commissionMatchesSearch(commission, searchTerm));

  const expectedTotal = allRows.reduce((sum, c) => sum + Number(c.expected_commission_amount ?? 0), 0);
  const receivedTotal = allRows.reduce((sum, c) => sum + Number(c.received_commission_amount ?? 0), 0);
  const outstandingTotal = allRows.reduce((sum, c) => sum + outstandingAmount(c), 0);
  const overdueRows = allRows.filter(isOverdueCommission);
  const expectedThisMonth = allRows.filter((c) => {
    if (!c.expected_payment_date || isReceived(c)) return false;
    const date = new Date(`${c.expected_payment_date}T00:00:00`);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const expectedThisMonthTotal = expectedThisMonth.reduce((sum, c) => sum + outstandingAmount(c), 0);

  const base = "/admin/commissions";

  return (
    <PageShell title="Commissions" subtitle="Track expected and received agency commissions.">
      <div
        style={{
          border: "1px solid #dbeafe",
          borderRadius: 18,
          padding: 22,
          background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 66%, #fff7ed 100%)",
          boxShadow: "0 18px 46px rgba(15, 23, 42, 0.08)",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
              Commission Control
            </p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28, lineHeight: 1.15 }}>Paid and expected commissions</h2>
            <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.55, maxWidth: 680 }}>
              Showing {rows.length} of {allRows.length} commission record{allRows.length === 1 ? "" : "s"}. Focus first on overdue, outstanding, and this month&apos;s expected payments.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/admin/commissions?filter=overdue" className="btn btn-outline">Overdue</Link>
            <Link href="/admin/commissions?filter=received" className="btn btn-outline">Paid</Link>
            <Link href="/admin/commissions/new" className="btn btn-primary">Add Commission</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <SummaryCard label="Expected This Month" value={formatMoney(expectedThisMonthTotal)} helper={`${expectedThisMonth.length} open item${expectedThisMonth.length === 1 ? "" : "s"}`} tone={expectedThisMonth.length > 0 ? "warning" : "neutral"} />
        <SummaryCard label="Overdue" value={formatMoney(overdueRows.reduce((sum, c) => sum + outstandingAmount(c), 0))} helper={`${overdueRows.length} need follow-up`} tone={overdueRows.length > 0 ? "danger" : "good"} />
        <SummaryCard label="Received" value={formatMoney(receivedTotal)} helper="All-time received" tone="good" />
        <SummaryCard label="Outstanding" value={formatMoney(outstandingTotal)} helper={`${formatMoney(expectedTotal)} expected total`} tone={outstandingTotal > 0 ? "warning" : "good"} />
      </div>

      <div className="card stack">
        {overdueRows.length > 0 ? (
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
            <p style={{ margin: 0, fontWeight: 900 }}>{overdueRows.length} overdue commission item{overdueRows.length === 1 ? "" : "s"} need follow-up.</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>Use the Overdue filter to review the oldest expected payments first.</p>
          </div>
        ) : null}

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <FilterLink href={base} active={activeFilter === "all"}>All</FilterLink>
          <FilterLink href={`${base}?filter=expected`} active={activeFilter === "expected"}>Expected</FilterLink>
          <FilterLink href={`${base}?filter=overdue`} active={activeFilter === "overdue"}>Overdue</FilterLink>
          <FilterLink href={`${base}?filter=outstanding`} active={activeFilter === "outstanding"}>Outstanding</FilterLink>
          <FilterLink href={`${base}?filter=received`} active={activeFilter === "received"}>Received</FilterLink>
        </div>
        <SearchBox defaultValue={searchTerm} filter={activeFilter} />

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{searchTerm ? "No commissions found. Try clearing the search or using a broader term." : "No commission records match this view."}</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th>Commission</th>
                  <th>Client</th>
                  <th>Trip</th>
                  <th>Supplier</th>
                  <th>Booking #</th>
                  <th>Status</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Expected Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((commission) => {
                  const overdue = isOverdueCommission(commission);
                  const outstanding = outstandingAmount(commission);
                  const received = isReceived(commission);
                  return (
                    <tr key={commission.id} style={{ background: overdue ? "#fff7ed" : undefined }}>
                      <td>
                        <strong>{commission.commission_name}</strong>
                        {overdue ? (
                          <span style={{ display: "block", marginTop: 3, color: "#c2410c", fontSize: 12, fontWeight: 800 }}>Overdue follow-up</span>
                        ) : null}
                      </td>
                      <td>{commission.client_name_snapshot ?? "-"}</td>
                      <td>{commission.trip_name_snapshot ?? "-"}</td>
                      <td>{commission.supplier_name_snapshot ?? "-"}</td>
                      <td>{commission.booking_number ?? "-"}</td>
                      <td><StatusBadge status={commission.commission_status} /></td>
                      <td>{formatMoney(commission.expected_commission_amount)}</td>
                      <td>{formatMoney(commission.received_commission_amount)}</td>
                      <td style={{ fontWeight: overdue ? 900 : 700, color: overdue ? "#c2410c" : undefined }}>{formatMoney(outstanding)}</td>
                      <td>
                        <span style={{ color: overdue ? "#c2410c" : undefined, fontWeight: overdue ? 800 : undefined }}>
                          {formatDate(commission.expected_payment_date)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link href={`/admin/commissions/${commission.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>Open</Link>
                          {!received && outstanding > 0 ? (
                            <form action={markCommissionReceivedFromList}>
                              <input type="hidden" name="commission_id" value={commission.id} />
                              <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "5px 12px", color: "#027a48", borderColor: "#bbf7d0" }}>
                                Mark Paid
                              </button>
                            </form>
                          ) : null}
                          <form action={deleteCommissionFromList}>
                            <input type="hidden" name="commission_id" value={commission.id} />
                            <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "5px 12px", color: "#be123c", borderColor: "#fecaca" }}>
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
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
