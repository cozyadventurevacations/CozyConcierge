import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";

type ClientDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  preferred_airport: string | null;
  travel_style: string | null;
  accessibility_notes: string | null;
  passport_number: string | null;
  passport_expiration_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

async function updateClient(clientId: string, formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const first_name = cleanText(formData, "first_name");
  const last_name = cleanText(formData, "last_name");

  if (!first_name && !last_name) {
    throw new Error("A first name or last name is required.");
  }

  const { error } = await supabase
    .from("client_accounts")
    .update({
      first_name,
      last_name,
      email: cleanText(formData, "email"),
      phone_primary: cleanText(formData, "phone_primary"),
      phone_secondary: cleanText(formData, "phone_secondary"),

      address_line_1: cleanText(formData, "address_line_1"),
      address_line_2: cleanText(formData, "address_line_2"),
      city: cleanText(formData, "city"),
      state: cleanText(formData, "state"),
      postal_code: cleanText(formData, "postal_code"),

      date_of_birth: cleanText(formData, "date_of_birth"),
      preferred_airport: cleanText(formData, "preferred_airport"),
      travel_style: cleanText(formData, "travel_style"),
      accessibility_notes: cleanText(formData, "accessibility_notes"),

      passport_number: cleanText(formData, "passport_number"),
      passport_expiration_date: cleanText(formData, "passport_expiration_date"),

      emergency_contact_name: cleanText(formData, "emergency_contact_name"),
      emergency_contact_phone: cleanText(formData, "emergency_contact_phone"),

      notes: cleanText(formData, "notes"),
    })
    .eq("id", clientId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/clients/${clientId}`);
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase } = await requireAdmin();

  const { data: client, error } = await supabase
    .from("client_accounts")
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone_primary,
      phone_secondary,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      date_of_birth,
      preferred_airport,
      travel_style,
      accessibility_notes,
      passport_number,
      passport_expiration_date,
      emergency_contact_name,
      emergency_contact_phone,
      notes
      `,
    )
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return (
      <PageShell title="Edit Client" subtitle="We could not load this client.">
        <div className="card">
          <p>
            <strong>Error loading client:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientRow = client as ClientDetail;

  const saveClient = updateClient.bind(null, clientRow.id);

  const clientName =
    `${clientRow.first_name ?? ""} ${clientRow.last_name ?? ""}`.trim() ||
    "Unnamed Client";

  return (
    <PageShell
      title={`Edit ${clientName}`}
      subtitle="Update this client record."
    >
      <form action={saveClient} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Basic Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>First Name</span>
              <input
                name="first_name"
                type="text"
                defaultValue={clientRow.first_name ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Last Name</span>
              <input
                name="last_name"
                type="text"
                defaultValue={clientRow.last_name ?? ""}
              />
            </label>
          </div>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={clientRow.email ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Date of Birth</span>
              <input
                name="date_of_birth"
                type="date"
                defaultValue={clientRow.date_of_birth ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Phone Numbers</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Primary Phone</span>
              <input
                name="phone_primary"
                type="tel"
                defaultValue={clientRow.phone_primary ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Secondary Phone</span>
              <input
                name="phone_secondary"
                type="tel"
                defaultValue={clientRow.phone_secondary ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Address</h2>

          <label className="stack-sm">
            <span>Address Line 1</span>
            <input
              name="address_line_1"
              type="text"
              defaultValue={clientRow.address_line_1 ?? ""}
            />
          </label>

          <label className="stack-sm">
            <span>Address Line 2</span>
            <input
              name="address_line_2"
              type="text"
              defaultValue={clientRow.address_line_2 ?? ""}
            />
          </label>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span>City</span>
              <input
                name="city"
                type="text"
                defaultValue={clientRow.city ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>State</span>
              <input
                name="state"
                type="text"
                maxLength={2}
                defaultValue={clientRow.state ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>ZIP / Postal Code</span>
              <input
                name="postal_code"
                type="text"
                defaultValue={clientRow.postal_code ?? ""}
              />
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
                defaultValue={clientRow.preferred_airport ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Travel Style</span>
              <select
                name="travel_style"
                defaultValue={clientRow.travel_style ?? ""}
              >
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
              defaultValue={clientRow.accessibility_notes ?? ""}
            />
          </label>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Passport Information</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Passport Number</span>
              <input
                name="passport_number"
                type="text"
                defaultValue={clientRow.passport_number ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Passport Expiration Date</span>
              <input
                name="passport_expiration_date"
                type="date"
                defaultValue={clientRow.passport_expiration_date ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Emergency Contact</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span>Emergency Contact Name</span>
              <input
                name="emergency_contact_name"
                type="text"
                defaultValue={clientRow.emergency_contact_name ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span>Emergency Contact Phone</span>
              <input
                name="emergency_contact_phone"
                type="tel"
                defaultValue={clientRow.emergency_contact_phone ?? ""}
              />
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
              defaultValue={clientRow.notes ?? ""}
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button">
            Save Changes
          </button>

          <a href={`/admin/clients/${clientRow.id}`} className="button-secondary">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}