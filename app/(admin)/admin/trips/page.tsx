import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return value;
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);
  const today = new Date();

  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

const statusColors: Record<string, { background: string; color: string }> = {
  active: { background: "#ecfdf3", color: "#027a48" },
  confirmed: { background: "#ecfdf3", color: "#027a48" },
  completed: { background: "#e6f0fb", color: "#185fa5" },
  cancelled: { background: "#fff1f2", color: "#be123c" },
  pending: { background: "#fff7ed", color: "#c2410c" },
  inquiry: { background: "#f5f3ff", color: "#6d28d9" },
  planning: { background: "#fdf4ff", color: "#a21caf" },
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "unknown";
  const colors =
    statusColors[label.toLowerCase()] ?? {
      background: "#f0f7f8",
      color: "var(--accent-dark)",
    };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
        background: colors.background,
        color: colors.color,
      }}
    >
      {label}
    </span>
  );
}

function PaymentBadge({ trip }: { trip: TripRow }) {
  const balanceDue = Number(trip.balance_due ?? 0);
  const depositPaid = trip.deposit_paid === true;

  let label = "Balance Due";
  let background = "#fff7ed";
  let color = "#c2410c";

  if (balanceDue <= 0) {
    label = "Paid in Full";
    background = "#ecfdf3";
    color = "#027a48";
  } else if (!depositPaid && trip.deposit_due_date) {
    const pastDue = isPastDue(trip.deposit_due_date);
    label = pastDue ? "Deposit Past Due" : "Deposit Pending";
    background = pastDue ? "#fff1f2" : "#fff7ed";
    color = pastDue ? "#be123c" : "#c2410c";
  } else if (trip.final_payment_due_date) {
    const pastDue = isPastDue(trip.final_payment_due_date);
    label = pastDue ? "Final Payment Past Due" : "Final Payment Due";
    background = pastDue ? "#fff1f2" : "#fff7ed";
    color = pastDue ? "#be123c" : "#c2410c";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
        background,
        color,
      }}
    >
      {label}
    </span>
  );
}

type TripRow = {
  id: string;
  trip_name: string;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string;
  total_paid: number | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
  client_account_id: string;
  client_accounts:
    | {
        first_name: string | null;
        last_name: string | null;
      }[]
    | null;
};

export default async function AdminTripsPage() {
  const { supabase } = await requireAdmin();

  const { data: trips, error } = await supabase
    .from("trips")
    .select(`
      id,
      trip_name,
      departure_date,
      return_date,
      trip_status,
      total_paid,
      balance_due,
      deposit_amount,
      deposit_due_date,
      deposit_paid,
      final_payment_due_date,
      client_account_id,
      client_accounts!trips_client_account_id_fkey (
        first_name,
        last_name
      )
    `)
    .order("departure_date", { ascending: true });

  if (error) {
    return (
      <PageShell title="Trips" subtitle="Manage all trips in one place.">
        <div className="card">
          <p>
            <strong>Error loading trips:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripRows = (trips ?? []) as TripRow[];

  return (
    <PageShell title="Trips" subtitle="Manage all trips in one place.">
      <div className="row">
        <Link href="/admin/trips/new" className="btn btn-primary">
          Create Trip
        </Link>
      </div>

      {tripRows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b" }}>No trips found yet.</p>
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Trip Name</th>
                <th>Client</th>
                <th>Departure</th>
                <th>Return</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Deposit</th>
                <th>Balance Due</th>
                <th>Final Due</th>
                <th>Open</th>
              </tr>
            </thead>

            <tbody>
              {tripRows.map((trip) => {
                const client = trip.client_accounts?.[0];
                const clientName = client
                  ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                  : "Unknown Client";

                return (
                  <tr key={trip.id}>
                    <td>
                      <strong>{trip.trip_name}</strong>
                    </td>

                    <td>{clientName || "Unknown Client"}</td>

                    <td>{formatDate(trip.departure_date)}</td>

                    <td>{formatDate(trip.return_date)}</td>

                    <td>
                      <StatusBadge status={trip.trip_status} />
                    </td>

                    <td>
                      <PaymentBadge trip={trip} />
                    </td>

                    <td>
                      <div style={{ display: "grid", gap: 3 }}>
                        <strong>{formatMoney(trip.deposit_amount)}</strong>
                        <span style={{ color: "#64748b", fontSize: 12 }}>
                          Due {formatDate(trip.deposit_due_date)}
                        </span>
                        {trip.deposit_paid ? (
                          <span style={{ color: "#027a48", fontSize: 12, fontWeight: 800 }}>
                            Deposit paid
                          </span>
                        ) : (
                          <span style={{ color: "#c2410c", fontSize: 12, fontWeight: 800 }}>
                            Deposit not marked paid
                          </span>
                        )}
                      </div>
                    </td>

                    <td>{formatMoney(trip.balance_due)}</td>

                    <td>{formatDate(trip.final_payment_due_date)}</td>

                    <td>
                      <Link
                        href={`/admin/trips/${trip.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "5px 12px" }}
                      >
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