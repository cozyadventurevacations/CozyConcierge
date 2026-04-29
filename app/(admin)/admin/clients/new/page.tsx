import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";

async function createClient(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone_primary = String(formData.get("phone_primary") ?? "").trim();
  const phone_secondary = String(formData.get("phone_secondary") ?? "").trim();

  const address_line_1 = String(formData.get("address_line_1") ?? "").trim();
  const address_line_2 = String(formData.get("address_line_2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postal_code = String(formData.get("postal_code") ?? "").trim();

  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim();
  const preferred_airport = String(formData.get("preferred_airport") ?? "").trim();
  const travel_style = String(formData.get("travel_style") ?? "").trim();
  const accessibility_notes = String(
    formData.get("accessibility_notes") ?? "",
  ).trim();

  const passport_number = String(formData.get("passport_number") ?? "").trim();
  const passport_expiration_date = String(
    formData.get("passport_expiration_date") ?? "",
  ).trim();

  const emergency_contact_name = String(
    formData.get("emergency_contact_name") ?? "",
  ).trim();
  const emergency_contact_phone = String(
    formData.get("emergency_contact_phone") ?? "",
  ).trim();

  const notes = String(formData.get("notes") ?? "").trim();

  if (!first_name && !last_name) {
    throw new Error("A first name or last name is required.");
  }

  const { data, error } = await supabase
    .from("client_accounts")
    .insert({
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || null,
      phone_primary: phone_primary || null,
      phone_secondary: phone_secondary || null,

      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,

      date_of_birth: date_of_birth || null,
      preferred_airport: preferred_airport || null,
      travel_style: travel_style || null,
      accessibility_notes: accessibility_notes || null,

      passport_number: passport_number || null,
      passport_expiration_date: passport_expiration_date || null,

      emergency_contact_name: emergency_contact_name || null,
      emergency_contact_phone: emergency_contact_phone || null,

      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/clients/${data.id}`);
}

export default async function NewClientPage() {
  await requireAdmin();

  return (
    <PageShell
      title="Add New Client"
      subtitle="Create a complete client record for Cozy Concierge."
    >
      <form action={createClient} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Basic Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>First Name</span>
              <input name="first_name" type="text" />
            </label>

            <label className="stack-sm">
              <span>Last Name</span>
              <input name="last_name" type="text" />
            </label>
          </div>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Email</span>
              <input name="email" type="email" />
            </label>

            <label className="stack-sm">
              <span>Date of Birth</span>
              <input name="date_of_birth" type="date" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Phone Numbers</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Primary Phone</span>
              <input name="phone_primary" type="tel" />
            </label>

            <label className="stack-sm">
              <span>Secondary Phone</span>
              <input name="phone_secondary" type="tel" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Address</h2>

          <label className="stack-sm">
            <span>Address Line 1</span>
            <input name="address_line_1" type="text" />
          </label>

          <label className="stack-sm">
            <span>Address Line 2</span>
            <input name="address_line_2" type="text" />
          </label>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span>City</span>
              <input name="city" type="text" />
            </label>

            <label className="stack-sm">
              <span>State</span>
              <input name="state" type="text" maxLength={2} />
            </label>

            <label className="stack-sm">
              <span>ZIP / Postal Code</span>
              <input name="postal_code" type="text" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Travel Preferences</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Preferred Airport</span>
              <input
                name="preferred_airport"
                type="text"
                placeholder="Example: ORD, MDW, MCO"
              />
            </label>

            <label className="stack-sm">
              <span>Travel Style</span>
              <select name="travel_style" defaultValue="">
                <option value="">Select travel style</option>
                <option value="Relaxed">Relaxed</option>
                <option value="Adventure">Adventure</option>
                <option value="Luxury">Luxury</option>
                <option value="Family">Family</option>
                <option value="Multigenerational">Multigenerational</option>
                <option value="Cruise">Cruise</option>
                <option value="Disney/Universal">Disney/Universal</option>
                <option value="All-Inclusive">All-Inclusive</option>
                <option value="Group Travel">Group Travel</option>
              </select>
            </label>
          </div>

          <label className="stack-sm">
            <span>Accessibility / Mobility Notes</span>
            <textarea
              name="accessibility_notes"
              rows={4}
              placeholder="Mobility needs, accessible room requests, dietary considerations, service animal notes, etc."
            />
          </label>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Passport Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Passport Number</span>
              <input name="passport_number" type="text" />
            </label>

            <label className="stack-sm">
              <span>Passport Expiration Date</span>
              <input name="passport_expiration_date" type="date" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Emergency Contact</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Emergency Contact Name</span>
              <input name="emergency_contact_name" type="text" />
            </label>

            <label className="stack-sm">
              <span>Emergency Contact Phone</span>
              <input name="emergency_contact_phone" type="tel" />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Internal Notes</h2>

          <label className="stack-sm">
            <span>Notes</span>
            <textarea
              name="notes"
              rows={5}
              placeholder="Important preferences, communication notes, family details, trip ideas, or advisor-only reminders."
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button">
            Create Client
          </button>

          <a href="/admin/clients" className="button-secondary">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}