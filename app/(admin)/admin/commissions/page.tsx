import Link from "next/link";
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

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
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

const statusColors: Record<string, { background: string; color: string }> = {
  expected:   { background: "#fff7ed", color: "#c2410c" },
  pending:    { background: "#fff7ed", color: "#c2410c" },
  invoiced:   { background: "#e6f0fb", color: "#185fa5" },
  partial:    { background: "#f5f3ff", color: "#6d28d9" },
  received:   { background: "#ecfdf3", color: "#027a48" },
  cancelled:  { background: "#fff1f2", color: "#be123c" },
  disputed:   { background: "#fff1f2", color: "#be123c" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "expected";
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
      background: colors.background, color: colors.color,
    }}>
      {label}
    </span>
  );
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/admin/commissions"
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        name="q"
        type="search"
        placeholder="Search by client, trip, supplier, booking number, status..."
        defaultValue={defaultValue}
        className="input"
        style={{ flex: "1 1 320px", minWidth: 260 }}
      />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? (
        <Link href="/admin/commissions" className="btn btn-primary">Clear</Link>
      ) : null}
    </form>
  );
}

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searchTerm = String(q ?? "").trim();

  const { supabase } = await requireAdmin();

  const { data: commissions, error } = await supabase
    .from("commissions")
    .select("id, commission_name, booking_number, supplier_name_snapshot, client_name_snapshot, trip_name_snapshot, gross_booking_amount, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <PageShell title="Commissions" subtitle="Track expected and received agency commissions.">
        <div className="card">
          <p><strong>Error loading commissions:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const allRows = (commissions ?? []) as CommissionRow[];
  const rows = allRows.filter((commission) => commissionMatchesSearch(commission, searchTerm));

  const expectedTotal = rows.reduce((sum, c) => sum + Number(c.expected_commission_amount ?? 0), 0);
  const receivedTotal = rows.reduce((sum, c) => sum + Number(c.received_commission_amount ?? 0), 0);
  const outstandingTotal = expectedTotal - receivedTotal;

  return (
    <PageShell title="Commissions" subtitle="Track expected and received agency commissions.">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, color: "#64748b" }}>
          Showing {rows.length} of {allRows.length} commission record{allRows.length === 1 ? "" : "s"}.
        </p>
        <Link href="/admin/commissions/new" className="btn btn-primary">
          Add New Commission
        </Link>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Expected</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{formatMoney(expectedTotal)}</p>
        </div>
        <div className="card">
          <span className="label">Received</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{formatMoney(receivedTotal)}</p>
        </div>
        <div className="card">
          <span className="label">Outstanding</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{formatMoney(outstandingTotal)}</p>
        </div>
      </div>

      <div className="card stack">
        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            {searchTerm
              ? "No commissions found. Try clearing the search or using a broader term."
              : "No commission records yet. Add commissions to track expected payments, received amounts, and booking numbers."}
          </p>
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
                  <th>Expected Date</th>
                  <th>Received Date</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((commission) => (
                  <tr key={commission.id}>
                    <td>{commission.commission_name}</td>
                    <td>{commission.client_name_snapshot ?? "—"}</td>
                    <td>{commission.trip_name_snapshot ?? "—"}</td>
                    <td>{commission.supplier_name_snapshot ?? "—"}</td>
                    <td>{commission.booking_number ?? "—"}</td>
                    <td><StatusBadge status={commission.commission_status} /></td>
                    <td>{formatMoney(commission.expected_commission_amount)}</td>
                    <td>{formatMoney(commission.received_commission_amount)}</td>
                    <td>{formatDate(commission.expected_payment_date)}</td>
                    <td>{formatDate(commission.received_payment_date)}</td>
                    <td>
                      <Link
                        href={`/admin/commissions/${commission.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "5px 12px" }}
                      >
                        Open
                      </Link>
                    </td>
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