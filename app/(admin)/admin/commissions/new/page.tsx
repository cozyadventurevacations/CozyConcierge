import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripOption = {
  id: string;
  client_account_id: string | null;
  trip_name: string | null;
  destinations: string | null;
};

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
};

type ComponentOption = {
  id: string;
  component_type: string;
  display_name: string | null;
  supplier_name: string | null;
  confirmation_number: string | null;
};

function getComponentTypeLabel(componentType: string | null | undefined) {
  const labels: Record<string, string> = {
    hotel: "Hotel",
    air: "Air",
    cruise: "Cruise",
    transfer: "Transfer",
    rental_car: "Rental Car",
    activity: "Activity",
    insurance: "Insurance",
  };

  return componentType ? labels[componentType] ?? componentType : "Trip Component";
}

function getComponentDisplayName(component: ComponentOption) {
  const typeLabel = getComponentTypeLabel(component.component_type);
  const detail =
    component.display_name ||
    component.supplier_name ||
    component.confirmation_number ||
    null;

  return detail ? `${typeLabel} - ${detail}` : typeLabel;
}

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

async function createCommission(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const commission_name = String(formData.get("commission_name") ?? "").trim();

  if (!commission_name) {
    throw new Error("Commission name is required.");
  }

  const client_account_id = cleanText(formData, "client_account_id");
  const trip_id = cleanText(formData, "trip_id");
  const component_id = cleanText(formData, "component_id");
  const supplier_id = cleanText(formData, "supplier_id");

  let client_name_snapshot: string | null = null;
  let trip_name_snapshot: string | null = null;
  let component_type: string | null = null;
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
      .select("trip_name, destinations, client_account_id")
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

  if (component_id) {
    if (!trip_id) {
      throw new Error("A trip is required when linking a commission to a trip component.");
    }

    const { data: component, error: componentError } = await supabase
      .from("trip_components")
      .select("id, trip_id, component_type")
      .eq("id", component_id)
      .eq("trip_id", trip_id)
      .maybeSingle();

    if (componentError || !component) {
      throw new Error(componentError?.message ?? "Selected trip component was not found.");
    }

    component_type = component.component_type ?? null;
  }

  const gross_booking_amount = toMoneyNumber(
    formData.get("gross_booking_amount"),
  );

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

  const { data, error } = await supabase
    .from("commissions")
    .insert({
      client_account_id,
      trip_id,
      component_id,
      component_type,
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
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const returnToTripId = cleanText(formData, "return_to_trip_id");

  if (returnToTripId) {
    redirect(`/admin/trips/${returnToTripId}?saved=Commission#commissions`);
  }

  redirect(`/admin/commissions/${data.id}?saved=created`);
}

export default async function NewCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{
    tripId?: string;
    supplierId?: string;
    componentId?: string;
    bookingNumber?: string;
    commissionName?: string;
    grossBookingAmount?: string;
    fullCommissionAmount?: string;
  }>;
}) {
  const {
    tripId,
    supplierId,
    componentId,
    bookingNumber,
    commissionName,
    grossBookingAmount,
    fullCommissionAmount,
  } = await searchParams;

  const selectedTripId = String(tripId ?? "").trim();
  const selectedSupplierId = String(supplierId ?? "").trim();
  const selectedComponentId = String(componentId ?? "").trim();

  const defaultBookingNumber = String(bookingNumber ?? "").trim();
  const defaultCommissionName = String(commissionName ?? "").trim();
  const defaultGrossBookingAmount = String(grossBookingAmount ?? "").trim();
  const defaultFullCommissionAmount = String(fullCommissionAmount ?? "").trim();

  const { supabase } = await requireAdmin();

  const { data: clients } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true });

  const { data: trips } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, destinations")
    .order("departure_date", { ascending: false });

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_type")
    .order("supplier_name", { ascending: true });

  const clientRows = (clients ?? []) as ClientOption[];
  const tripRows = (trips ?? []) as TripOption[];
  const supplierRows = (suppliers ?? []) as SupplierOption[];

  const selectedTrip = tripRows.find((trip) => trip.id === selectedTripId);
  const selectedClientId = selectedTrip?.client_account_id ?? "";

  const selectedSupplier = supplierRows.find(
    (supplier) => supplier.id === selectedSupplierId,
  );

  let selectedComponent: ComponentOption | null = null;
  let linkedComponentDocumentCount = 0;

  if (selectedComponentId && selectedTripId) {
    const { data: component } = await supabase
      .from("trip_components")
      .select("id, component_type, display_name, supplier_name, confirmation_number")
      .eq("id", selectedComponentId)
      .eq("trip_id", selectedTripId)
      .maybeSingle();

    selectedComponent = (component as ComponentOption | null) ?? null;

    if (selectedComponent) {
      const { count } = await supabase
        .from("trip_documents")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", selectedTripId)
        .eq("component_id", selectedComponent.id);

      linkedComponentDocumentCount = count ?? 0;
    }
  }

  const generatedCommissionName =
    defaultCommissionName ||
    [
      selectedSupplier?.supplier_name,
      selectedTrip?.trip_name ?? selectedTrip?.destinations,
      "Commission",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <PageShell
      title="Add New Commission"
      subtitle="Create a commission tracking record."
    >
      <form action={createCommission} className="card stack" style={{ maxWidth: 900 }}>
        <input type="hidden" name="return_to_trip_id" value={selectedTripId} />
        <input type="hidden" name="component_id" value={selectedComponent?.id ?? ""} />

        <section className="stack">
          <h2 style={{ margin: 0 }}>Commission Basics</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Commission Name</span>
              <input
                name="commission_name"
                type="text"
                placeholder="Example: Disney Package Commission"
                defaultValue={generatedCommissionName}
                required
                className="input"
              />
            </label>

            <label className="stack-sm">
              <span className="label">Booking Number</span>
              <input
                name="booking_number"
                type="text"
                defaultValue={defaultBookingNumber}
                className="input"
              />
            </label>

            <label className="stack-sm">
              <span className="label">Status</span>
              <select name="commission_status" defaultValue="expected" className="select">
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

          {selectedTrip ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              <strong>Trip pre-selected:</strong>{" "}
              {selectedTrip.trip_name ?? selectedTrip.destinations ?? "Selected Trip"}
            </div>
          ) : null}

          {selectedSupplier ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              <strong>Supplier pre-selected:</strong>{" "}
              {selectedSupplier.supplier_name}
              {selectedSupplier.supplier_type
                ? ` — ${selectedSupplier.supplier_type}`
                : ""}
            </div>
          ) : null}

          {selectedComponent ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#ecfdf3",
                border: "1px solid #bbf7d0",
                color: "#166534",
                lineHeight: 1.5,
              }}
            >
              <strong>Component linked:</strong>{" "}
              {getComponentDisplayName(selectedComponent)}
              <br />
              {linkedComponentDocumentCount > 0
                ? `${linkedComponentDocumentCount} component document${linkedComponentDocumentCount === 1 ? "" : "s"} will appear on this commission record.`
                : "No component documents are attached yet. Documents added later to this component will appear on the commission record automatically."}
            </div>
          ) : null}

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Client</span>
              <select name="client_account_id" defaultValue={selectedClientId} className="select">
                <option value="">No client selected</option>
                {clientRows.map((client) => (
                  <option key={client.id} value={client.id}>
                    {getClientDisplayName(client)}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">Trip</span>
              <select name="trip_id" defaultValue={selectedTripId} className="select">
                <option value="">No trip selected</option>
                {tripRows.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.trip_name ?? trip.destinations ?? "Unnamed Trip"}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">Supplier</span>
              <select name="supplier_id" defaultValue={selectedSupplierId} className="select">
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
              <span className="label">Manual Supplier Name</span>
              <input
                name="supplier_name_snapshot"
                type="text"
                className="input"
                defaultValue={selectedSupplier?.supplier_name ?? ""}
                placeholder="Use if supplier is not in the supplier list yet"
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Amounts</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Gross Booking Amount</span>
              <input
                name="gross_booking_amount"
                type="number"
                step="0.01"
                className="input"
                defaultValue={defaultGrossBookingAmount || "0"}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Full Commission</span>
              <input
                name="full_commission_amount"
                type="number"
                step="0.01"
                className="input"
                defaultValue={defaultFullCommissionAmount || "0"}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Your Commission %</span>
              <input
                name="agency_commission_percent"
                type="number"
                step="0.01"
                className="input"
                defaultValue="90"
              />
            </label>

            <label className="stack-sm">
              <span className="label">Received Amount</span>
              <input
                name="received_commission_amount"
                type="number"
                step="0.01"
                className="input"
                defaultValue="0"
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
              <strong>Expected Commission:</strong> This will calculate automatically
              when saved. Example: $1,000 full commission × 90% = $900 expected
              commission.
            </div>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Payment Timing</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Expected Payment Date</span>
              <input name="expected_payment_date" type="date" className="input" />
            </label>

            <label className="stack-sm">
              <span className="label">Received Payment Date</span>
              <input name="received_payment_date" type="date" className="input" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Notes</h2>
          <textarea
            name="notes"
            rows={5}
            className="textarea"
            placeholder="Supplier follow-up notes, payment notes, manual tracking details, etc."
          />
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            Create Commission
          </button>

          <a
            href={selectedTripId ? `/admin/trips/${selectedTripId}` : "/admin/commissions"}
            className="btn btn-primary"
          >
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}
