import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { AirportPicker } from "@/components/forms/airport-picker";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

const airlineSeatingPreferences = ["Aisle", "Window", "Middle", "No preference"];
const airlineClassPreferences = ["First Class", "Business", "Premium Economy / Economy Plus", "Economy", "No preference"];
const cruiseCabinPreferences = ["Suite", "Family Suite", "Junior Suite", "Balcony", "Ocean View", "Interior", "Accessible Cabin", "Connecting Cabins", "Family Cabin", "No preference"];
const emergencyRelationshipOptions = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Travel Companion", "Other"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function buildName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return `${firstName ?? ""} ${middleName ?? ""} ${lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

function formatPhoneForDisplay(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  let d = digits;
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length === 10) return `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return value;
}

function normalizePhoneForSave(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  let d = digits;
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length === 10) return `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return value.trim();
}

function buildFoodAllergiesValue(formData: FormData) {
  const selected = formData.getAll("food_allergy_options").map((v) => String(v).trim()).filter(Boolean);
  const other = String(formData.get("food_allergies_other") ?? "").trim();
  const all = [...selected];
  if (other) all.push(`Other / Notes: ${other}`);
  return all.length > 0 ? all.join("\n") : null;
}

function isAllergyChecked(saved: string | null | undefined, allergy: string) {
  if (!saved) return false;
  return saved.toLowerCase().split("\n").map((i) => i.trim()).some((i) => i === allergy.toLowerCase());
}

function getOtherFoodAllergyNotes(saved: string | null | undefined) {
  if (!saved) return "";
  const line = saved.split("\n").find((l) => l.toLowerCase().startsWith("other / notes:"));
  if (!line) return "";
  return line.replace(/^Other \/ Notes:\s*/i, "").trim();
}

