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

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
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
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  rows = 4,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <textarea
        className="textarea"
        name={name}
        rows={rows}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue="">
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

async function createSupplier(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const supplier_name = String(formData.get("supplier_name") ?? "").trim();

  if (!supplier_name) {
    throw new Error("Supplier name is required.");
  }

  const preferred_supplier = formData.get("preferred_supplier") === "on";

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
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
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/suppliers/${data.id}`);
}

export default async function NewSupplierPage() {
  await requireAdmin();

  return (
    <PageShell
      title="Add New Supplier"
      subtitle="Create a supplier, vendor, partner, or booking contact record."
    >
      <form action={createSupplier} className="stack" style={{ maxWidth: 1100 }}>
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
            Supplier Setup
          </p>

          <h2 style={{ margin: 0 }}>Supplier Information</h2>

          <div className="grid grid-2">
            <Field
              label="Supplier Name"
              name="supplier_name"
              required
              placeholder="e.g. Royal Caribbean, Apple Vacations, Delta Air Lines"
            />

            <SelectField
              label="Supplier Type"
              name="supplier_type"
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
            <input name="preferred_supplier" type="checkbox" />
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
              placeholder="e.g. Sales manager, BDM, group contact"
            />

            <Field
              label="Contact Email"
              name="contact_email"
              type="email"
              placeholder="name@example.com"
            />

            <Field
              label="Contact Phone"
              name="contact_phone"
              type="tel"
              placeholder="Phone number or direct line"
            />

            <Field
              label="Website URL"
              name="website_url"
              type="url"
              placeholder="https://example.com"
            />

            <Field
              label="Booking Portal URL"
              name="booking_portal_url"
              type="url"
              placeholder="https://supplier-booking-portal.com"
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Commission & Internal Notes</h2>

          <TextAreaField
            label="Commission Notes"
            name="commission_notes"
            rows={4}
            placeholder="e.g. 10% commission, paid 30–60 days after travel, track by booking number."
          />

          <TextAreaField
            label="General Internal Notes"
            name="internal_notes"
            rows={5}
            placeholder="e.g. Preferred contacts, support experience, booking tips, portal notes, or internal reminders."
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
              Create Supplier
            </button>

            <Link href="/admin/suppliers" className="btn btn-primary">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </PageShell>
  );
}