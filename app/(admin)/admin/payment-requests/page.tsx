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
  trips:
    | { trip_name: string | null }[]
    | null;
  client_accounts:
    | { first_name: string | null; last_name: string | null }[]
    | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const statusColors: Record<string, { background: string; color: string }> = {
  new:        { background: "#fff7ed", color: "#c2410c" },
  pending:    { background: "#fff7ed", color: "#c2410c" },
  sent:       { background: "#e6f0fb", color: "#185fa5" },
  completed:  { background: "#ecfdf3", color: "#027a48" },
  paid:       { background: "#ecfdf3", color: "#027a48" },
  cancelled:  { background: "#fff1f2", color: "#be123c" },
  declined:   { background: "#fff1f2", color: "#be123c" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status || "new";
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

export default async function AdminPaymentRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: paymentRequests, error } = await supabase
    .from("payment_requests")
    .select(`
      id,
      status,
      requested_amount,
      requested_payment_date,
      requested_at,
      trip_id,
      client_account_id,
      trips!payment_requests_trip_id_fkey (
        trip_name
      ),
      client_accounts!payment_requests_client_account_id_fkey (
        first_name,
        last_name
      )
    `)
    .order("requested_at", { ascending: false });

  if (error) {
    return (
      <PageShell title="Payment Requests" subtitle="Review payment link requests and keep payments moving.">
        <div className="card">
          <p><strong>Error loading payment requests:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = (paymentRequests ?? []) as PaymentRequestRow[];

  const newRequestsCount = rows.filter((r) => r.status === "new").length;
  const pendingRequestsCount = rows.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled" && r.status !== "declined" && r.status !== "paid"
  ).length;

  return (
    <PageShell title="Payment Requests" subtitle="Review payment link requests and keep payments moving.">
      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Requests</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{rows.length}</p>
        </div>
        <div className="card">
          <span className="label">New Requests</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{newRequestsCount}</p>
        </div>
        <div className="card">
          <span className="label">Open / Pending</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{pendingRequestsCount}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b" }}>No payment requests found yet.</p>
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Client</th>
                <th>Trip</th>
                <th>Amount</th>
                <th>Date to Pay</th>
                <th>Submitted</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const client = request.client_accounts?.[0];
                const trip = request.trips?.[0];
                const clientName = client
                  ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—"
                  : "—";
                const tripName = trip?.trip_name ?? "—";

                return (
                  <tr key={request.id}>
                    <td><StatusBadge status={request.status} /></td>
                    <td>{clientName}</td>
                    <td>{tripName}</td>
                    <td>{formatMoney(request.requested_amount)}</td>
                    <td>{formatDate(request.requested_payment_date)}</td>
                    <td>{formatDateTime(request.requested_at)}</td>
                    <td>
                      <Link href={`/admin/payment-requests/${request.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}