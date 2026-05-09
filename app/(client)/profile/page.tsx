import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { AirportPicker } from "@/components/forms/airport-picker";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
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
  emergency_contact_relationship: string | null;
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

const emergencyRelationshipOptions = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Friend",
  "Travel Companion",
  "Other",
];

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function buildName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return `${firstName ?? ""} ${middleName ?? ""} ${lastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function formatPhoneForDisplay(value: string | null | undefined) {
  if (!value) return "";

  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  let normalizedDigits = digits;

  if (normalizedDigits.length === 11 && normalizedDigits.startsWith("1")) {
    normalizedDigits = normalizedDigits.slice(1);
  }

  if (normalizedDigits.length === 10) {
    return `1 (${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(
      3,
      6,
    )}-${normalizedDigits.slice(6)}`;
  }

  return value;
}

function normalizePhoneForSave(value: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");

  if (!digits) return null;

  let normalizedDigits = digits;

  if (normalizedDigits.length === 11 && normalizedDigits.startsWith("1")) {
    normalizedDigits = normalizedDigits.slice(1);
  }

  if (normalizedDigits.length === 10) {
    return `1 (${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(
      3,
      6,
    )}-${normalizedDigits.slice(6)}`;
  }

  return value.trim();
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

function getUpdatedMessageLabel(updated: string | undefined) {
  switch (updated) {
    case "personal":
      return "Personal information saved successfully.";
    case "address":
      return "Address saved successfully.";
    case "emergency":
      return "Emergency contact saved successfully.";
    case "identity":
      return "Passport and identity details saved successfully.";
    case "preferences":
      return "Travel preferences saved successfully.";
    case "allergies":
      return "Food allergy notes saved successfully.";
    case "notes":
      return "Profile notes saved successfully.";
    default:
      return "Profile updated successfully.";
  }
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

function Section({
  title,
  intro,
  children,
  defaultOpen = false,
  tone = "default",
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "success" | "warning";
}) {
  let background = "#ffffff";
  let border = "1px solid #e6f0f2";

  if (tone === "success") {
    background = "#f0fdf4";
    border = "1px solid #bbf7d0";
  }

  if (tone === "warning") {
    background = "#fff7ed";
    border = "1px solid #fed7aa";
  }

  return (
    <details
      open={defaultOpen}
      className="card"
      style={{
        background,
        border,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {intro ? (
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                {intro}
              </p>
            ) : null}
          </div>

          <span
            style={{
              color: "var(--accent-dark)",
              fontWeight: 800,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Open / Close
          </span>
        </div>
      </summary>

      <div className="stack" style={{ marginTop: 16 }}>
        {children}
      </div>
    </details>
  );
}

function SaveButton({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        gap: 10,
        flexWrap: "wrap",
        paddingTop: 4,
      }}
    >
      <button type="submit" className="btn btn-primary">
        {children}
      </button>
    </div>
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
    middle_name,
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
    emergency_contact_relationship,
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

async function loadPrimaryTravelerId({
  supabase,
  clientAccountId,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
}) {
  const { data: existingPrimary, error: primaryError } = await supabase
    .from("traveler_profiles")
    .select("id")
    .eq("client_account_id", clientAccountId)
    .eq("is_primary_traveler", true)
    .maybeSingle();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  return existingPrimary?.id ?? null;
}

async function syncPrimaryTravelerFromClientProfile({
  supabase,
  clientAccountId,
  firstName,
  middleName,
  lastName,
  dateOfBirth,
  passportNumber,
  passportExpirationDate,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpirationDate: string | null;
}) {
  const passportFullName = buildName(firstName, middleName, lastName);

  const existingPrimaryId = await loadPrimaryTravelerId({ supabase, clientAccountId });

  if (existingPrimaryId) {
    const { error } = await supabase
      .from("traveler_profiles")
      .update({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        passport_full_name: passportFullName || null,
        passport_number: passportNumber,
        passport_expiration_date: passportExpirationDate,
        relationship_to_client: "Self",
        is_primary_traveler: true,
        is_minor: false,
      })
      .eq("id", existingPrimaryId)
      .eq("client_account_id", clientAccountId);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("traveler_profiles").insert({
    client_account_id: clientAccountId,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    passport_full_name: passportFullName || null,
    passport_number: passportNumber,
    passport_expiration_date: passportExpirationDate,
    relationship_to_client: "Self",
    is_primary_traveler: true,
    is_minor: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updatePrimaryTravelerPersonalInfo({
  supabase,
  clientAccountId,
  firstName,
  middleName,
  lastName,
  dateOfBirth,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
}) {
  const existingPrimaryId = await loadPrimaryTravelerId({ supabase, clientAccountId });

  if (!existingPrimaryId) {
    const { error } = await supabase.from("traveler_profiles").insert({
      client_account_id: clientAccountId,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      passport_full_name: buildName(firstName, middleName, lastName) || null,
      relationship_to_client: "Self",
      is_primary_traveler: true,
      is_minor: false,
    });

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("traveler_profiles")
    .update({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      passport_full_name: buildName(firstName, middleName, lastName) || null,
      relationship_to_client: "Self",
      is_primary_traveler: true,
      is_minor: false,
    })
    .eq("id", existingPrimaryId)
    .eq("client_account_id", clientAccountId);

  if (error) throw new Error(error.message);
}

async function revalidateProfilePaths() {
  revalidatePath("/profile");
  revalidatePath("/profile/passport-upload");
  revalidatePath("/profile/traveler-numbers");
  revalidatePath("/trips");
}

async function updatePersonalInformation(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const firstName = cleanText(formData, "first_name");
  const middleName = cleanText(formData, "middle_name");
  const lastName = cleanText(formData, "last_name");
  const dateOfBirth = cleanText(formData, "date_of_birth");

  const { error } = await supabase
    .from("client_accounts")
    .update({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      preferred_name: cleanText(formData, "preferred_name"),
      date_of_birth: dateOfBirth,
      anniversary_date: cleanText(formData, "anniversary_date"),
      phone_primary: normalizePhoneForSave(cleanText(formData, "phone_primary")),
      phone_secondary: normalizePhoneForSave(cleanText(formData, "phone_secondary")),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await updatePrimaryTravelerPersonalInfo({
    supabase,
    clientAccountId: clientAccount.id,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
  });

  await revalidateProfilePaths();
  redirect("/profile?updated=personal");
}

async function updateAddress(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { error } = await supabase
    .from("client_accounts")
    .update({
      address_line_1: cleanText(formData, "address_line_1"),
      address_line_2: cleanText(formData, "address_line_2"),
      city: cleanText(formData, "city"),
      state: cleanText(formData, "state"),
      postal_code: cleanText(formData, "postal_code"),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await revalidateProfilePaths();
  redirect("/profile?updated=address");
}

async function updateEmergencyContact(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { error } = await supabase
    .from("client_accounts")
    .update({
      emergency_contact_name: cleanText(formData, "emergency_contact_name"),
      emergency_contact_relationship: cleanText(formData, "emergency_contact_relationship"),
      emergency_contact_phone: normalizePhoneForSave(cleanText(formData, "emergency_contact_phone")),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await revalidateProfilePaths();
  redirect("/profile?updated=emergency");
}

async function updatePassportIdentity(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const passportNumber = cleanText(formData, "passport_number");
  const passportExpirationDate = cleanText(formData, "passport_expiration_date");

  const { error } = await supabase
    .from("client_accounts")
    .update({
      passport_number: passportNumber,
      passport_expiration_date: passportExpirationDate,
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await syncPrimaryTravelerFromClientProfile({
    supabase,
    clientAccountId: clientAccount.id,
    firstName: clientAccount.first_name,
    middleName: clientAccount.middle_name,
    lastName: clientAccount.last_name,
    dateOfBirth: clientAccount.date_of_birth,
    passportNumber,
    passportExpirationDate,
  });

  await revalidateProfilePaths();
  redirect("/profile?updated=identity");
}

async function updateTravelPreferences(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { error } = await supabase
    .from("client_accounts")
    .update({
      preferred_airport: cleanText(formData, "preferred_airport"),
      travel_style: cleanText(formData, "travel_style"),
      airline_seating_preference: cleanText(formData, "airline_seating_preference"),
      airline_class_preference: cleanText(formData, "airline_class_preference"),
      cruise_cabin_preference: cleanText(formData, "cruise_cabin_preference"),
      travel_preference_notes: cleanText(formData, "travel_preference_notes"),
      accessibility_notes: cleanText(formData, "accessibility_notes"),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await revalidateProfilePaths();
  redirect("/profile?updated=preferences");
}

async function updateFoodAllergies(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { error } = await supabase
    .from("client_accounts")
    .update({
      food_allergies: buildFoodAllergiesValue(formData),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await revalidateProfilePaths();
  redirect("/profile?updated=allergies");
}

async function updateProfileNotes(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { error } = await supabase
    .from("client_accounts")
    .update({
      notes: cleanText(formData, "notes"),
    })
    .eq("id", clientAccount.id);

  if (error) throw new Error(error.message);

  await revalidateProfilePaths();
  redirect("/profile?updated=notes");
}

export default async function ClientProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const { clientAccount } = await getCurrentClientAccount();

  const clientName =
    buildName(
      clientAccount.first_name,
      clientAccount.middle_name,
      clientAccount.last_name,
    ) || "My Profile";

  const passportStatus = getPassportStatus(clientAccount.passport_expiration_date);

  const hasEmergencyContact =
    Boolean(clientAccount.emergency_contact_name) ||
    Boolean(clientAccount.emergency_contact_phone) ||
    Boolean(clientAccount.emergency_contact_relationship);

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
          Update one profile category at a time. Each section has its own save button, so you do not have to hunt for one large save action at the bottom.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile/passport-upload" className="btn btn-primary">
            Passport Upload
          </Link>

          <Link href="/profile/traveler-numbers" className="btn btn-primary">
            Traveler Numbers & Rewards
          </Link>

          <Link href="/profile/documents/upload" className="btn btn-primary">
            Upload Travel Document
          </Link>
        </div>
      </div>

      {updated ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>{getUpdatedMessageLabel(updated)}</strong>
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

      <form action={updatePersonalInformation}>
        <Section
          title="Personal Information"
          defaultOpen
          intro="Enter your name as shown on your passport or state-issued ID/DL."
        >
          <div className="grid grid-3">
            <Field
              label="First Name"
              name="first_name"
              defaultValue={clientAccount.first_name}
              helper="As shown on your passport or state-issued ID/DL."
            />

            <Field
              label="Middle Name"
              name="middle_name"
              defaultValue={clientAccount.middle_name}
              helper="Use your legal middle name if shown on your travel document."
            />

            <Field
              label="Last Name"
              name="last_name"
              defaultValue={clientAccount.last_name}
              helper="As shown on your passport or state-issued ID/DL."
            />
          </div>

          <div className="grid grid-2">
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
              helper="Used for travel planning where age or date of birth is required."
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
              defaultValue={formatPhoneForDisplay(clientAccount.phone_primary)}
              placeholder="1 (555) 123-4567"
            />

            <Field
              label="Secondary Phone"
              name="phone_secondary"
              defaultValue={formatPhoneForDisplay(clientAccount.phone_secondary)}
              placeholder="1 (555) 123-4567"
            />
          </div>

          <SaveButton>Save Personal Information</SaveButton>
        </Section>
      </form>

      <form action={updateAddress}>
        <Section
          title="Address"
          intro="Start typing your street address and choose the best match. Please review the filled-in city, state, and postal code before saving."
        >
          <AddressAutocomplete
            addressLine1Default={clientAccount.address_line_1}
            addressLine2Default={clientAccount.address_line_2}
            cityDefault={clientAccount.city}
            stateDefault={clientAccount.state}
            postalCodeDefault={clientAccount.postal_code}
          />

          <SaveButton>Save Address</SaveButton>
        </Section>
      </form>

      <form action={updateEmergencyContact}>
        <Section
          title="Emergency Contact"
          tone={hasEmergencyContact ? "success" : "warning"}
          intro="This is the person Cozy Adventure Vacations should have on file as your emergency contact for travel."
        >
          <div className="grid grid-3">
            <Field
              label="Emergency Contact Name"
              name="emergency_contact_name"
              defaultValue={clientAccount.emergency_contact_name}
            />

            <SelectField
              label="Relationship to Client"
              name="emergency_contact_relationship"
              defaultValue={clientAccount.emergency_contact_relationship}
              options={emergencyRelationshipOptions}
            />

            <Field
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              defaultValue={formatPhoneForDisplay(
                clientAccount.emergency_contact_phone,
              )}
              placeholder="1 (555) 123-4567"
            />
          </div>

          <SaveButton>Save Emergency Contact</SaveButton>
        </Section>
      </form>

      <form action={updatePassportIdentity}>
        <Section title="Passport & Identity Details">
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

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Your name from the Personal Information section will automatically sync
            to your primary passport profile. Use the Passport Upload page for a
            dedicated passport document upload area.
          </p>

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

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/profile/passport-upload" className="btn btn-primary">
              Passport Upload
            </Link>

            <Link href="/profile/traveler-numbers" className="btn btn-primary">
              Traveler Numbers & Rewards
            </Link>
          </div>

          <SaveButton>Save Passport & Identity Details</SaveButton>
        </Section>
      </form>

      <form action={updateTravelPreferences}>
        <Section
          title="Travel Preferences"
          intro="These details help your advisor plan trips that better fit how you like to travel."
        >
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

          <SaveButton>Save Travel Preferences</SaveButton>
        </Section>
      </form>

      <form action={updateFoodAllergies}>
        <Section
          title="Food Allergies"
          tone={hasFoodAllergies ? "success" : "warning"}
          intro="Select any common food allergies that apply, then add anything else in the notes box."
        >
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

          <SaveButton>Save Food Allergies</SaveButton>
        </Section>
      </form>

      <form action={updateProfileNotes}>
        <Section
          title="Profile Notes"
          intro="Use this area for general travel notes you want Cozy Adventure Vacations to keep in mind."
        >
          <TextAreaField
            label="General Notes"
            name="notes"
            defaultValue={clientAccount.notes}
            placeholder="Example: Prefers morning flights, celebrates birthdays while traveling, needs extra time between activities, etc."
            rows={5}
          />

          <SaveButton>Save Profile Notes</SaveButton>
        </Section>
      </form>

      <Section
        title="Supporting Travel Documents"
        intro="Upload passport images, permission slips, minor travel consent forms, insurance documents, accessibility documentation, or supplier-required paperwork."
      >
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
              Passport Upload
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
              Add KTN, Redress, Global Entry PASSID, and travel rewards memberships.
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
              Upload permission slips, minor travel consent documents, medical notes,
              or other supporting files.
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
      </Section>
    </PageShell>
  );
}
