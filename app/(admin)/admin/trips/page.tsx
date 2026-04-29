import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TripRow = {
  id: string;
  trip_name: string;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string;
  balance_due: number | null;
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
      balance_due,
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
        <a href="/admin/trips/new" className="btn btn-primary">
          Create Trip
        </a>
      </div>

      {tripRows.length === 0 ? (
        <div className="card">
          <p>No trips found yet.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Trip Name</th>
              <th>Client</th>
              <th>Departure</th>
              <th>Return</th>
              <th>Status</th>
              <th>Balance Due</th>
              <th>Final Payment Due</th>
              <th>Actions</th>
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
                  <td>{trip.trip_name}</td>
                  <td>{clientName}</td>
                  <td>{trip.departure_date ?? ""}</td>
                  <td>{trip.return_date ?? ""}</td>
                  <td>{trip.trip_status}</td>
                  <td>
                    {typeof trip.balance_due === "number"
                      ? `$${trip.balance_due.toFixed(2)}`
                      : ""}
                  </td>
                  <td>{trip.final_payment_due_date ?? ""}</td>
                  <td>
                    <a
                      href={`/admin/trips/${trip.id}`}
                      style={{ color: "var(--accent-dark)", fontWeight: 600 }}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}