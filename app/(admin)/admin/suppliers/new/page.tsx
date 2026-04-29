import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
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
      subtitle="Create a supplier or vendor record."
    >
      <form action={createSupplier} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Supplier Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Supplier Name</span>
              <input name="supplier_name" type="text" required />
            </label>

            <label className="stack-sm">
              <span>Supplier Type</span>
              <select name="supplier_type" defaultValue="">
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
            <input name="preferred_supplier" type="checkbox" />
            <span>Preferred supplier</span>
          </label>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Contact Details</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Contact Name</span>
              <input name="contact_name" type="text" />
            </label>

            <label className="stack-sm">
              <span>Contact Email</span>
              <input name="contact_email" type="email" />
            </label>

            <label className="stack-sm">
              <span>Contact Phone</span>
              <input name="contact_phone" type="tel" />
            </label>

            <label className="stack-sm">
              <span>Website URL</span>
              <input name="website_url" type="url" />
            </label>

            <label className="stack-sm">
              <span>Booking Portal URL</span>
              <input name="booking_portal_url" type="url" />
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
              placeholder="Commission percentage, payment timing, tracking notes, supplier-specific reminders, etc."
            />
          </label>

          <label className="stack-sm">
            <span>General Internal Notes</span>
            <textarea
              name="internal_notes"
              rows={5}
              placeholder="Preferred contacts, support experience, booking tips, portal notes, or internal reminders."
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button">
            Create Supplier
          </button>

          <a href="/admin/suppliers" className="button-secondary">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}