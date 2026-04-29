import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const travelStyles = [
  "Relaxed",
  "Adventure",
  "Luxury",
  "Family",
  "Multigenerational",
  "Cruise",
  "Disney/Universal",
  "All-Inclusive",
  "Group Travel",
  "Wellness",
  "Romance",
  "Special Occasion",
];

const airlineSeatingPreferences = [
  "Aisle",
  "Window",
  "Middle",
  "No preference",
];

const airlineClassPreferences = [
  "First Class",
  "Business",
  "Premium Economy / Economy Plus",
  "Economy",
  "No preference",
];

const cruiseCabinPreferences = [
  "Suite",
  "Family Suite",
  "Junior Suite",
  "Balcony",
  "Ocean View",
  "Interior",
  "Accessible Cabin",
  "Connecting Cabins",
  "Family Cabin",
  "No preference",
];

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  placeholder = "Select an option",
}: {
  label: string;
  name: string;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue="">
        <option value="">{placeholder}</option>
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

async function createClient(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();

  if (!first_name && !last_name) {
    throw new Error("A first name or last name is required.");
  }

  const { data, error } = await supabase
    .from("client_accounts")
    .insert({
      first_name: first_name || null,
      last_name: last_name || null,
      preferred_name: cleanText(formData, "preferred_name"),
      email: cleanText(formData, "email"),
      phone_primary: cleanText(formData, "phone_primary"),
      phone_secondary: cleanText(formData, "phone_secondary"),

      address_line_1: cleanText(formData, "address_line_1"),
      address_line_2: cleanText(formData, "address_line_2"),
      city: cleanText(formData, "city"),
      state: cleanText(formData, "state"),
      postal_code: cleanText(formData, "postal_code"),

      date_of_birth: cleanText(formData, "date_of_birth"),
      anniversary_date: cleanText(formData, "anniversary_date"),

      preferred_airport: cleanText(formData, "preferred_airport"),
      travel_style: cleanText(formData, "travel_style"),
      airline_seating_preference: cleanText(formData, "airline_seating_preference"),
      airline_class_preference: cleanText(formData, "airline_class_preference"),
      cruise_cabin_preference: cleanText(formData, "cruise_cabin_preference"),
      travel_preference_notes: cleanText(formData, "travel_preference_notes"),
      accessibility_notes: cleanText(formData, "accessibility_notes"),
      food_allergies: cleanText(formData, "food_allergies"),

      passport_number: cleanText(formData, "passport_number"),
      passport_expiration_date: cleanText(formData, "passport_expiration_date"),

      emergency_contact_name: cleanText(formData, "emergency_contact_name"),
      emergency_contact_relationship: cleanText(
        formData,
        "emergency_contact_relationship",
      ),
      emergency_contact_phone: cleanText(formData, "emergency_contact_phone"),

      notes: cleanText(formData, "notes"),
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
      subtitle="Create a client record for Cozy Concierge."
    >
      <form action={createClient} className="stack" style={{ maxWidth: 1100 }}>
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
            Client Setup
          </p>

          <h2 style={{ margin: 0 }}>Basic Information</h2>

          <div className="grid grid-3">
            <Field label="First Name" name="first_name" placeholder="First name" />
            <Field label="Last Name" name="last_name" placeholder="Last name" />
            <Field
              label="Preferred Name"
              name="preferred_name"
              placeholder="e.g. Jen, Mick, Skip"
            />
          </div>

          <div className="grid grid-2">
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="client@example.com"
            />

            <Field
              label="Date of Birth"
              name="date_of_birth"
              type="date"
            />

            <Field
              label="Anniversary Date"
              name="anniversary_date"
              type="date"
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Phone & Address</h2>

          <div className="grid grid-2">
            <Field
              label="Primary Phone"
              name="phone_primary"
              type="tel"
              placeholder="Primary phone"
            />

            <Field
              label="Secondary Phone"
              name="phone_secondary"
              type="tel"
              placeholder="Secondary phone"
            />
          </div>

          <Field
            label="Address Line 1"
            name="address_line_1"
            placeholder="Street address"
          />

          <Field
            label="Address Line 2"
            name="address_line_2"
            placeholder="Apartment, suite, unit, etc."
          />

          <div className="grid grid-3">
            <Field label="City" name="city" placeholder="City" />

            <Field
              label="State"
              name="state"
              placeholder="IL"
              maxLength={2}
            />

            <Field
              label="ZIP / Postal Code"
              name="postal_code"
              placeholder="ZIP or postal code"
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Travel Preferences</h2>

          <div className="grid grid-2">
            <Field
              label="Preferred Airport"
              name="preferred_airport"
              placeholder="e.g. ORD, MDW, MCO"
            />

            <SelectField
              label="Travel Style"
              name="travel_style"
              options={travelStyles}
              placeholder="Select travel style"
            />
          </div>

          <div className="grid grid-3">
            <SelectField
              label="Airline Seating Preference"
              name="airline_seating_preference"
              options={airlineSeatingPreferences}
            />

            <SelectField
              label="Airline Class Preference"
              name="airline_class_preference"
              options={airlineClassPreferences}
            />

            <SelectField
              label="Cruise Cabin Preference"
              name="cruise_cabin_preference"
              options={cruiseCabinPreferences}
            />
          </div>

          <TextAreaField
            label="Additional Travel Preference Notes"
            name="travel_preference_notes"
            rows={4}
            placeholder="e.g. Prefers aisle seats, forward ship cabins, connecting rooms, refundable fares."
          />

          <TextAreaField
            label="Accessibility / Mobility Notes"
            name="accessibility_notes"
            rows={4}
            placeholder="e.g. Accessible room needed, limited walking, scooter use."
          />

          <TextAreaField
            label="Food Allergies"
            name="food_allergies"
            rows={4}
            placeholder="e.g. Shellfish allergy, dairy sensitivity, no known food allergies."
          />
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Passport Information</h2>

          <div className="grid grid-2">
            <Field
              label="Passport Number"
              name="passport_number"
              placeholder="Passport number"
            />

            <Field
              label="Passport Expiration Date"
              name="passport_expiration_date"
              type="date"
            />
          </div>

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
            <strong>Sensitive information reminder:</strong> Only store passport
            details when needed for legitimate travel planning or client support.
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Emergency Contact</h2>

          <div className="grid grid-3">
            <Field
              label="Emergency Contact Name"
              name="emergency_contact_name"
              placeholder="Contact name"
            />

            <Field
              label="Relationship"
              name="emergency_contact_relationship"
              placeholder="e.g. Spouse, parent, sibling"
            />

            <Field
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              type="tel"
              placeholder="Contact phone"
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Internal Notes</h2>

          <TextAreaField
            label="Notes"
            name="notes"
            rows={5}
            placeholder="Important preferences, communication notes, family details, trip ideas, or advisor-only reminders."
          />
        </div>

        <div
          className="card stack"
          style={{
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <h2 style={{ margin: 0 }}>Save Client</h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Create Client
            </button>

            <Link href="/admin/clients" className="btn btn-primary">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </PageShell>
  );
}