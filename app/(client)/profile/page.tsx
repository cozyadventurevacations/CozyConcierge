import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { AirportPicker } from "@/components/forms/airport-picker";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  anniversary_date: string | null;
  preferred_airport: string | null;
  travel_style: string | null;
  airline_seating_preference: string | null;
  airline_class_preference: string | null;
  cruise_cabin_preference: string | null;
  travel_preference_notes: string | null;
  accessibility_notes: string | null;
  food_allergies: string | null;
  passport_number: string | null;
  passport_expiration_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string | null;
};

const commonFoodAllergies = [
  "Peanuts",
  "Tree nuts",
  "Milk / Dairy",
  "Eggs",
  "Fish",
  "Shellfish",
  "Wheat",
  "Soy",
  "Sesame",
  "Gluten sensitivity / Celiac",
  "No known food allergies",
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

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function buildFoodAllergiesValue(formData: FormData) {
  const selectedAllergies = formData
    .getAll("food_allergy_options")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const otherAllergies = String(formData.get("food_allergies_other") ?? "").trim();

  const allValues = [...selectedAllergies];

  if (otherAllergies) {
    allValues.push(`Other / Notes: ${otherAllergies}`);
  }

  return allValues.length > 0 ? allValues.join("\n") : null;
}

function isAllergyChecked(savedAllergies: string | null | undefined, allergy: string) {
  if (!savedAllergies) return false;

  return savedAllergies
    .toLowerCase()
    .split("\n")
    .map((item) => item.trim())
    .some((item) => item === allergy.toLowerCase());
}

function getOtherFoodAllergyNotes(savedAllergies: string | null | undefined) {
  if (!savedAllergies) return "";

  const lines = savedAllergies.split("\n");
  const otherLine = lines.find((line) =>
    line.toLowerCase().startsWith("other / notes:"),
  );

  if (!otherLine) return "";

  return otherLine.replace(/^Other \/ Notes:\s*/i, "").trim();
}

function getPassportStatus(expirationDate: string | null | undefined) {
  if (!expirationDate) {
    return {
      label: "Not provided",
      background: "#f7fbfc",
      color: "#667085",
      helper: "Passport expiration date has not been added yet.",
    };
  }

  const expiration = new Date(`${expirationDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiration.getTime())) {
    return {
      label: "Check date",
      background: "#fff7ed",
      color: "#c2410c",
      helper: "Passport expiration date could not be verified.",
    };
  }

  const diffMs = expiration.getTime() - today.getTime();
  const daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration < 0) {
    return {
      label: "Expired",
      background: "#fff1f2",
      color: "#be123c",
      helper: "This passport expiration date appears to be in the past.",
    };
  }

  if (daysUntilExpiration <= 180) {
    return {
      label: "Review Soon",
      background: "#fff7ed",
      color: "#c2410c",
      helper:
        "This passport expires within about 6 months. Some destinations require extra passport validity.",
    };
  }

  return {
    label: "On File",
    background: "#ecfdf3",
    color: "#027a48",
    helper: "Passport expiration date is on file.",
  };
}

function StatusPill({
  label,
  background,
  color,
}: {
  label: string;
  background: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background,
        color,
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  helper,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  helper?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
      />
      {helper ? (
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  helper,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: string[];
  helper?: string;
}) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">Choose an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {helper ? (
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  helper,
  rows = 4,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  helper?: string;
  rows?: number;
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
      {helper ? (
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function FoodAllergyCheckboxes({
  savedAllergies,
}: {
  savedAllergies: string | null | undefined;
}) {
  return (
    <div className="stack">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {commonFoodAllergies.map((allergy) => (
          <label
            key={allergy}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
              cursor: "pointer",
              lineHeight: 1.35,
            }}
          >
            <input
              type="checkbox"
              name="food_allergy_options"
              value={allergy}
              defaultChecked={isAllergyChecked(savedAllergies, allergy)}
            />
            <span>{allergy}</span>
          </label>
        ))}
      </div>

      <TextAreaField
        label="Other Food Allergies / Notes"
        name="food_allergies_other"
        defaultValue={getOtherFoodAllergyNotes(savedAllergies)}
        rows={4}
        placeholder="Example: Strawberry allergy, red dye sensitivity, prefers nut-free meals, etc."
      />
    </div>
  );
}

function InfoItem({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number | null | undefined;
  helper?: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid #eef2f5",
        borderRadius: 12,
        background: "#fbfdfe",
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "6px 0 0", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
        {value === null || value === undefined || value === ""
          ? "Not provided"
          : value}
      </p>
      {helper ? (
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = user.email?.trim().toLowerCase();

  if (!userEmail) {
    throw new Error("Your login account does not have an email address.");
  }

  const selectFields = `
    id,
    first_name,
    last_name,
    preferred_name,
    email,
    phone_primary,
    phone_secondary,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    date_of_birth,
    anniversary_date,
    preferred_airport,
    travel_style,
    airline_seating_preference,
    airline_class_preference,
    cruise_cabin_preference,
    travel_preference_notes,
    accessibility_notes,
    food_allergies,
    passport_number,
    passport_expiration_date,
    emergency_contact_name,
    emergency_contact_phone,
    notes,
    created_at
  `;

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select(selectFields)
    .ilike("email", userEmail)
    .maybeSingle();

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientAccountByEmail) {
    return {
      supabase,
      user,
      clientAccount: clientAccountByEmail as ClientAccount,
    };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select(selectFields)
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) {
    throw new Error(clientProfileError.message);
  }

  if (!clientAccountByProfile) {
    throw new Error("Client account not found.");
  }

  return {
    supabase,
    user,
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

async function updateClientProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const profileUpdates = {
    first_name: cleanText(formData, "first_name"),
    last_name: cleanText(formData, "last_name"),
    preferred_name: cleanText(formData, "preferred_name"),
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
    food_allergies: buildFoodAllergiesValue(formData),
    passport_number: cleanText(formData, "passport_number"),
    passport_expiration_date: cleanText(formData, "passport_expiration_date"),
    emergency_contact_name: cleanText(formData, "emergency_contact_name"),
    emergency_contact_phone: cleanText(formData, "emergency_contact_phone"),
  };

  const { error } = await supabase
    .from("client_accounts")
    .update(profileUpdates)
    .eq("id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile");
  revalidatePath("/trips");
  redirect("/profile?updated=profile");
}

export default async function ClientProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const { clientAccount } = await getCurrentClientAccount();

  const clientName =
    `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim() ||
    "My Profile";

  const fullAddress = [
    clientAccount.address_line_1,
    clientAccount.address_line_2,
    [clientAccount.city, clientAccount.state, clientAccount.postal_code]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  const passportStatus = getPassportStatus(clientAccount.passport_expiration_date);

  const hasEmergencyContact =
    Boolean(clientAccount.emergency_contact_name) ||
    Boolean(clientAccount.emergency_contact_phone);

  const hasFoodAllergies = Boolean(clientAccount.food_allergies);

  return (
    <PageShell
      title="My Profile"
      subtitle="Review and update the contact and travel details Cozy Adventure Vacations has on file."
    >
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
          Cozy Concierge Profile
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 32 }}>{clientName}</h1>

        {clientAccount.preferred_name ? (
          <p style={{ margin: "4px 0 0", color: "#667085" }}>
            Goes by: <strong>{clientAccount.preferred_name}</strong>
          </p>
        ) : null}

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          This is your client profile. You can update your contact details,
          emergency contact, passport information, travel preferences, accessibility
          notes, food allergies, traveler numbers, rewards memberships, and upload
          important supporting travel documents.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/trips" className="btn btn-primary">
            View My Trips
          </Link>

          <Link href="/profile/traveler-numbers" className="btn btn-primary">
            Manage Traveler Numbers & Rewards
          </Link>

          <Link href="/profile/documents/upload" className="btn btn-primary">
            Upload Travel Document
          </Link>

          <a
            href="mailto:jeremyb@cozyadventurevacations.com?subject=Profile%20Question"
            className="btn btn-primary"
          >
            Email Advisor
          </a>
        </div>
      </div>

      {updated === "profile" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Profile updated successfully.</strong>
        </div>
      ) : null}

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Primary Email</span>
          <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 800 }}>
            {clientAccount.email ?? "Not provided"}
          </p>
        </div>

        <div className="card">
          <span className="label">Preferred Airport</span>
          <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 800 }}>
            {clientAccount.preferred_airport ?? "Not provided"}
          </p>
        </div>

        <div className="card">
          <span className="label">Passport Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusPill
              label={passportStatus.label}
              background={passportStatus.background}
              color={passportStatus.color}
            />
          </p>
        </div>
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
          Traveler Profile
        </p>

        <h2 style={{ margin: 0 }}>Traveler Numbers & Rewards</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Add or update Known Traveler Numbers, Redress Numbers, Global Entry PASSIDs,
          passport reference details, airline rewards, hotel rewards, cruise loyalty
          numbers, rental car memberships, theme park rewards, rail memberships, and
          other travel-related account numbers.
        </p>

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
          <strong>Sensitive information note:</strong> Traveler numbers and rewards
          memberships may be sensitive. Do not store passwords here.
        </div>
      </div>

      <form action={updateClientProfile} className="stack">
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Edit Personal Information</h2>

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Update your basic contact information here. Your email is shown for
            reference but is not editable here because it is connected to your login.
          </p>

          <div className="grid grid-2">
            <Field
              label="First Name"
              name="first_name"
              defaultValue={clientAccount.first_name}
            />

            <Field
              label="Last Name"
              name="last_name"
              defaultValue={clientAccount.last_name}
            />

            <Field
              label="Preferred Name"
              name="preferred_name"
              defaultValue={clientAccount.preferred_name}
              placeholder="e.g. Jen, Mick, Skip"
            />

            <div
              style={{
                padding: "12px",
                border: "1px solid #eef2f5",
                borderRadius: 12,
                background: "#fbfdfe",
              }}
            >
              <span className="label">Email/Login Email</span>
              <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
                {clientAccount.email ?? "Not provided"}
              </p>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
                Contact your advisor if this email needs to be changed.
              </p>
            </div>

            <Field
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              defaultValue={clientAccount.date_of_birth}
            />

            <Field
              label="Anniversary Date"
              name="anniversary_date"
              type="date"
              defaultValue={clientAccount.anniversary_date}
              helper="Optional — for anniversary emails."
            />

            <Field
              label="Primary Phone"
              name="phone_primary"
              defaultValue={clientAccount.phone_primary}
            />

            <Field
              label="Secondary Phone"
              name="phone_secondary"
              defaultValue={clientAccount.phone_secondary}
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Edit Address</h2>

          <div className="grid grid-2">
            <Field
              label="Address Line 1"
              name="address_line_1"
              defaultValue={clientAccount.address_line_1}
            />

            <Field
              label="Address Line 2"
              name="address_line_2"
              defaultValue={clientAccount.address_line_2}
            />

            <Field label="City" name="city" defaultValue={clientAccount.city} />

            <Field label="State" name="state" defaultValue={clientAccount.state} />

            <Field
              label="Postal Code"
              name="postal_code"
              defaultValue={clientAccount.postal_code}
            />
          </div>
        </div>

        <div
          className="card stack"
          style={{
            background: hasEmergencyContact ? "#f0fdf4" : "#fff7ed",
            border: hasEmergencyContact ? "1px solid #bbf7d0" : "1px solid #fed7aa",
          }}
        >
          <h2 style={{ margin: 0 }}>Edit Emergency Contact Information</h2>

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            This is the person Cozy Adventure Vacations should have on file as your
            emergency contact for travel.
          </p>

          <div className="grid grid-2">
            <Field
              label="Emergency Contact Name"
              name="emergency_contact_name"
              defaultValue={clientAccount.emergency_contact_name}
            />

            <Field
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              defaultValue={clientAccount.emergency_contact_phone}
            />
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Edit Passport & Identity Details</h2>

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: passportStatus.background,
              border: "1px solid #e6f0f2",
              color: passportStatus.color,
              lineHeight: 1.6,
            }}
          >
            <strong>Passport reminder:</strong> {passportStatus.helper}
          </div>

          <div className="grid grid-2">
            <Field
              label="Passport Number"
              name="passport_number"
              defaultValue={clientAccount.passport_number}
            />

            <Field
              label="Passport Expiration"
              name="passport_expiration_date"
              type="date"
              defaultValue={clientAccount.passport_expiration_date}
            />
          </div>

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            <strong>Passport image upload:</strong> Uploading a passport image can
            help keep important travel details organized in your secure client
            document area. For KTN, Redress, Global Entry PASSID, and rewards
            memberships, use the traveler numbers section.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/profile/passport-upload" className="btn btn-primary">
              Upload Passport Image
            </Link>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Edit Travel Preferences</h2>

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            These details help your advisor plan trips that better fit how you like
            to travel, including airport preferences, flight comfort preferences, and
            cruise cabin style.
          </p>

          <div className="grid grid-2">
            <AirportPicker
              label="Preferred Airport"
              name="preferred_airport"
              defaultValue={clientAccount.preferred_airport}
              helper="Search by code, city, or name. e.g. ORD, Chicago, Orlando."
            />

            <Field
              label="Travel Style"
              name="travel_style"
              defaultValue={clientAccount.travel_style}
              placeholder="e.g. Relaxed, adventurous, luxury, family-friendly"
            />
          </div>

          <div className="grid grid-3">
            <SelectField
              label="Airline Seating Preference"
              name="airline_seating_preference"
              defaultValue={clientAccount.airline_seating_preference}
              options={airlineSeatingPreferences}
            />

            <SelectField
              label="Airline Class Preference"
              name="airline_class_preference"
              defaultValue={clientAccount.airline_class_preference}
              options={airlineClassPreferences}
            />

            <SelectField
              label="Cruise Cabin Preference"
              name="cruise_cabin_preference"
              defaultValue={clientAccount.cruise_cabin_preference}
              options={cruiseCabinPreferences}
            />
          </div>

          <TextAreaField
            label="Additional Travel Preference Notes"
            name="travel_preference_notes"
            defaultValue={clientAccount.travel_preference_notes}
            placeholder="e.g. Prefers aisle seats, forward ship cabins, connecting rooms, refundable fares."
          />

          <TextAreaField
            label="Accessibility / Mobility Notes"
            name="accessibility_notes"
            defaultValue={clientAccount.accessibility_notes}
            placeholder="e.g. Accessible room needed, limited walking, scooter use."
          />

          <div
            className="stack"
            style={{
              background: hasFoodAllergies ? "#f0fdf4" : "#fff7ed",
              border: hasFoodAllergies ? "1px solid #bbf7d0" : "1px solid #fed7aa",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Food Allergies</h3>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                Select any common food allergies that apply, then add anything else
                in the notes box.
              </p>
            </div>

            <FoodAllergyCheckboxes savedAllergies={clientAccount.food_allergies} />

            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #e6f0f2",
                color: "#667085",
                lineHeight: 1.6,
              }}
            >
              This helps your advisor keep better travel notes on file. Please still
              notify airlines, resorts, restaurants, cruise lines, tour operators,
              or medical professionals directly when required.
            </div>
          </div>
        </div>

        <div
          className="card stack"
          style={{
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <h2 style={{ margin: 0 }}>Save Profile Updates</h2>

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Review your updates carefully before saving. This information may be
            used by Cozy Adventure Vacations when planning or supporting your travel.
          </p>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Save Profile
            </button>

            <Link href="/trips" className="btn btn-primary">
              Back to My Trips
            </Link>
          </div>
        </div>
      </form>

      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Upload Supporting Travel Documents</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Use this section to upload documents that may be needed for travel, such
          as permission slips, minor travel consent forms, notarized letters,
          passport images, insurance documents, accessibility documentation, or
          supplier-required paperwork.
        </p>

        <div className="grid grid-3">
          <div
            className="card stack"
            style={{
              background: "#ffffff",
              border: "1px solid #e6f0f2",
            }}
          >
            <h3 style={{ margin: 0 }}>Passport Image</h3>
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Upload a passport image or passport information page so it can be
              stored with your client documents.
            </p>

            <Link href="/profile/passport-upload" className="btn btn-primary">
              Upload Passport Image
            </Link>
          </div>

          <div
            className="card stack"
            style={{
              background: "#ffffff",
              border: "1px solid #e6f0f2",
            }}
          >
            <h3 style={{ margin: 0 }}>Traveler Numbers & Rewards</h3>
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Add KTN, Redress, Global Entry PASSID, passport reference details,
              and travel rewards memberships.
            </p>

            <Link href="/profile/traveler-numbers" className="btn btn-primary">
              Manage Traveler Numbers
            </Link>
          </div>

          <div
            className="card stack"
            style={{
              background: "#ffffff",
              border: "1px solid #e6f0f2",
            }}
          >
            <h3 style={{ margin: 0 }}>Other Travel Documents</h3>
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Upload permission slips, minor travel consent documents, one-parent
              international travel documents, medical notes, or other supporting files.
            </p>

            <Link href="/profile/documents/upload" className="btn btn-primary">
              Upload Travel Document
            </Link>
          </div>
        </div>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid #e6f0f2",
            color: "#667085",
            lineHeight: 1.6,
          }}
        >
          <strong>Reminder:</strong> Uploaded documents and saved traveler numbers
          help Cozy Adventure Vacations stay organized, but travelers are still
          responsible for carrying and presenting required original documents when
          airlines, cruise lines, border officials, resorts, tour operators, or other
          suppliers require them.
        </div>
      </div>

    </PageShell>
  );
}