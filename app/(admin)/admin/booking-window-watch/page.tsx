import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runBookingWindowWatch } from "@/lib/booking-window-watch/checker";

type SupplierRow = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
  website_url: string | null;
  booking_portal_url: string | null;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripRow = {
  id: string;
  trip_name: string | null;
  client_account_id: string | null;
  departure_date: string | null;
};

type WatchRow = {
  id: string;
  client_account_id: string | null;
  trip_id: string | null;
  supplier_id: string | null;
  supplier_name_snapshot: string | null;
  product_type: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  flexible_window: string | null;
  traveler_count: number | null;
  target_year: number | null;
  check_url: string | null;
  notes: string | null;
  status: string;
  last_checked_at: string | null;
  last_status: string | null;
  last_message: string | null;
  last_open_url: string | null;
  created_at: string | null;
  suppliers: Pick<SupplierRow, "supplier_name" | "website_url" | "booking_portal_url"> | Pick<SupplierRow, "supplier_name" | "website_url" | "booking_portal_url">[] | null;
  client_accounts: Pick<ClientRow, "first_name" | "last_name" | "email"> | Pick<ClientRow, "first_name" | "last_name" | "email">[] | null;
  trips: Pick<TripRow, "trip_name" | "departure_date"> | Pick<TripRow, "trip_name" | "departure_date">[] | null;
};

type ResultRow = {
  id: string;
  watch_id: string;
  status: string;
  checked_url: string | null;
  message: string | null;
  raw_excerpt: string | null;
  checked_at: string | null;
};

function cleanText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function cleanInteger(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function rowFromRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined, fallback = "-") {
  if (!value) return fallback;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function clientLabel(client: Pick<ClientRow, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!client) return "No client";
  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  return name || client.email || "Unnamed client";
}

function tripLabel(trip: Pick<TripRow, "trip_name" | "departure_date"> | null | undefined) {
  if (!trip) return "No trip linked";
  return `${trip.trip_name ?? "Trip"}${trip.departure_date ? ` (${formatDate(trip.departure_date)})` : ""}`;
}

function statusColor(status: string | null | undefined) {
  switch (status) {
    case "open":
      return { background: "#ecfdf3", color: "#027a48" };
    case "not_open":
      return { background: "#f1f5f9", color: "#475569" };
    case "manual_review":
      return { background: "#fff7ed", color: "#c2410c" };
    case "error":
      return { background: "#fff1f2", color: "#be123c" };
    default:
      return { background: "#e0f2fe", color: "#075985" };
  }
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const label = status ? status.replace(/_/g, " ") : "not checked";
  const colors = statusColor(status);
  return (
    <span style={{ borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 900, textTransform: "uppercase", ...colors }}>
      {label}
    </span>
  );
}

