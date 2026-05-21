import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { AirportPicker } from "@/components/forms/airport-picker";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { encryptIfPresent, decryptIfPresent } from "@/lib/encryption";

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
  passport_date_issued: string | null;
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
      passport_number: encryptIfPresent(cleanText(formData, "passport_number")),
      passport_date_issued: cleanText(formData, "passport_date_issued"),
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
      passport_date_issued,
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
    <PageShell title={`Edit ${clientName}`} subtitle="Update this client record.">
      <form action={saveClient} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Basic Information</h2>
          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">First Name</span>
              <input
                className="input"
                name="first_name"
                type="text"
                defaultValue={clientRow.first_name ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Last Name</span>
              <input
                className="input"
                name="last_name"
                type="text"
                defaultValue={clientRow.last_name ?? ""}
              />
            </label>
          </div>
          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Email</span>
              <input
                className="input"
                name="email"
                type="email"
                defaultValue={clientRow.email ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Date of Birth</span>
              <input
                className="input"
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
              <span className="label">Primary Phone</span>
              <input
                className="input"
                name="phone_primary"
                type="tel"
                defaultValue={clientRow.phone_primary ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Secondary Phone</span>
              <input
                className="input"
                name="phone_secondary"
                type="tel"
                defaultValue={clientRow.phone_secondary ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Address</h2>
          <AddressAutocomplete
            addressLine1Default={clientRow.address_line_1}
            addressLine2Default={clientRow.address_line_2}
            cityDefault={clientRow.city}
            stateDefault={clientRow.state}
            postalCodeDefault={clientRow.postal_code}
            helperText="Start typing the client's street address, then choose the best match. Existing saved address details are shown here first."
          />
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Travel Preferences</h2>
          <div className="grid grid-2">
            <AirportPicker
              label="Preferred Airport"
              name="preferred_airport"
              defaultValue={clientRow.preferred_airport}
              helper="Search by airport code, city, or airport name. e.g. ORD, Chicago, Orlando."
            />
            <label className="stack-sm">
              <span className="label">Travel Style</span>
              <select
                className="select"
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
            <span className="label">Accessibility / Mobility Notes</span>
            <textarea
              className="textarea"
              name="accessibility_notes"
              rows={4}
              defaultValue={clientRow.accessibility_notes ?? ""}
            />
          </label>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Passport Information</h2>
          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Passport Number</span>
              <input
                className="input"
                name="passport_number"
                type="text"
                defaultValue={decryptIfPresent(clientRow.passport_number) ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Passport Date Issued</span>
              <input
                className="input"
                name="passport_date_issued"
                type="date"
                defaultValue={clientRow.passport_date_issued ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Passport Expiration Date</span>
              <input
                className="input"
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
              <span className="label">Emergency Contact Name</span>
              <input
                className="input"
                name="emergency_contact_name"
                type="text"
                defaultValue={clientRow.emergency_contact_name ?? ""}
              />
            </label>
            <label className="stack-sm">
              <span className="label">Emergency Contact Phone</span>
              <input
                className="input"
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
            <span className="label">Notes</span>
            <textarea
              className="textarea"
              name="notes"
              rows={5}
              defaultValue={clientRow.notes ?? ""}
            />
          </label>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
          <Link href={`/admin/clients/${clientRow.id}`} className="btn btn-primary">
            Cancel
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
