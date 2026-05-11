import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return value;
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T23:59:59`);
  const today = new Date();
  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

function isDeletable(trip: TripRow): { allowed: boolean; reason: string } {
  // Always deletable
  if (trip.trip_status === "draft" || trip.trip_status === "cancelled") {
    return { allowed: true, reason: "Draft or cancelled trip" };
  }

  // No payments recorded
  const totalPaid = Number(trip.total_paid ?? 0);
  const balanceDue = Number(trip.balance_due ?? 0);
  if (totalPaid === 0 && balanceDue === 0) {
    return { allowed: true, reason: "No payments recorded" };
  }

  // 10+ days post travel
  if (trip.return_date) {
    const returnDate = new Date(`${trip.return_date}T00:00:00`);
    const today = new Date();
    const daysSinceReturn = Math.floor((today.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceReturn >= 10) {
      return { allowed: true, reason: `${daysSinceReturn} days post-travel` };
    }
  }

  return { allowed: false, reason: "Active trip with payments — cannot delete" };
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
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: colors.background, color: colors.color }}>
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

  if (balanceDue <= 0) { label = "Paid in Full"; background = "#ecfdf3"; color = "#027a48"; }
  else if (!depositPaid && trip.deposit_due_date) {
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
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", background, color }}>
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
  deleted_at: string | null;
  deletion_requested_at: string | null;
  retain_data: boolean | null;
  client_accounts: { first_name: string | null; last_name: string | null; }[] | null;
};

// ── Server actions ────────────────────────────────────────────────────────────

async function softDeleteTrip(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_status, total_paid, balance_due, return_date, deleted_at")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");
  if (trip.deleted_at) throw new Error("Trip is already deleted.");

  const deletable = isDeletable(trip as any);
  if (!deletable.allowed) throw new Error(`Cannot delete this trip: ${deletable.reason}`);

  const { error } = await supabase
    .from("trips")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/trips");
  redirect("/admin/trips");
}

async function approveDeletionRequest(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { error } = await supabase
    .from("trips")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/trips");
}

async function dismissDeletionRequest(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { error } = await supabase
    .from("trips")
    .update({ deletion_requested_at: null, deletion_requested_by: null })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/trips");
}

async function restoreTrip(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { error } = await supabase
    .from("trips")
    .update({ deleted_at: null })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/trips");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showDeleted = view === "deleted";

  const { supabase } = await requireAdmin();

  const query = supabase
    .from("trips")
    .select(`
      id, trip_name, departure_date, return_date, trip_status,
      total_paid, balance_due, deposit_amount, deposit_due_date,
      deposit_paid, final_payment_due_date, client_account_id,
      deleted_at, deletion_requested_at, retain_data,
      client_accounts!trips_client_account_id_fkey (first_name, last_name)
    `)
    .order("departure_date", { ascending: true });

  const { data: trips, error } = showDeleted
    ? await query.not("deleted_at", "is", null)
    : await query.is("deleted_at", null);

  if (error) {
    return (
      <PageShell title="Trips" subtitle="Manage all trips in one place.">
        <div className="card"><p><strong>Error loading trips:</strong></p><pre>{JSON.stringify(error, null, 2)}</pre></div>
      </PageShell>
    );
  }

  const tripRows = (trips ?? []) as TripRow[];

  // Count pending deletion requests (only on active trips view)
  const { data: deletionRequests } = await supabase
    .from("trips")
    .select("id")
    .not("deletion_requested_at", "is", null)
    .is("deleted_at", null);

  const deletionRequestCount = (deletionRequests ?? []).length;

  return (
    <PageShell title="Trips" subtitle="Manage all trips in one place.">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/admin/trips/new" className="btn btn-primary">Create Trip</Link>
          <Link
            href="/admin/trips"
            className="btn btn-outline"
            style={{ background: !showDeleted ? "#f0f7f8" : undefined }}
          >
            Active Trips
          </Link>
          <Link
            href="/admin/trips?view=deleted"
            className="btn btn-outline"
            style={{ background: showDeleted ? "#f0f7f8" : undefined }}
          >
            Deleted Trips
          </Link>
        </div>
        {deletionRequestCount > 0 && !showDeleted && (
          <div style={{ padding: "8px 14px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontWeight: 700, fontSize: 13 }}>
            ⚠️ {deletionRequestCount} deletion request{deletionRequestCount === 1 ? "" : "s"} pending client review
          </div>
        )}
      </div>

      {/* Deletion requests banner */}
      {!showDeleted && tripRows.some((t) => t.deletion_requested_at) && (
        <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed" }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#9a3412" }}>⚠️ Client Deletion Requests</p>
          <p style={{ margin: 0, color: "#9a3412", fontSize: 13, lineHeight: 1.6 }}>
            The following trips have been flagged by clients for deletion. Review each one and approve or dismiss.
          </p>
          {tripRows.filter((t) => t.deletion_requested_at).map((trip) => {
            const client = trip.client_accounts?.[0];
            const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "Unknown Client";
            const deletable = isDeletable(trip);
            return (
              <div key={trip.id} style={{ padding: "12px 14px", borderRadius: 12, background: "#ffffff", border: "1px solid #fed7aa", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{trip.trip_name}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: "#667085" }}>{clientName} · {trip.trip_status}</p>
                  {!deletable.allowed && (
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "#be123c" }}>⚠️ {deletable.reason}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/admin/trips/${trip.id}`} className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Open Trip</Link>
                  {deletable.allowed && (
                    <form action={approveDeletionRequest}>
                      <input type="hidden" name="trip_id" value={trip.id} />
                      <button type="submit" className="btn btn-primary" style={{ fontSize: 13, padding: "7px 12px", background: "#be123c" }}>Approve Delete</button>
                    </form>
                  )}
                  <form action={dismissDeletionRequest}>
                    <input type="hidden" name="trip_id" value={trip.id} />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Dismiss Request</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tripRows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b" }}>
            {showDeleted ? "No deleted trips found." : "No trips found yet."}
          </p>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tripRows.map((trip) => {
                const client = trip.client_accounts?.[0];
                const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "Unknown Client";
                const deletable = isDeletable(trip);
                const hasDeletionRequest = Boolean(trip.deletion_requested_at);

                return (
                  <tr key={trip.id} style={{ background: hasDeletionRequest ? "#fffbf7" : undefined }}>
                    <td>
                      <div>
                        <strong>{trip.trip_name}</strong>
                        {hasDeletionRequest && (
                          <span style={{ display: "block", fontSize: 11, color: "#c2410c", fontWeight: 700, marginTop: 2 }}>⚠️ Deletion requested</span>
                        )}
                        {showDeleted && trip.retain_data && (
                          <span style={{ display: "block", fontSize: 11, color: "#027a48", fontWeight: 700, marginTop: 2 }}>🔒 Retained</span>
                        )}
                      </div>
                    </td>
                    <td>{clientName || "Unknown Client"}</td>
                    <td>{formatDate(trip.departure_date)}</td>
                    <td>{formatDate(trip.return_date)}</td>
                    <td><StatusBadge status={trip.trip_status} /></td>
                    <td><PaymentBadge trip={trip} /></td>
                    <td>
                      <div style={{ display: "grid", gap: 3 }}>
                        <strong>{formatMoney(trip.deposit_amount)}</strong>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Due {formatDate(trip.deposit_due_date)}</span>
                        {trip.deposit_paid ? (
                          <span style={{ color: "#027a48", fontSize: 12, fontWeight: 800 }}>Deposit paid</span>
                        ) : (
                          <span style={{ color: "#c2410c", fontSize: 12, fontWeight: 800 }}>Not marked paid</span>
                        )}
                      </div>
                    </td>
                    <td>{formatMoney(trip.balance_due)}</td>
                    <td>{formatDate(trip.final_payment_due_date)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {!showDeleted && (
                          <Link href={`/admin/trips/${trip.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>Open</Link>
                        )}
                        {showDeleted ? (
                          <form action={restoreTrip}>
                            <input type="hidden" name="trip_id" value={trip.id} />
                            <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "5px 12px" }}>Restore</button>
                          </form>
                        ) : deletable.allowed ? (
                          <form action={softDeleteTrip} onSubmit={(e) => { if (!confirm(`Delete "${trip.trip_name}"? This can be restored within 1 year.`)) e.preventDefault(); }}>
                            <input type="hidden" name="trip_id" value={trip.id} />
                            <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "5px 12px", color: "#be123c", borderColor: "#fecaca" }}>Delete</button>
                          </form>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94a3b8", padding: "5px 0" }} title={deletable.reason}>Cannot delete</span>
                        )}
                      </div>
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