async function createBookingWindowWatch(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const supplierId = cleanText(formData, "supplier_id");
  const tripId = cleanText(formData, "trip_id");
  const clientAccountId = cleanText(formData, "client_account_id");
  const productType = cleanText(formData, "product_type") ?? "package";
  const startDate = cleanText(formData, "start_date");
  const endDate = cleanText(formData, "end_date");
  const targetYear = cleanInteger(formData, "target_year") ?? (startDate ? Number(startDate.slice(0, 4)) : null);

  if (!supplierId) throw new Error("Choose a supplier.");
  if (!startDate && !targetYear) throw new Error("Enter either a target start date or target year.");

  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("supplier_name")
    .eq("id", supplierId)
    .single();

  if (supplierError) throw new Error(supplierError.message);

  const { error } = await supabase.from("booking_window_watches" as any).insert({
    supplier_id: supplierId,
    supplier_name_snapshot: supplier?.supplier_name ?? null,
    client_account_id: clientAccountId,
    trip_id: tripId,
    product_type: productType,
    destination: cleanText(formData, "destination"),
    start_date: startDate,
    end_date: endDate,
    flexible_window: cleanText(formData, "flexible_window"),
    traveler_count: cleanInteger(formData, "traveler_count"),
    target_year: targetYear,
    check_url: cleanText(formData, "check_url"),
    notes: cleanText(formData, "notes"),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/booking-window-watch");
  redirect("/admin/booking-window-watch?created=1");
}

async function runAllBookingWindowChecks() {
  "use server";

  await requireAdmin();
  await runBookingWindowWatch();
  revalidatePath("/admin/booking-window-watch");
}

async function runOneBookingWindowCheck(formData: FormData) {
  "use server";

  await requireAdmin();
  const watchId = cleanText(formData, "watch_id");
  if (!watchId) throw new Error("Missing watch ID.");

  await runBookingWindowWatch({ watchId });
  revalidatePath("/admin/booking-window-watch");
}

async function updateWatchStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const watchId = cleanText(formData, "watch_id");
  const status = cleanText(formData, "status");
  if (!watchId) throw new Error("Missing watch ID.");
  if (!["active", "paused", "closed"].includes(String(status))) throw new Error("Invalid status.");

  const { error } = await supabase
    .from("booking_window_watches" as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/booking-window-watch");
}

async function deleteWatch(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const watchId = cleanText(formData, "watch_id");
  if (!watchId) throw new Error("Missing watch ID.");

  const { error } = await supabase
    .from("booking_window_watches" as any)
    .delete()
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/booking-window-watch");
}

export default async function BookingWindowWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const { supabase } = await requireAdmin();

  const [watchesResult, suppliersResult, clientsResult, tripsResult, resultsResult] = await Promise.all([
    supabase
      .from("booking_window_watches" as any)
      .select("id, client_account_id, trip_id, supplier_id, supplier_name_snapshot, product_type, destination, start_date, end_date, flexible_window, traveler_count, target_year, check_url, notes, status, last_checked_at, last_status, last_message, last_open_url, created_at, suppliers(supplier_name, website_url, booking_portal_url), client_accounts(first_name, last_name, email), trips(trip_name, departure_date)")
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("id, supplier_name, supplier_type, website_url, booking_portal_url")
      .order("supplier_name", { ascending: true }),
    supabase
      .from("client_accounts")
      .select("id, first_name, last_name, email")
      .order("last_name", { ascending: true }),
    supabase
      .from("trips")
      .select("id, trip_name, client_account_id, departure_date")
      .order("departure_date", { ascending: false }),
    supabase
      .from("booking_window_watch_results" as any)
      .select("id, watch_id, status, checked_url, message, raw_excerpt, checked_at")
      .order("checked_at", { ascending: false })
      .limit(50),
  ]);

  const watches = (watchesResult.data ?? []) as WatchRow[];
  const suppliers = (suppliersResult.data ?? []) as SupplierRow[];
  const clients = (clientsResult.data ?? []) as ClientRow[];
  const trips = (tripsResult.data ?? []) as TripRow[];
  const resultRows = (resultsResult.data ?? []) as ResultRow[];
  const latestResultByWatchId = new Map<string, ResultRow>();

  for (const result of resultRows) {
    if (!latestResultByWatchId.has(result.watch_id)) {
      latestResultByWatchId.set(result.watch_id, result);
    }
  }

  const activeCount = watches.filter((watch) => watch.status === "active").length;
  const openCount = watches.filter((watch) => watch.last_status === "open").length;
  const reviewCount = watches.filter((watch) => watch.last_status === "manual_review" || watch.last_status === "error").length;

  return (
    <PageShell title="Booking Window Watch" subtitle="Track supplier booking-window openings for future client trips.">
      <div className="row">
        <Link href="/admin/dashboard" className="btn btn-outline">Dashboard</Link>
        <Link href="/admin/suppliers" className="btn btn-outline">Suppliers</Link>
        <form action={runAllBookingWindowChecks}>
          <button type="submit" className="btn btn-primary">Run Active Checks</button>
        </form>
      </div>

      {created ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Booking window watch created.</p>
        </div>
      ) : null}

      {watchesResult.error ? (
        <div className="card">
          <p><strong>Error loading booking window watches:</strong></p>
          <pre>{JSON.stringify(watchesResult.error, null, 2)}</pre>
        </div>
      ) : null}

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Active Watches</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>{activeCount}</p>
        </div>
        <div className="card">
          <span className="label">Open Windows</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: openCount > 0 ? "#027a48" : "#475569" }}>{openCount}</p>
        </div>
        <div className="card">
          <span className="label">Needs Review</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: reviewCount > 0 ? "#c2410c" : "#475569" }}>{reviewCount}</p>
        </div>
      </div>

      <form action={createBookingWindowWatch} className="card stack">
        <div>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>New Watch</p>
          <h2 style={{ margin: "6px 0 0" }}>Add Booking Window Watch</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Use a watch-specific URL when possible. If blank, the checker will fall back to the supplier booking portal URL, then the supplier public website URL.
          </p>
        </div>

        <div className="grid grid-3">
          <label className="stack-sm">
            <span className="label">Supplier</span>
            <select name="supplier_id" className="select" required>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
          </label>

          <label className="stack-sm">
            <span className="label">Client</span>
            <select name="client_account_id" className="select">
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {clientLabel(client)}
                </option>
              ))}
            </select>
          </label>

          <label className="stack-sm">
            <span className="label">Trip</span>
            <select name="trip_id" className="select">
              <option value="">No trip linked</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {tripLabel(trip)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-3">
          <label className="stack-sm">
            <span className="label">Product Type</span>
            <select name="product_type" className="select" defaultValue="package">
              <option value="cruise">Cruise</option>
              <option value="resort_package">Resort Package</option>
              <option value="tickets">Tickets</option>
              <option value="dining">Dining</option>
              <option value="package">Package</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="stack-sm">
            <span className="label">Destination / Product</span>
            <input className="input" name="destination" placeholder="Alaska, Walt Disney World, Royal Caribbean Alaska" />
          </label>

          <label className="stack-sm">
            <span className="label">Travelers</span>
            <input className="input" name="traveler_count" type="number" min="1" placeholder="4" />
          </label>
        </div>

        <div className="grid grid-3">
          <label className="stack-sm">
            <span className="label">Start Date</span>
            <input className="input" name="start_date" type="date" />
          </label>

          <label className="stack-sm">
            <span className="label">End Date</span>
            <input className="input" name="end_date" type="date" />
          </label>

          <label className="stack-sm">
            <span className="label">Target Year</span>
            <input className="input" name="target_year" type="number" min="2026" max="2040" placeholder="2028" />
          </label>
        </div>

        <label className="stack-sm">
          <span className="label">Flexible Window</span>
          <input className="input" name="flexible_window" placeholder="MLK weekend, any May 2028 Alaska sailing, early spring release" />
        </label>

        <label className="stack-sm">
          <span className="label">Watch URL Override</span>
          <input className="input" name="check_url" type="url" placeholder="Exact supplier search or public availability page" />
        </label>

        <label className="stack-sm">
          <span className="label">Notes</span>
          <textarea className="textarea" name="notes" rows={3} placeholder="Client preferences, expected release timing, supplier quirks, or manual review steps." />
        </label>

        <button type="submit" className="btn btn-primary">Create Watch</button>
      </form>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Watches</h2>

        {watches.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No booking window watches yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th>Watch</th>
                  <th>Client / Trip</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Last Message</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watches.map((watch) => {
                  const supplier = rowFromRelation(watch.suppliers);
                  const client = rowFromRelation(watch.client_accounts);
                  const trip = rowFromRelation(watch.trips);
                  const latestResult = latestResultByWatchId.get(watch.id);
                  const effectiveUrl = watch.check_url || supplier?.booking_portal_url || supplier?.website_url;

                  return (
                    <tr key={watch.id}>
                      <td>
                        <div className="stack-sm">
                          <strong>{watch.destination || watch.product_type || "Booking window"}</strong>
                          <span style={{ color: "#64748b" }}>{supplier?.supplier_name ?? watch.supplier_name_snapshot ?? "Supplier"}</span>
                          {effectiveUrl ? (
                            <a href={effectiveUrl} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>
                              Source
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="stack-sm">
                          <span>{clientLabel(client)}</span>
                          <span style={{ color: "#64748b" }}>{tripLabel(trip)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack-sm">
                          <span>{formatDate(watch.start_date)} - {formatDate(watch.end_date)}</span>
                          <span style={{ color: "#64748b" }}>{watch.flexible_window || (watch.target_year ? `Target year ${watch.target_year}` : "No flexible note")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack-sm">
                          <StatusPill status={watch.last_status} />
                          <span style={{ color: "#64748b" }}>Watch: {watch.status}</span>
                          <span style={{ color: "#64748b" }}>Checked {formatDateTime(watch.last_checked_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack-sm" style={{ minWidth: 280 }}>
                          <span>{watch.last_message ?? "Not checked yet."}</span>
                          {latestResult?.raw_excerpt ? (
                            <details>
                              <summary style={{ cursor: "pointer", color: "var(--accent-dark)", fontWeight: 800 }}>Excerpt</summary>
                              <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5 }}>{latestResult.raw_excerpt}</p>
                            </details>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <form action={runOneBookingWindowCheck}>
                            <input type="hidden" name="watch_id" value={watch.id} />
                            <button type="submit" className="btn btn-primary">Run</button>
                          </form>

                          <form action={updateWatchStatus}>
                            <input type="hidden" name="watch_id" value={watch.id} />
                            <input type="hidden" name="status" value={watch.status === "active" ? "paused" : "active"} />
                            <button type="submit" className="btn btn-outline">{watch.status === "active" ? "Pause" : "Activate"}</button>
                          </form>

                          <form action={updateWatchStatus}>
                            <input type="hidden" name="watch_id" value={watch.id} />
                            <input type="hidden" name="status" value="closed" />
                            <button type="submit" className="btn btn-outline">Close</button>
                          </form>

                          <form action={deleteWatch}>
                            <input type="hidden" name="watch_id" value={watch.id} />
                            <button type="submit" className="btn btn-outline">Delete</button>
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
