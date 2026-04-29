import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type CommissionDetail = {
  id: string;
  client_account_id: string | null;
  trip_id: string | null;
  supplier_id: string | null;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  gross_booking_amount: number | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
  notes: string | null;
};

type ClientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripOption = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
};

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function toMoneyNumber(value: FormDataEntryValue | null, fallback = 0) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return fallback;

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid number submitted.");
  }

  return numberValue;
}

function calculateExpectedCommission(
  fullCommissionAmount: number,
  agencyCommissionPercent: number,
) {
  return Math.round(fullCommissionAmount * (agencyCommissionPercent / 100) * 100) / 100;
}

function getClientDisplayName(client: ClientOption) {
  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();

  return name || client.email || "Unnamed Client";
}

async function updateCommission(commissionId: string, formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const commission_name = String(formData.get("commission_name") ?? "").trim();

  if (!commission_name) {
    throw new Error("Commission name is required.");
  }

  const client_account_id = cleanText(formData, "client_account_id");
  const trip_id = cleanText(formData, "trip_id");
  const supplier_id = cleanText(formData, "supplier_id");

  let client_name_snapshot: string | null = null;
  let trip_name_snapshot: string | null = null;
  let supplier_name_snapshot = cleanText(formData, "supplier_name_snapshot");

  if (client_account_id) {
    const { data: client } = await supabase
      .from("client_accounts")
      .select("first_name, last_name, email")
      .eq("id", client_account_id)
      .maybeSingle();

    if (client) {
      client_name_snapshot =
        `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
        client.email ||
        null;
    }
  }

  if (trip_id) {
    const { data: trip } = await supabase
      .from("trips")
      .select("trip_name, destinations")
      .eq("id", trip_id)
      .maybeSingle();

    if (trip) {
      trip_name_snapshot = trip.trip_name || trip.destinations || null;
    }
  }

  if (supplier_id) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("supplier_name")
      .eq("id", supplier_id)
      .maybeSingle();

    if (supplier) {
      supplier_name_snapshot = supplier.supplier_name;
    }
  }

  const gross_booking_amount = toMoneyNumber(formData.get("gross_booking_amount"));

  const full_commission_amount = toMoneyNumber(
    formData.get("full_commission_amount"),
  );

  const agency_commission_percent = toMoneyNumber(
    formData.get("agency_commission_percent"),
    90,
  );

  const expected_commission_amount = calculateExpectedCommission(
    full_commission_amount,
    agency_commission_percent,
  );

  const received_commission_amount = toMoneyNumber(
    formData.get("received_commission_amount"),
  );

  const { error } = await supabase
    .from("commissions")
    .update({
      client_account_id,
      trip_id,
      supplier_id,
      commission_name,
      booking_number: cleanText(formData, "booking_number"),
      supplier_name_snapshot,
      client_name_snapshot,
      trip_name_snapshot,
      gross_booking_amount,
      full_commission_amount,
      agency_commission_percent,
      expected_commission_amount,
      received_commission_amount,
      commission_status: cleanText(formData, "commission_status") ?? "expected",
      expected_payment_date: cleanText(formData, "expected_payment_date"),
      received_payment_date: cleanText(formData, "received_payment_date"),
      notes: cleanText(formData, "notes"),
    })
    .eq("id", commissionId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/commissions/${commissionId}`);
}

export default async function EditCommissionPage({
  params,
}: {
  params: Promise<{ commissionId: string }>;
}) {
  const { commissionId } = await params;
  const { supabase } = await requireAdmin();

  const { data: commission, error } = await supabase
    .from("commissions")
    .select("*")
    .eq("id", commissionId)
    .single();

  if (error || !commission) {
    return (
      <PageShell
        title="Edit Commission"
        subtitle="We could not load this commission."
      >
        <div className="card">
          <p>
            <strong>Error loading commission:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const { data: clients } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true });

  const { data: trips } = await supabase
    .from("trips")
    .select("id, trip_name, destinations")
    .order("departure_date", { ascending: false });

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_type")
    .order("supplier_name", { ascending: true });

  const row = commission as CommissionDetail;
  const clientRows = (clients ?? []) as ClientOption[];
  const tripRows = (trips ?? []) as TripOption[];
  const supplierRows = (suppliers ?? []) as SupplierOption[];

  const saveCommission = updateCommission.bind(null, row.id);

  const currentAgencyPercent = row.agency_commission_percent ?? 90;
  const currentExpectedCommission = calculateExpectedCommission(
    Number(row.full_commission_amount ?? 0),
    currentAgencyPercent,
  );

  return (
    <PageShell
      title={`Edit ${row.commission_name}`}
      subtitle="Update commission tracking details."
    >
      <form action={saveCommission} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Commission Basics</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Commission Name</span>
              <input
                name="commission_name"
                type="text"
                defaultValue={row.commission_name ?? ""}
                required
              />
            </label>

            <label className="stack-sm">
              <span>Booking Number</span>
              <input
                name="booking_number"
                type="text"
                defaultValue={row.booking_number ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Status</span>
              <select
                name="commission_status"
                defaultValue={row.commission_status ?? "expected"}
              >
                <option value="expected">expected</option>
                <option value="pending">pending</option>
                <option value="received">received</option>
                <option value="partial">partial</option>
                <option value="overdue">overdue</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Connections</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Client</span>
              <select
                name="client_account_id"
                defaultValue={row.client_account_id ?? ""}
              >
                <option value="">No client selected</option>
                {clientRows.map((client) => (
                  <option key={client.id} value={client.id}>
                    {getClientDisplayName(client)}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-sm">
              <span>Trip</span>
              <select name="trip_id" defaultValue={row.trip_id ?? ""}>
                <option value="">No trip selected</option>
                {tripRows.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.trip_name ?? trip.destinations ?? "Unnamed Trip"}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-sm">
              <span>Supplier</span>
              <select name="supplier_id" defaultValue={row.supplier_id ?? ""}>
                <option value="">No supplier selected</option>
                {supplierRows.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                    {supplier.supplier_type ? ` — ${supplier.supplier_type}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-sm">
              <span>Supplier Name Snapshot / Manual Supplier</span>
              <input
                name="supplier_name_snapshot"
                type="text"
                defaultValue={row.supplier_name_snapshot ?? ""}
                placeholder="Use if supplier is not in supplier list yet"
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Amounts</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Gross Booking Amount</span>
              <input
                name="gross_booking_amount"
                type="number"
                step="0.01"
                defaultValue={row.gross_booking_amount ?? 0}
              />
            </label>

            <label className="stack-sm">
              <span>Full Commission</span>
              <input
                name="full_commission_amount"
                type="number"
                step="0.01"
                defaultValue={row.full_commission_amount ?? 0}
              />
            </label>

            <label className="stack-sm">
              <span>Your Commission Percentage</span>
              <input
                name="agency_commission_percent"
                type="number"
                step="0.01"
                defaultValue={currentAgencyPercent}
              />
            </label>

            <label className="stack-sm">
              <span>Received Commission Amount</span>
              <input
                name="received_commission_amount"
                type="number"
                step="0.01"
                defaultValue={row.received_commission_amount ?? 0}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              <strong>Current Expected Commission:</strong>{" "}
              ${currentExpectedCommission.toFixed(2)}. This recalculates when you
              save based on Full Commission × Your Commission Percentage.
            </div>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Payment Timing</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Expected Payment Date</span>
              <input
                name="expected_payment_date"
                type="date"
                defaultValue={row.expected_payment_date ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Received Payment Date</span>
              <input
                name="received_payment_date"
                type="date"
                defaultValue={row.received_payment_date ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Notes</h2>

          <label className="stack-sm">
            <span>Notes</span>
            <textarea
              name="notes"
              rows={5}
              defaultValue={row.notes ?? ""}
              placeholder="Supplier follow-up notes, payment notes, manual tracking details, etc."
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button">
            Save Commission
          </button>

          <a href={`/admin/commissions/${row.id}`} className="button-secondary">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}