import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function getClientDisplayName(client: ClientOption) {
  const name = `${client.last_name ?? ""}, ${client.first_name ?? ""}`.trim();

  if (name === ",") {
    return `Unnamed Client (${client.email ?? "no email"})`;
  }

  return `${name} (${client.email ?? "no email"})`;
}

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

async function createTrip(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const trip_name = String(formData.get("trip_name") ?? "").trim();
  const destinations = String(formData.get("destinations") ?? "").trim();
  const departure_date = String(formData.get("departure_date") ?? "").trim();
  const return_date = String(formData.get("return_date") ?? "").trim();
  const occasion = cleanText(formData, "occasion");
  const client_account_id = String(formData.get("client_account_id") ?? "").trim();

  if (!trip_name) throw new Error("Trip name is required.");
  if (!destinations) throw new Error("Destinations are required.");
  if (!departure_date) throw new Error("Departure date is required.");
  if (!return_date) throw new Error("Return date is required.");
  if (!client_account_id) throw new Error("Client account is required.");

  const { data: clientAccount, error: clientAccountError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("id", client_account_id)
    .single();

  if (clientAccountError || !clientAccount) {
    throw new Error("Selected client account was not found.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      client_account_id: clientAccount.id,
      primary_contact_client_id: clientAccount.id,
      trip_name,
      departure_date,
      return_date,
      destinations,
      occasion,
      trip_status: "draft",
      total_paid: 0,
      balance_due: 0,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Failed to create trip.");
  }

  const { error: proposalError } = await supabase.from("trip_proposals").insert({
    trip_id: trip.id,
    planning_fee: 0,
    total_price: 0,
    commission_admin_only: 0,
    proposal_highlights: [],
  });

  if (proposalError) {
    throw new Error(proposalError.message);
  }

  redirect(`/admin/trips/${trip.id}`);
}

export default async function AdminCreateTripPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const selectedClientId = String(clientId ?? "").trim();

  const { supabase } = await requireAdmin();

  const { data: clients, error } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true });

  const clientRows = (clients ?? []) as ClientOption[];

  const selectedClient = selectedClientId
    ? clientRows.find((client) => client.id === selectedClientId)
    : null;

  return (
    <PageShell title="Create Trip" subtitle="Start a new trip record.">
      {error ? (
        <div className="card">
          <p>
            <strong>Error loading clients:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      ) : (
        <form action={createTrip} className="stack" style={{ maxWidth: 1100 }}>
          <div
            className="card stack"
            style={{
              background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
              border: "1px solid #e6f0f2",
            }}
          >
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
              Trip Setup
            </p>

            <h2 style={{ margin: 0 }}>Client</h2>

            {selectedClient ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span className="label">Trip will be linked to</span>
                <p style={{ margin: "6px 0 0", fontWeight: 800 }}>
                  {getClientDisplayName(selectedClient)}
                </p>
              </div>
            ) : null}

            <label className="stack-sm">
              <span className="label">Client</span>
              <select
                className="select"
                name="client_account_id"
                defaultValue={selectedClientId}
                required
              >
                <option value="">Select a client</option>
                {clientRows.map((client) => (
                  <option key={client.id} value={client.id}>
                    {getClientDisplayName(client)}
                  </option>
                ))}
              </select>
            </label>

            {selectedClientId && !selectedClient ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  lineHeight: 1.6,
                }}
              >
                The client from the link was not found. Please select a client manually.
              </div>
            ) : null}
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Trip Details</h2>

            <div className="grid grid-2">
              <label className="stack-sm">
                <span className="label">Trip Name</span>
                <input
                  className="input"
                  name="trip_name"
                  placeholder="Brown Family Disney Trip"
                  required
                />
              </label>

              <label className="stack-sm">
                <span className="label">Destinations</span>
                <input
                  className="input"
                  name="destinations"
                  placeholder="Walt Disney World, Orlando"
                  required
                />
              </label>

              <label className="stack-sm">
                <span className="label">Departure Date</span>
                <input className="input" type="date" name="departure_date" required />
              </label>

              <label className="stack-sm">
                <span className="label">Return Date</span>
                <input className="input" type="date" name="return_date" required />
              </label>

              <label className="stack-sm">
                <span className="label">Occasion</span>
                <input
                  className="input"
                  name="occasion"
                  placeholder="Birthday, anniversary, family vacation"
                />
              </label>
            </div>
          </div>

          <div
            className="card stack"
            style={{
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <h2 style={{ margin: 0 }}>Save Trip</h2>

            <div className="row">
              <button type="submit" className="btn btn-primary">
                Create Trip
              </button>

              {selectedClient ? (
                <Link
                  href={`/admin/clients/${selectedClient.id}`}
                  className="btn btn-primary"
                >
                  Back to Client
                </Link>
              ) : (
                <Link href="/admin/trips" className="btn btn-primary">
                  Back to Trips
                </Link>
              )}
            </div>
          </div>
        </form>
      )}
    </PageShell>
  );
}