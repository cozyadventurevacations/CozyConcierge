import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type SupplierDetail = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  booking_portal_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  preferred_supplier: boolean | null;
  commission_notes: string | null;
  internal_notes: string | null;
  created_at: string | null;
};

type TripComponentRow = {
  id: string;
  trip_id: string;
  component_type: string;
  display_name: string | null;
  supplier_name: string | null;
  booking_status: string | null;
  total_price: number | null;
  confirmation_number: string | null;
  deposit_due_date: string | null;
  final_payment_due_date: string | null;
  trips:
    | {
        id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
      }
    | {
        id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
      }[]
    | null;
};

type CommissionRow = {
  id: string;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  client_name_snapshot: string | null;
  trip_name_snapshot: string | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
  trip_id: string | null;
};

type SupplierPhoneRow = {
  id: string;
  label: string;
  phone_number: string;
  contact_name: string | null;
  notes: string | null;
  sort_order: number | null;
};

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = "Not provided") {
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

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
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

function calculateExpectedCommission(
  fullCommissionAmount: number | null | undefined,
  agencyCommissionPercent: number | null | undefined,
) {
  const fullCommission = Number(fullCommissionAmount ?? 0);
  const percentage = Number(agencyCommissionPercent ?? 90);

  return Math.round(fullCommission * (percentage / 100) * 100) / 100;
}

function getExpectedCommission(row: CommissionRow) {
  return (
    Number(row.expected_commission_amount ?? 0) ||
    calculateExpectedCommission(row.full_commission_amount, row.agency_commission_percent)
  );
}

function getTripFromComponent(row: TripComponentRow) {
  if (Array.isArray(row.trips)) {
    return row.trips[0] ?? null;
  }

  return row.trips ?? null;
}

function buildAddressLines(supplier: SupplierDetail) {
  const cityStatePostal = [supplier.city, supplier.state, supplier.postal_code]
    .filter(Boolean)
    .join(", ")
    .replace(", ", supplier.city && supplier.state ? ", " : " ");

  return [
    supplier.address_line_1,
    supplier.address_line_2,
    cityStatePostal || null,
    supplier.country,
  ].filter(Boolean);
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: 12,
        background: "#f7fbfc",
        border: "1px solid #e6f0f2",
      }}
    >
      <p className="label" style={{ margin: 0 }}>
        {label}
      </p>

      <p style={{ margin: "4px 0 0", fontWeight: 700, lineHeight: 1.5 }}>
        {value === null || value === undefined || value === "" ? "Not provided" : value}
      </p>
    </div>
  );
}

function ActionButton({
  href,
  children,
  target,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <Link href={href} className="btn btn-primary" target={target} rel={rel}>
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "expected";

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
      {label}
    </span>
  );
}

