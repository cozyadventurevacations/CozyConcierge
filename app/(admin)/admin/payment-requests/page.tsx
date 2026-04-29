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
    | {
        trip_name: string | null;
      }[]
    | null;
  client_accounts:
    | {
        first_name: string | null;
        last_name: string | null;
      }[]
    | null;
};

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;
  return `$${value.toFixed(2)}`;
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
      {status || "new"}
    </span>
  );
}

export default async function AdminPaymentRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: paymentRequests, error } = await supabase
    .from("payment_requests")
    .select(
      `
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
    `,
    )
    .order("requested_at", { ascending: false });

  if (error) {
    return (
      <PageShell
        title="Payment Requests"
        subtitle="Review payment link requests and keep payments moving."
      >
        <div className="card">
          <p>
            <strong>Error loading payment requests:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = (paymentRequests ?? []) as PaymentRequestRow[];

  const newRequestsCount = rows.filter(
    (request) => request.status === "new",
  ).length;

  const pendingRequestsCount = rows.filter(
    (request) =>
      request.status !== "completed" &&
      request.status !== "cancelled" &&
      request.status !== "declined",
  ).length;

  return (
    <PageShell
      title="Payment Requests"
      subtitle="Review payment link requests and keep payments moving."
    >
      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Requests</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {rows.length}
          </p>
        </div>

        <div className="card">
          <span className="label">New Requests</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {newRequestsCount}
          </p>
        </div>

        <div className="card">
          <span className="label">Open / Pending</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {pendingRequestsCount}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p>No payment requests found yet.</p>
        </div>
      ) : (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Recent Payment Requests</h2>

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
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((request) => {
                  const client = request.client_accounts?.[0];
                  const trip = request.trips?.[0];

                  const clientName = client
                    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                    : "Unknown Client";

                  const tripName = trip?.trip_name ?? "Unknown Trip";

                  return (
                    <tr key={request.id}>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>

                      <td>{clientName || "Unknown Client"}</td>

                      <td>{tripName}</td>

                      <td>{formatMoney(request.requested_amount)}</td>

                      <td>{formatDate(request.requested_payment_date)}</td>

                      <td>{formatDateTime(request.requested_at)}</td>

                      <td>
                        <a
                          href={`/admin/payment-requests/${request.id}`}
                          style={{
                            color: "var(--accent-dark)",
                            fontWeight: 700,
                          }}
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}