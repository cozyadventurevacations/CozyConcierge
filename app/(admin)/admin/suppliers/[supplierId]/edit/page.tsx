import { redirect } from "next/navigation";
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
  preferred_supplier: boolean | null;
  commission_notes: string | null;
  internal_notes: string | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
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
      <form action={saveSupplier} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Supplier Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Supplier Name</span>
              <input
                name="supplier_name"
                type="text"
                defaultValue={supplierRow.supplier_name ?? ""}
                required
              />
            </label>

            <label className="stack-sm">
              <span>Supplier Type</span>
              <select
                name="supplier_type"
                defaultValue={supplierRow.supplier_type ?? ""}
              >
                <option value="">Select supplier type</option>
                <option value="Hotel / Resort">Hotel / Resort</option>
                <option value="Cruise Line">Cruise Line</option>
                <option value="Tour Operator">Tour Operator</option>
                <option value="Transfer Company">Transfer Company</option>
                <option value="Rental Car">Rental Car</option>
                <option value="Airline">Airline</option>
                <option value="Insurance">Insurance</option>
                <option value="Theme Park">Theme Park</option>
                <option value="Activity / Excursion">Activity / Excursion</option>
                <option value="Wholesaler">Wholesaler</option>
                <option value="Destination Management Company">
                  Destination Management Company
                </option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <input
              name="preferred_supplier"
              type="checkbox"
              defaultChecked={Boolean(supplierRow.preferred_supplier)}
            />
            <span>Preferred supplier</span>
          </label>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Contact Details</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Contact Name</span>
              <input
                name="contact_name"
                type="text"
                defaultValue={supplierRow.contact_name ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Contact Email</span>
              <input
                name="contact_email"
                type="email"
                defaultValue={supplierRow.contact_email ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Contact Phone</span>
              <input
                name="contact_phone"
                type="tel"
                defaultValue={supplierRow.contact_phone ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Website URL</span>
              <input
                name="website_url"
                type="url"
                defaultValue={supplierRow.website_url ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Booking Portal URL</span>
              <input
                name="booking_portal_url"
                type="url"
                defaultValue={supplierRow.booking_portal_url ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Internal Notes</h2>

          <label className="stack-sm">
            <span>Commission Notes</span>
            <textarea
              name="commission_notes"
              rows={4}
              defaultValue={supplierRow.commission_notes ?? ""}
              placeholder="Commission percentage, payment timing, tracking notes, supplier-specific reminders, etc."
            />
          </label>

          <label className="stack-sm">
            <span>General Internal Notes</span>
            <textarea
              name="internal_notes"
              rows={5}
              defaultValue={supplierRow.internal_notes ?? ""}
              placeholder="Preferred contacts, support experience, booking tips, portal notes, or internal reminders."
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button">
            Save Supplier
          </button>

          <a href={`/admin/suppliers/${supplierRow.id}`} className="button-secondary">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}