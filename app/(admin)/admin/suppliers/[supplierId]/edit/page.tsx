import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const supplierTypes = [
  "Hotel / Resort",
  "Cruise Line",
  "Tour Operator",
  "Transfer Company",
  "Rental Car",
  "Airline",
  "Insurance",
  "Theme Park",
  "Activity / Excursion",
  "Wholesaler",
  "Destination Management Company",
  "Rail",
  "River Cruise",
  "All-Inclusive Resort",
  "Villa / Vacation Rental",
  "Travel Technology",
  "Other",
];

type SupplierDetail = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  booking_portal_url: string | null;
  preferred_supplier: boolean | null;
  commission_notes: string | null;
  internal_notes: string | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: string[];
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">Select supplier type</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  rows = 4,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <textarea
        className="textarea"
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
      />
    </label>
  );
}

async function updateSupplier(supplierId: string, formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const supplier_name = String(formData.get("supplier_name") ?? "").trim();

  if (!supplier_name) {
    throw new Error("Supplier name is required.");
  }

  const preferred_supplier = formData.get("preferred_supplier") === "on";

  const { error } = await supabase
    .from("suppliers")
    .update({
      supplier_name,
      supplier_type: cleanText(formData, "supplier_type"),
      contact_name: cleanText(formData, "contact_name"),
      contact_email: cleanText(formData, "contact_email"),
      contact_phone: cleanText(formData, "contact_phone"),
      website_url: cleanText(formData, "website_url"),
      booking_portal_url: cleanText(formData, "booking_portal_url"),
      preferred_supplier,
      commission_notes: cleanText(formData, "commission_notes"),
      internal_notes: cleanText(formData, "internal_notes"),
    })
    .eq("id", supplierId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/suppliers/${supplierId}`);
}

export default async function EditSupplierPage({
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
      <PageShell title="Edit Supplier" subtitle="We could not load this supplier.">
        <div className="card">
          <p>
            <strong>Error loading supplier:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const supplierRow = supplier as SupplierDetail;
  const saveSupplier = updateSupplier.bind(null, supplierRow.id);

  return (
    <PageShell
      title={`Edit ${supplierRow.supplier_name}`}
      subtitle="Update supplier contact details, booking links, and internal notes."
    >
      <form action={saveSupplier} className="stack" style={{ maxWidth: 1100 }}>
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
            Supplier Edit
          </p>

          <h2 style={{ margin: 0 }}>Supplier Information</h2>

          <div className="grid grid-2">
            <Field
              label="Supplier Name"
              name="supplier_name"
              defaultValue={supplierRow.supplier_name}
              required
            />

            <SelectField
              label="Supplier Type"
              name="supplier_type"
              defaultValue={supplierRow.supplier_type}
              options={supplierTypes}
            />
          </div>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              cursor: "pointer",
            }}
          >
            <input
              name="preferred_supplier"
              type="checkbox"
              defaultChecked={Boolean(supplierRow.preferred_supplier)}
            />
            <span style={{ lineHeight: 1.45 }}>
              <strong>Preferred supplier</strong>
            </span>
          </label>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Contact Details</h2>

          <div className="grid grid-2">
            <Field
              label="Contact Name"
              name="contact_name"
              defaultValue={supplierRow.contact_name}
              placeholder="e.g. Sales manager, BDM, group contact"
            />

            <Field
              label="Contact Email"
              name="contact_email"
              type="email"
              defaultValue={supplierRow.contact_email}
              placeholder="name@example.com"
            />

            <Field
              label="Contact Phone"
              name="contact_phone"
              type="tel"
              defaultValue={supplierRow.contact_phone}
              placeholder="Phone number or direct line"
            />

            <Field
              label="Website URL"
              name="website_url"
              type="url"
              defaultValue={supplierRow.website_url}
              placeholder="https://example.com"
            />

            <Field
              label="Booking Portal URL"
              name="booking_portal_url"
              type="url"
              defaultValue={supplierRow.booking_portal_url}
              placeholder="https://supplier-booking-portal.com"
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Internal Notes</h2>

          <TextAreaField
            label="Commission Notes"
            name="commission_notes"
            rows={4}
            defaultValue={supplierRow.commission_notes}
            placeholder="Commission percentage, payment timing, tracking notes, supplier-specific reminders, etc."
          />

          <TextAreaField
            label="General Internal Notes"
            name="internal_notes"
            rows={5}
            defaultValue={supplierRow.internal_notes}
            placeholder="Preferred contacts, support experience, booking tips, portal notes, or internal reminders."
          />

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              lineHeight: 1.6,
            }}
          >
            <strong>Internal use reminder:</strong> Do not store supplier portal passwords,
            full credit card numbers, or sensitive client payment information in supplier
            notes.
          </div>
        </div>

        <div
          className="card stack"
          style={{
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <h2 style={{ margin: 0 }}>Save Supplier</h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Save Supplier
            </button>

            <Link href={`/admin/suppliers/${supplierRow.id}`} className="btn btn-primary">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </PageShell>
  );
}