function getPassportStatus(expirationDate: string | null | undefined) {
  if (!expirationDate) return { label: "Not provided", background: "#f7fbfc", color: "#667085", helper: "Passport expiration date has not been added yet." };
  const exp = new Date(`${expirationDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isNaN(exp.getTime())) return { label: "Check date", background: "#fff7ed", color: "#c2410c", helper: "Passport expiration date could not be verified." };
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", background: "#fff1f2", color: "#be123c", helper: "This passport appears to be expired." };
  if (days <= 180) return { label: "Review Soon", background: "#fff7ed", color: "#c2410c", helper: "Expires within 6 months. Some destinations require extra validity." };
  return { label: "On File", background: "#ecfdf3", color: "#027a48", helper: "Passport expiration date is on file." };
}

function getUpdatedMessage(updated: string | undefined) {
  const map: Record<string, string> = {
    personal: "Personal information saved.",
    address: "Address saved.",
    emergency: "Emergency contact saved.",
    identity: "Passport and identity details saved.",
    preferences: "Travel preferences saved.",
    allergies: "Food allergy notes saved.",
    notes: "Profile notes saved.",
  };
  return map[updated ?? ""] ?? "Profile updated.";
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function StatusPill({ label, background, color }: { label: string; background: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 12px", background, color, fontWeight: 700, fontSize: 13 }}>
      {label}
    </span>
  );
}

function SaveButton({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <button type="submit" className="btn btn-primary">{children}</button>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", placeholder, helper }: { label: string; name: string; defaultValue?: string | null; type?: string; placeholder?: string; helper?: string }) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      {helper && <span style={{ color: "#667085", fontSize: 13, lineHeight: 1.45 }}>{helper}</span>}
    </label>
  );
}

function SelectField({ label, name, defaultValue, options, helper }: { label: string; name: string; defaultValue?: string | null; options: string[]; helper?: string }) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">Choose an option</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {helper && <span style={{ color: "#667085", fontSize: 13, lineHeight: 1.45 }}>{helper}</span>}
    </label>
  );
}

function TextAreaField({ label, name, defaultValue, placeholder, helper, rows = 4 }: { label: string; name: string; defaultValue?: string | null; placeholder?: string; helper?: string; rows?: number }) {
  return (
    <label className="stack-sm">
      <span className="label">{label}</span>
      <textarea className="textarea" name={name} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      {helper && <span style={{ color: "#667085", fontSize: 13, lineHeight: 1.45 }}>{helper}</span>}
    </label>
  );
}

function ProfileSection({
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
  const toneStyles = {
    default: { background: "#ffffff", border: "1px solid #e6f0f2" },
    success: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
    warning: { background: "#fffbf7", border: "1px solid #fed7aa" },
  }[tone];

  return (
    <details open={defaultOpen} style={{ ...toneStyles, borderRadius: 20, overflow: "hidden" }}>
      <summary style={{ cursor: "pointer", padding: "18px 20px", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          {intro && <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.55, fontSize: 14 }}>{intro}</p>}
        </div>
        <span style={{ color: "var(--accent-dark)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", marginTop: 2 }}>Open / Close</span>
      </summary>
      <div className="stack" style={{ padding: "0 20px 20px", borderTop: "1px solid #e6f0f2", paddingTop: 20 }}>
        {children}
      </div>
    </details>
  );
}

function FoodAllergyCheckboxes({ savedAllergies }: { savedAllergies: string | null | undefined }) {
  return (
    <div className="stack">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {commonFoodAllergies.map((allergy) => (
          <label key={allergy} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid #e6f0f2", borderRadius: 12, background: "#ffffff", cursor: "pointer", lineHeight: 1.35 }}>
            <input type="checkbox" name="food_allergy_options" value={allergy} defaultChecked={isAllergyChecked(savedAllergies, allergy)} />
            <span>{allergy}</span>
          </label>
        ))}
      </div>
      <TextAreaField
        label="Other Allergies / Notes"
        name="food_allergies_other"
        defaultValue={getOtherFoodAllergyNotes(savedAllergies)}
        rows={3}
        placeholder="e.g. Strawberry allergy, red dye sensitivity, prefers nut-free meals"
      />
    </div>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) throw new Error("Your login account does not have an email address.");

  const selectFields = `id, first_name, middle_name, last_name, preferred_name, email, phone_primary, phone_secondary, address_line_1, address_line_2, city, state, postal_code, date_of_birth, anniversary_date, preferred_airport, travel_style, airline_seating_preference, airline_class_preference, cruise_cabin_preference, travel_preference_notes, accessibility_notes, food_allergies, passport_number, passport_expiration_date, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, notes, created_at`;

  const { data: byEmail, error: emailError } = await supabase.from("client_accounts").select(selectFields).ilike("email", userEmail).maybeSingle();
  if (emailError) throw new Error(emailError.message);
  if (byEmail) return { supabase, user, clientAccount: byEmail as ClientAccount };

  const { data: profile, error: profileError } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User profile not found.");

  const { data: byProfile, error: profileAccountError } = await supabase.from("client_accounts").select(selectFields).eq("user_profile_id", profile.id).maybeSingle();
  if (profileAccountError) throw new Error(profileAccountError.message);
  if (!byProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: byProfile as ClientAccount };
}

async function loadPrimaryTravelerId({ supabase, clientAccountId }: { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; clientAccountId: string }) {
  const { data, error } = await supabase.from("traveler_profiles").select("id").eq("client_account_id", clientAccountId).eq("is_primary_traveler", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function syncPrimaryTraveler({ supabase, clientAccountId, firstName, middleName, lastName, dateOfBirth, passportNumber, passportExpirationDate }: { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; clientAccountId: string; firstName: string | null; middleName: string | null; lastName: string | null; dateOfBirth: string | null; passportNumber: string | null; passportExpirationDate: string | null }) {
  const passportFullName = buildName(firstName, middleName, lastName);
  const existingId = await loadPrimaryTravelerId({ supabase, clientAccountId });
  const payload = { first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dateOfBirth, passport_full_name: passportFullName || null, passport_number: passportNumber, passport_expiration_date: passportExpirationDate, relationship_to_client: "Self", is_primary_traveler: true, is_minor: false };

  if (existingId) {
    const { error } = await supabase.from("traveler_profiles").update(payload).eq("id", existingId).eq("client_account_id", clientAccountId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("traveler_profiles").insert({ client_account_id: clientAccountId, ...payload });
    if (error) throw new Error(error.message);
  }
}

async function updatePrimaryTravelerPersonal({ supabase, clientAccountId, firstName, middleName, lastName, dateOfBirth }: { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; clientAccountId: string; firstName: string | null; middleName: string | null; lastName: string | null; dateOfBirth: string | null }) {
  const existingId = await loadPrimaryTravelerId({ supabase, clientAccountId });
  const payload = { first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dateOfBirth, passport_full_name: buildName(firstName, middleName, lastName) || null, relationship_to_client: "Self", is_primary_traveler: true, is_minor: false };
  if (existingId) {
    const { error } = await supabase.from("traveler_profiles").update(payload).eq("id", existingId).eq("client_account_id", clientAccountId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("traveler_profiles").insert({ client_account_id: clientAccountId, ...payload });
    if (error) throw new Error(error.message);
  }
}

async function revalidatePaths() {
  revalidatePath("/profile");
  revalidatePath("/profile/passport-upload");
  revalidatePath("/profile/traveler-numbers");
  revalidatePath("/trips");
}

// ─── Server actions ───────────────────────────────────────────────────────────

async function updatePersonalInformation(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const firstName = cleanText(formData, "first_name");
  const middleName = cleanText(formData, "middle_name");
  const lastName = cleanText(formData, "last_name");
  const dateOfBirth = cleanText(formData, "date_of_birth");
  const { error } = await supabase.from("client_accounts").update({ first_name: firstName, middle_name: middleName, last_name: lastName, preferred_name: cleanText(formData, "preferred_name"), date_of_birth: dateOfBirth, anniversary_date: cleanText(formData, "anniversary_date"), phone_primary: normalizePhoneForSave(cleanText(formData, "phone_primary")), phone_secondary: normalizePhoneForSave(cleanText(formData, "phone_secondary")) }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await updatePrimaryTravelerPersonal({ supabase, clientAccountId: clientAccount.id, firstName, middleName, lastName, dateOfBirth });
  await revalidatePaths();
  redirect("/profile?updated=personal");
}

async function updateAddress(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const { error } = await supabase.from("client_accounts").update({ address_line_1: cleanText(formData, "address_line_1"), address_line_2: cleanText(formData, "address_line_2"), city: cleanText(formData, "city"), state: cleanText(formData, "state"), postal_code: cleanText(formData, "postal_code") }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await revalidatePaths();
  redirect("/profile?updated=address");
}

async function updateEmergencyContact(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const { error } = await supabase.from("client_accounts").update({ emergency_contact_name: cleanText(formData, "emergency_contact_name"), emergency_contact_relationship: cleanText(formData, "emergency_contact_relationship"), emergency_contact_phone: normalizePhoneForSave(cleanText(formData, "emergency_contact_phone")) }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await revalidatePaths();
  redirect("/profile?updated=emergency");
}

async function updatePassportIdentity(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const passportNumber = cleanText(formData, "passport_number");
  const passportExpirationDate = cleanText(formData, "passport_expiration_date");
  const { error } = await supabase.from("client_accounts").update({ passport_number: passportNumber, passport_expiration_date: passportExpirationDate }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await syncPrimaryTraveler({ supabase, clientAccountId: clientAccount.id, firstName: clientAccount.first_name, middleName: clientAccount.middle_name, lastName: clientAccount.last_name, dateOfBirth: clientAccount.date_of_birth, passportNumber, passportExpirationDate });
  await revalidatePaths();
  redirect("/profile?updated=identity");
}

async function updateTravelPreferences(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const { error } = await supabase.from("client_accounts").update({ preferred_airport: cleanText(formData, "preferred_airport"), travel_style: cleanText(formData, "travel_style"), airline_seating_preference: cleanText(formData, "airline_seating_preference"), airline_class_preference: cleanText(formData, "airline_class_preference"), cruise_cabin_preference: cleanText(formData, "cruise_cabin_preference"), travel_preference_notes: cleanText(formData, "travel_preference_notes"), accessibility_notes: cleanText(formData, "accessibility_notes") }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await revalidatePaths();
  redirect("/profile?updated=preferences");
}

async function updateFoodAllergies(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const { error } = await supabase.from("client_accounts").update({ food_allergies: buildFoodAllergiesValue(formData) }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await revalidatePaths();
  redirect("/profile?updated=allergies");
}

async function updateProfileNotes(formData: FormData) {
  "use server";
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const { error } = await supabase.from("client_accounts").update({ notes: cleanText(formData, "notes") }).eq("id", clientAccount.id);
  if (error) throw new Error(error.message);
  await revalidatePaths();
  redirect("/profile?updated=notes");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const { clientAccount } = await getCurrentClientAccount();

  const clientName = buildName(clientAccount.first_name, clientAccount.middle_name, clientAccount.last_name) || "My Profile";
  const passportStatus = getPassportStatus(clientAccount.passport_expiration_date);
  const hasEmergencyContact = Boolean(clientAccount.emergency_contact_name) || Boolean(clientAccount.emergency_contact_phone);
  const hasFoodAllergies = Boolean(clientAccount.food_allergies);

  return (
    <PageShell
      title="My Profile"
      subtitle="Keep your travel details up to date so your advisor can plan the perfect trip."
    >
      {/* Profile header */}
      <div className="card stack" style={{ background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)", border: "1px solid #e6f0f2" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Cozy Concierge Profile</p>
        <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>{clientName}</h1>
        {clientAccount.preferred_name && (
          <p style={{ margin: "3px 0 0", color: "#667085" }}>Goes by: <strong>{clientAccount.preferred_name}</strong></p>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <Link href="/profile/passport-upload" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Passport Upload</Link>
          <Link href="/profile/traveler-numbers" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Traveler Numbers & Rewards</Link>
          <Link href="/profile/documents/upload" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Upload Document</Link>
        </div>
      </div>

      {/* Save confirmation */}
      {updated && (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}>
          <strong>✓ {getUpdatedMessage(updated)}</strong>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-3">
        <div className="card" style={{ border: "1px solid #e6f0f2" }}>
          <span className="label">Primary Email</span>
          <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 15, overflowWrap: "anywhere" }}>{clientAccount.email ?? "Not provided"}</p>
        </div>
        <div className="card" style={{ border: "1px solid #e6f0f2" }}>
          <span className="label">Preferred Airport</span>
          <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 15 }}>{clientAccount.preferred_airport ?? "Not set"}</p>
        </div>
        <div className="card" style={{ border: "1px solid #e6f0f2" }}>
          <span className="label">Passport Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusPill label={passportStatus.label} background={passportStatus.background} color={passportStatus.color} />
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#667085" }}>{passportStatus.helper}</p>
        </div>
      </div>

      {/* Personal Information */}
      <form action={updatePersonalInformation}>
        <ProfileSection title="Personal Information" intro="Enter your name as shown on your passport or state-issued ID/DL." defaultOpen>
          <div className="grid grid-3">
            <Field label="First Name" name="first_name" defaultValue={clientAccount.first_name} helper="As on your passport or ID." />
            <Field label="Middle Name" name="middle_name" defaultValue={clientAccount.middle_name} helper="Legal middle name if on your travel document." />
            <Field label="Last Name" name="last_name" defaultValue={clientAccount.last_name} helper="As on your passport or ID." />
          </div>
          <div className="grid grid-2">
            <Field label="Preferred Name" name="preferred_name" defaultValue={clientAccount.preferred_name} placeholder="e.g. Jen, Mick, Skip" />
            <div style={{ padding: "12px", border: "1px solid #eef2f5", borderRadius: 12, background: "#fbfdfe" }}>
              <span className="label">Email / Login</span>
              <p style={{ margin: "6px 0 0", fontWeight: 700 }}>{clientAccount.email ?? "Not provided"}</p>
              <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>To change this email, contact your advisor.</p>
            </div>
            <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={clientAccount.date_of_birth} helper="Used for travel planning and age verification." />
            <Field label="Anniversary Date" name="anniversary_date" type="date" defaultValue={clientAccount.anniversary_date} helper="Optional — for anniversary emails." />
            <Field label="Primary Phone" name="phone_primary" defaultValue={formatPhoneForDisplay(clientAccount.phone_primary)} placeholder="1 (555) 123-4567" />
            <Field label="Secondary Phone" name="phone_secondary" defaultValue={formatPhoneForDisplay(clientAccount.phone_secondary)} placeholder="1 (555) 123-4567" />
          </div>
          <SaveButton>Save Personal Information</SaveButton>
        </ProfileSection>
      </form>

      {/* Address */}
      <form action={updateAddress}>
        <ProfileSection title="Address" intro="Start typing your street address and choose the best match. Review the city, state, and postal code before saving.">
          <AddressAutocomplete
            addressLine1Default={clientAccount.address_line_1}
            addressLine2Default={clientAccount.address_line_2}
            cityDefault={clientAccount.city}
            stateDefault={clientAccount.state}
            postalCodeDefault={clientAccount.postal_code}
          />
          <SaveButton>Save Address</SaveButton>
        </ProfileSection>
      </form>

      {/* Emergency Contact */}
      <form action={updateEmergencyContact}>
        <ProfileSection
          title="Emergency Contact"
          intro="The person Cozy Adventure Vacations should contact in an emergency."
          tone={hasEmergencyContact ? "success" : "warning"}
        >
          <div className="grid grid-3">
            <Field label="Name" name="emergency_contact_name" defaultValue={clientAccount.emergency_contact_name} />
            <SelectField label="Relationship" name="emergency_contact_relationship" defaultValue={clientAccount.emergency_contact_relationship} options={emergencyRelationshipOptions} />
            <Field label="Phone" name="emergency_contact_phone" defaultValue={formatPhoneForDisplay(clientAccount.emergency_contact_phone)} placeholder="1 (555) 123-4567" />
          </div>
          <SaveButton>Save Emergency Contact</SaveButton>
        </ProfileSection>
      </form>

      {/* Passport & Identity */}
      <form action={updatePassportIdentity}>
        <ProfileSection title="Passport & Identity Details">
          <div style={{ padding: "12px", borderRadius: 12, background: passportStatus.background, border: "1px solid #e6f0f2", color: passportStatus.color, lineHeight: 1.6, fontSize: 14 }}>
            <strong>Passport status:</strong> {passportStatus.helper}
          </div>
          <div className="grid grid-2">
            <Field label="Passport Number" name="passport_number" defaultValue={clientAccount.passport_number} />
            <Field label="Passport Expiration" name="passport_expiration_date" type="date" defaultValue={clientAccount.passport_expiration_date} />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link href="/profile/passport-upload" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Upload Passport Image</Link>
            <Link href="/profile/traveler-numbers" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Traveler Numbers & Rewards</Link>
          </div>
          <SaveButton>Save Passport Details</SaveButton>
        </ProfileSection>
      </form>

      {/* Travel Preferences */}
      <form action={updateTravelPreferences}>
        <ProfileSection title="Travel Preferences" intro="Help your advisor plan trips that fit how you like to travel.">
          <div className="grid grid-2">
            <AirportPicker label="Preferred Airport" name="preferred_airport" defaultValue={clientAccount.preferred_airport} helper="Search by code, city, or name. e.g. ORD, Chicago, Orlando." />
            <Field label="Travel Style" name="travel_style" defaultValue={clientAccount.travel_style} placeholder="e.g. Relaxed, adventurous, luxury, family-friendly" />
          </div>
          <div className="grid grid-3">
            <SelectField label="Airline Seating" name="airline_seating_preference" defaultValue={clientAccount.airline_seating_preference} options={airlineSeatingPreferences} />
            <SelectField label="Airline Class" name="airline_class_preference" defaultValue={clientAccount.airline_class_preference} options={airlineClassPreferences} />
            <SelectField label="Cruise Cabin" name="cruise_cabin_preference" defaultValue={clientAccount.cruise_cabin_preference} options={cruiseCabinPreferences} />
          </div>
          <TextAreaField label="Additional Preference Notes" name="travel_preference_notes" defaultValue={clientAccount.travel_preference_notes} placeholder="e.g. Prefers aisle seats, forward cabins, refundable fares." />
          <TextAreaField label="Accessibility / Mobility Notes" name="accessibility_notes" defaultValue={clientAccount.accessibility_notes} placeholder="e.g. Accessible room needed, limited walking, scooter use." />
          <SaveButton>Save Travel Preferences</SaveButton>
        </ProfileSection>
      </form>

      {/* Food Allergies */}
      <form action={updateFoodAllergies}>
        <ProfileSection title="Food Allergies" intro="Select any that apply. Your advisor keeps these on file — still notify airlines, cruise lines, and restaurants directly." tone={hasFoodAllergies ? "success" : "warning"}>
          <FoodAllergyCheckboxes savedAllergies={clientAccount.food_allergies} />
          <SaveButton>Save Food Allergies</SaveButton>
        </ProfileSection>
      </form>

      {/* Profile Notes */}
      <form action={updateProfileNotes}>
        <ProfileSection title="Profile Notes" intro="General notes for your advisor — travel preferences, special occasions, anything worth knowing.">
          <TextAreaField label="Notes" name="notes" defaultValue={clientAccount.notes} placeholder="e.g. Prefers morning flights, celebrates birthdays while traveling, needs extra time between activities." rows={5} />
          <SaveButton>Save Profile Notes</SaveButton>
        </ProfileSection>
      </form>

      {/* Documents */}
      <div style={{ border: "1px solid #e6f0f2", borderRadius: 20, background: "#ffffff", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #e6f0f2" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Supporting Travel Documents</h2>
          <p style={{ margin: "5px 0 0", color: "#667085", fontSize: 14, lineHeight: 1.55 }}>Upload passport images, consent forms, insurance documents, and other travel paperwork.</p>
        </div>
        <div style={{ padding: 20 }} className="stack">
          <div className="grid grid-3">
            <div className="card stack" style={{ border: "1px solid #e6f0f2", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 800 }}>Passport Image</p>
              <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>Upload your passport information page for your client file.</p>
              <Link href="/profile/passport-upload" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Upload Passport</Link>
            </div>
            <div className="card stack" style={{ border: "1px solid #e6f0f2", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 800 }}>Traveler Numbers & Rewards</p>
              <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>Add KTN, Redress, Global Entry, and loyalty memberships.</p>
              <Link href="/profile/traveler-numbers" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Manage Numbers</Link>
            </div>
            <div className="card stack" style={{ border: "1px solid #e6f0f2", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 800 }}>Other Documents</p>
              <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>Upload consent forms, medical notes, or other supporting files.</p>
              <Link href="/profile/documents/upload" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Upload Document</Link>
            </div>
          </div>
          <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>Travelers are responsible for carrying and presenting original documents when required by airlines, cruise lines, border officials, or other suppliers.</p>
        </div>
      </div>
    </PageShell>
  );
}
  