async function deleteSupplierFromDetail(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const supplierId = String(formData.get("supplier_id") ?? "").trim();

  if (!supplierId) throw new Error("Missing supplier ID.");

  const [componentCheck, commissionCheck] = await Promise.all([
    supabase
      .from("trip_components")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId),
    supabase
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId),
  ]);

  if (componentCheck.error) throw new Error(componentCheck.error.message);
  if (commissionCheck.error) throw new Error(commissionCheck.error.message);

  const relatedCount = Number(componentCheck.count ?? 0) + Number(commissionCheck.count ?? 0);
  if (relatedCount > 0) {
    throw new Error("This supplier has linked trip components or commissions. Remove or reassign those records before deleting it.");
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", supplierId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers");
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const { supabase } = await requireAdmin();

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (error || !supplier) {
    return (
      <PageShell title="Supplier Detail" subtitle="We could not load this supplier.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const supplierRow = supplier as SupplierDetail;

  const { data: componentData, error: componentError } = await supabase
    .from("trip_components")
    .select(
      "id, trip_id, component_type, display_name, supplier_name, booking_status, total_price, confirmation_number, deposit_due_date, final_payment_due_date, trips(id, trip_name, destinations, departure_date, return_date)",
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  const { data: commissionData, error: commissionError } = await supabase
    .from("commissions")
    .select(
      "id, commission_name, booking_number, supplier_name_snapshot, client_name_snapshot, trip_name_snapshot, full_commission_amount, agency_commission_percent, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date, trip_id",
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  const { data: phoneData, error: phoneError } = await supabase
    .from("supplier_phone_numbers" as any)
    .select("id, label, phone_number, contact_name, notes, sort_order")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: true });

  const componentRows = (componentData ?? []) as TripComponentRow[];
  const commissionRows = (commissionData ?? []) as CommissionRow[];
  const phoneRows = (phoneData ?? []) as SupplierPhoneRow[];

  const componentTotal = componentRows.reduce(
    (sum, component) => sum + Number(component.total_price ?? 0),
    0,
  );

  const fullCommissionTotal = commissionRows.reduce(
    (sum, commission) => sum + Number(commission.full_commission_amount ?? 0),
    0,
  );

  const expectedCommissionTotal = commissionRows.reduce(
    (sum, commission) => sum + getExpectedCommission(commission),
    0,
  );

  const receivedCommissionTotal = commissionRows.reduce(
    (sum, commission) => sum + Number(commission.received_commission_amount ?? 0),
    0,
  );

  const outstandingCommissionTotal = expectedCommissionTotal - receivedCommissionTotal;
  const addressLines = buildAddressLines(supplierRow);

  return (
    <PageShell
      title={supplierRow.supplier_name}
      subtitle="Supplier details, related trip components, commissions, and internal notes."
    >
      <div className="stack">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/suppliers" className="btn btn-primary">
            Back to Suppliers
          </Link>

          {supplierRow.website_url ? (
            <ActionButton href={supplierRow.website_url} target="_blank" rel="noreferrer">
              Open Website
            </ActionButton>
          ) : null}

          {supplierRow.booking_portal_url ? (
            <ActionButton href={supplierRow.booking_portal_url} target="_blank" rel="noreferrer">
              Open Booking Portal
            </ActionButton>
          ) : null}

          <ActionButton href={`/admin/commissions/new?supplierId=${supplierRow.id}`}>
            Add Commission
          </ActionButton>

          <ActionButton href={`/admin/suppliers/${supplierRow.id}/edit`}>
            Edit Supplier
          </ActionButton>
        </div>

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
            Supplier Detail
          </p>

          <h2 style={{ margin: 0 }}>{supplierRow.supplier_name}</h2>

          <div className="grid grid-3">
            <InfoItem label="Related Trip Components" value={componentRows.length} />
            <InfoItem label="Related Component Value" value={formatMoney(componentTotal)} />
            <InfoItem label="Preferred Supplier" value={supplierRow.preferred_supplier ? "Yes" : "No"} />
            <InfoItem label="Full Commission" value={formatMoney(fullCommissionTotal)} />
            <InfoItem label="Your Expected Commission" value={formatMoney(expectedCommissionTotal)} />
            <InfoItem label="Received Commission" value={formatMoney(receivedCommissionTotal)} />
            <InfoItem label="Outstanding Commission" value={formatMoney(outstandingCommissionTotal)} />
            <InfoItem label="Created" value={formatDateTime(supplierRow.created_at)} />
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Supplier Information</h2>

            <InfoItem label="Supplier Type" value={supplierRow.supplier_type} />
            <InfoItem label="Preferred Supplier" value={supplierRow.preferred_supplier ? "Yes" : "No"} />
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Contact Details</h2>

            <InfoItem label="Contact Name" value={supplierRow.contact_name} />
            <InfoItem label="Contact Email" value={supplierRow.contact_email} />
            <InfoItem label="Contact Phone" value={supplierRow.contact_phone} />
            <InfoItem label="Website URL" value={supplierRow.website_url} />
            <InfoItem label="Booking Portal URL" value={supplierRow.booking_portal_url} />
          </div>
        </div>

        <div className="card stack">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Supplier Phone Directory</h2>
            <ActionButton href={`/admin/suppliers/${supplierRow.id}/edit`}>
              Edit Phone Lines
            </ActionButton>
          </div>

          {phoneError ? (
            <pre>{JSON.stringify(phoneError, null, 2)}</pre>
          ) : phoneRows.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              No department-specific phone numbers have been added yet.
            </p>
          ) : (
            <div className="grid grid-3">
              {phoneRows.map((phone) => (
                <div key={phone.id} style={{ padding: "14px", borderRadius: 14, border: "1px solid #e6f0f2", background: "#fbfdfe" }}>
                  <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>
                    {phone.label}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 900 }}>
                    <a href={`tel:${phone.phone_number}`}>{phone.phone_number}</a>
                  </p>
                  {phone.contact_name ? (
                    <p style={{ margin: "4px 0 0", color: "#334155", fontWeight: 700 }}>{phone.contact_name}</p>
                  ) : null}
                  {phone.notes ? (
                    <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{phone.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Supplier Address</h2>

          {addressLines.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No supplier address has been added yet.</p>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                lineHeight: 1.6,
                fontWeight: 700,
              }}
            >
              {addressLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Related Trip Components</h2>

          {componentError ? (
            <pre>{JSON.stringify(componentError, null, 2)}</pre>
          ) : componentRows.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>
              No trip components are linked to this supplier yet.
            </p>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Component</th>
                    <th>Display Name</th>
                    <th>Status</th>
                    <th>Total Price</th>
                    <th>Confirmation #</th>
                    <th>Travel Dates</th>
                    <th>Payment Dates</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {componentRows.map((component) => {
                    const trip = getTripFromComponent(component);

                    return (
                      <tr key={component.id}>
                        <td>{trip?.trip_name ?? trip?.destinations ?? "Unnamed Trip"}</td>
                        <td>{component.component_type}</td>
                        <td>{component.display_name ?? component.supplier_name ?? "Not provided"}</td>
                        <td>{component.booking_status ?? "Not provided"}</td>
                        <td>{formatMoney(component.total_price)}</td>
                        <td>{component.confirmation_number ?? "Not provided"}</td>
                        <td>
                          {formatDate(trip?.departure_date, "")}
                          {trip?.return_date ? ` → ${formatDate(trip.return_date, "")}` : ""}
                        </td>
                        <td>
                          {component.deposit_due_date
                            ? `Deposit: ${formatDate(component.deposit_due_date, "")}`
                            : ""}
                          {component.deposit_due_date && component.final_payment_due_date ? " | " : ""}
                          {component.final_payment_due_date
                            ? `Final: ${formatDate(component.final_payment_due_date, "")}`
                            : ""}
                        </td>
                        <td>
                          <Link href={`/admin/trips/${component.trip_id}`}>Open Trip</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Related Commissions</h2>

          {commissionError ? (
            <pre>{JSON.stringify(commissionError, null, 2)}</pre>
          ) : commissionRows.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>
              No commission records are linked to this supplier yet.
            </p>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th>Commission</th>
                    <th>Client</th>
                    <th>Trip</th>
                    <th>Booking #</th>
                    <th>Status</th>
                    <th>Full</th>
                    <th>Your %</th>
                    <th>Your Expected</th>
                    <th>Received</th>
                    <th>Expected Date</th>
                    <th>Received Date</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {commissionRows.map((commission) => {
                    const expectedCommission = getExpectedCommission(commission);

                    return (
                      <tr key={commission.id}>
                        <td>{commission.commission_name}</td>
                        <td>{commission.client_name_snapshot ?? "Not provided"}</td>
                        <td>{commission.trip_name_snapshot ?? "Not provided"}</td>
                        <td>{commission.booking_number ?? "Not provided"}</td>
                        <td>
                          <StatusBadge status={commission.commission_status} />
                        </td>
                        <td>{formatMoney(commission.full_commission_amount)}</td>
                        <td>{commission.agency_commission_percent ?? 90}%</td>
                        <td>{formatMoney(expectedCommission)}</td>
                        <td>{formatMoney(commission.received_commission_amount)}</td>
                        <td>{formatDate(commission.expected_payment_date)}</td>
                        <td>{formatDate(commission.received_payment_date)}</td>
                        <td>
                          <Link href={`/admin/commissions/${commission.id}`}>Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Internal Notes</h2>

          <InfoItem label="Commission Notes" value={supplierRow.commission_notes} />
          <InfoItem label="General Internal Notes" value={supplierRow.internal_notes} />
        </div>

        <div className="card stack" style={{ border: "1px solid #fecaca", background: "#fff1f2" }}>
          <h2 style={{ margin: 0, color: "#be123c" }}>Delete Supplier</h2>
          {componentRows.length > 0 || commissionRows.length > 0 ? (
            <p style={{ margin: 0, color: "#9f1239", lineHeight: 1.6 }}>
              This supplier has linked trip components or commissions, so it cannot be deleted yet. Reassign or remove those records first.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, color: "#9f1239", lineHeight: 1.6 }}>
                This permanently removes the supplier record. Use this only for duplicates or suppliers added by mistake.
              </p>
              <form action={deleteSupplierFromDetail}>
                <input type="hidden" name="supplier_id" value={supplierRow.id} />
                <button type="submit" className="btn btn-outline" style={{ color: "#be123c", borderColor: "#fecaca" }}>
                  Delete Supplier
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
