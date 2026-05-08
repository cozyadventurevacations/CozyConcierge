import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TravelerProfile = {
  id: string;
  client_account_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  passport_full_name: string | null;
  known_traveler_number: string | null;
  redress_number: string | null;
  global_entry_passid: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiration_date: string | null;
  relationship_to_client: string | null;
  is_primary_traveler: boolean | null;
  is_minor: boolean | null;
  notes: string | null;
  created_at: string | null;
};

type LoyaltyNumber = {
  id: string;
  traveler_profile_id: string;
  client_account_id: string;
  loyalty_type: string;
  company_name: string;
  program_name: string | null;
  loyalty_number: string;
  traveler_name_snapshot: string | null;
  notes: string | null;
  created_at: string | null;
};

type TravelerPassportDocument = {
  id: string;
  traveler_profile_id: string | null;
  document_type: string;
  document_title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  notes: string | null;
  created_at: string | null;
  signedUrl: string | null;
};

const VALID_LOYALTY_TYPES = [
  "airline",
  "hotel",
  "cruise",
  "rental_car",
  "rail",
  "theme_park",
  "credit_card",
  "tour",
  "vacation_package",
  "other",
];

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function cleanCheckbox(formData: FormData, fieldName: string) {
  return formData.get(fieldName) === "on";
}

function buildTravelerNotes(formData: FormData) {
  const otherTravelerNumbers = cleanText(formData, "other_traveler_numbers");
  const notes = cleanText(formData, "notes");

  const parts: string[] = [];

  if (otherTravelerNumbers) {
    parts.push(`Other Traveler Numbers / IDs: ${otherTravelerNumbers}`);
  }

  if (notes) {
    parts.push(notes);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function buildName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return `${firstName ?? ""} ${middleName ?? ""} ${lastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTravelerName(traveler: TravelerProfile | null | undefined) {
  if (!traveler) return "Unnamed Traveler";

  return (
    buildName(traveler.first_name, traveler.middle_name, traveler.last_name) ||
    traveler.passport_full_name ||
    "Unnamed Traveler"
  );
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function getLoyaltyTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "airline":
      return "Airline";
    case "hotel":
      return "Hotel";
    case "cruise":
      return "Cruise";
    case "rental_car":
      return "Rental Car";
    case "rail":
      return "Rail";
    case "theme_park":
      return "Theme Park";
    case "credit_card":
      return "Credit Card Travel Program";
    case "tour":
      return "Tour / Activity";
    case "vacation_package":
      return "Vacation Package / Supplier";
    default:
      return "Other";
  }
}

function LoyaltyTypeBadge({ type }: { type: string | null | undefined }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: "#f0f7f8",
        color: "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {getLoyaltyTypeLabel(type)}
    </span>
  );
}

function TravelerBadge({
  relationship,
  isPrimary,
  isMinor,
}: {
  relationship?: string | null;
  isPrimary?: boolean | null;
  isMinor?: boolean | null;
}) {
  const label = isPrimary
    ? "Primary Traveler"
    : relationship
      ? relationship
      : "Additional Traveler";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isPrimary ? "#f0fdf4" : "#f0f7f8",
        color: isPrimary ? "#166534" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {isMinor ? " • Minor" : ""}
    </span>
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

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
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
    .select("id, first_name, last_name, email")
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

async function ensurePrimaryTravelerProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientAccount: ClientAccount,
) {
  const { data: existingPrimary, error: primaryError } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .eq("is_primary_traveler", true)
    .maybeSingle();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  if (existingPrimary) {
    return existingPrimary as TravelerProfile;
  }

  const { data: existingTravelers, error: existingTravelersError } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .order("created_at", { ascending: true });

  if (existingTravelersError) {
    throw new Error(existingTravelersError.message);
  }

  const travelerRows = (existingTravelers ?? []) as TravelerProfile[];

  const matchingTraveler =
    travelerRows.find((traveler) => {
      const firstMatches =
        (traveler.first_name ?? "").trim().toLowerCase() ===
        (clientAccount.first_name ?? "").trim().toLowerCase();

      const lastMatches =
        (traveler.last_name ?? "").trim().toLowerCase() ===
        (clientAccount.last_name ?? "").trim().toLowerCase();

      return firstMatches && lastMatches;
    }) ?? travelerRows[0];

  if (matchingTraveler) {
    const { data: updatedTraveler, error: updateError } = await supabase
      .from("traveler_profiles")
      .update({
        is_primary_traveler: true,
        relationship_to_client: "Self",
        is_minor: false,
      })
      .eq("id", matchingTraveler.id)
      .eq("client_account_id", clientAccount.id)
      .select("*")
      .single();

    if (updateError || !updatedTraveler) {
      throw new Error(updateError?.message ?? "Unable to update primary traveler.");
    }

    return updatedTraveler as TravelerProfile;
  }

  const { data: insertedTraveler, error: insertError } = await supabase
    .from("traveler_profiles")
    .insert({
      client_account_id: clientAccount.id,
      first_name: clientAccount.first_name,
      last_name: clientAccount.last_name,
      relationship_to_client: "Self",
      is_primary_traveler: true,
      is_minor: false,
    })
    .select("*")
    .single();

  if (insertError || !insertedTraveler) {
    throw new Error(insertError?.message ?? "Unable to create primary traveler.");
  }

  return insertedTraveler as TravelerProfile;
}

async function updatePrimaryTravelerNumbers(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  const { error } = await supabase
    .from("traveler_profiles")
    .update({
      known_traveler_number: cleanText(formData, "known_traveler_number"),
      redress_number: cleanText(formData, "redress_number"),
      global_entry_passid: cleanText(formData, "global_entry_passid"),
      notes: buildTravelerNotes(formData),
    })
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .eq("is_primary_traveler", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function addAdditionalTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const firstName = cleanText(formData, "first_name");
  const middleName = cleanText(formData, "middle_name");
  const lastName = cleanText(formData, "last_name");

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required for additional travelers.");
  }

  const travelerName = buildName(firstName, middleName, lastName);

  const { error } = await supabase.from("traveler_profiles").insert({
    client_account_id: clientAccount.id,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    date_of_birth: cleanText(formData, "date_of_birth"),
    passport_full_name: travelerName || null,
    known_traveler_number: cleanText(formData, "known_traveler_number"),
    redress_number: cleanText(formData, "redress_number"),
    global_entry_passid: cleanText(formData, "global_entry_passid"),
    passport_number: cleanText(formData, "passport_number"),
    passport_country: cleanText(formData, "passport_country"),
    passport_expiration_date: cleanText(formData, "passport_expiration_date"),
    relationship_to_client: cleanText(formData, "relationship_to_client"),
    is_primary_traveler: false,
    is_minor: cleanCheckbox(formData, "is_minor"),
    notes: buildTravelerNotes(formData),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function updateAdditionalTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();
  const firstName = cleanText(formData, "first_name");
  const middleName = cleanText(formData, "middle_name");
  const lastName = cleanText(formData, "last_name");

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required for additional travelers.");
  }

  const travelerName = buildName(firstName, middleName, lastName);

  const { error } = await supabase
    .from("traveler_profiles")
    .update({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      date_of_birth: cleanText(formData, "date_of_birth"),
      passport_full_name: travelerName || null,
      known_traveler_number: cleanText(formData, "known_traveler_number"),
      redress_number: cleanText(formData, "redress_number"),
      global_entry_passid: cleanText(formData, "global_entry_passid"),
      passport_number: cleanText(formData, "passport_number"),
      passport_country: cleanText(formData, "passport_country"),
      passport_expiration_date: cleanText(formData, "passport_expiration_date"),
      relationship_to_client: cleanText(formData, "relationship_to_client"),
      is_minor: cleanCheckbox(formData, "is_minor"),
      notes: buildTravelerNotes(formData),
    })
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .neq("is_primary_traveler", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function uploadAdditionalTravelerPassport(formData: FormData) {
  "use server";

  const { user, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  const { data: traveler, error: travelerError } = await supabaseAdmin
    .from("traveler_profiles")
    .select("id, client_account_id, first_name, middle_name, last_name, is_primary_traveler")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  if (traveler.is_primary_traveler === true) {
    throw new Error("Use the main passport upload page for the primary traveler.");
  }

  const consent = String(formData.get("passport_upload_consent") ?? "");

  if (consent !== "accepted") {
    throw new Error("You must acknowledge the passport upload notice before uploading.");
  }

  const file = formData.get("passport_file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a passport image or PDF to upload.");
  }

  const maxFileSize = 15 * 1024 * 1024;

  if (file.size > maxFileSize) {
    throw new Error("File is too large. Please upload a file under 15MB.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, WEBP, or PDF file.");
  }

  const travelerName =
    buildName(
      traveler.first_name as string | null,
      traveler.middle_name as string | null,
      traveler.last_name as string | null,
    ) || "Additional Traveler";

  const documentTitle =
    cleanText(formData, "document_title") ?? `${travelerName} Passport`;

  const notes = cleanText(formData, "passport_notes");

  const originalFileName = sanitizeFileName(file.name || "passport-document");

  const storagePath = `${clientAccount.id}/passport/${travelerId}/${crypto.randomUUID()}-${originalFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("client-documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await supabaseAdmin.from("client_documents").insert({
    client_account_id: clientAccount.id,
    traveler_profile_id: travelerId,
    uploaded_by_user_id: user.id,
    document_type: "passport",
    document_title: documentTitle,
    file_name: file.name || originalFileName,
    storage_path: storagePath,
    content_type: file.type || null,
    notes,
  });

  if (insertError) {
    await supabaseAdmin.storage.from("client-documents").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/passport-upload");
  revalidatePath("/profile/traveler-numbers");
  redirect("/profile/traveler-numbers?passportUploaded=true");
}

async function deleteTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  const { data: traveler, error: travelerError } = await supabase
    .from("traveler_profiles")
    .select("id, is_primary_traveler")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  if (traveler.is_primary_traveler) {
    throw new Error("The primary traveler cannot be deleted.");
  }

  const { error } = await supabase
    .from("traveler_profiles")
    .delete()
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function addLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_profile_id") ?? "").trim();
  const loyaltyType = String(formData.get("loyalty_type") ?? "airline").trim();
  const companyName = cleanText(formData, "company_name");
  const loyaltyNumber = cleanText(formData, "loyalty_number");

  if (!travelerId) {
    throw new Error("Please choose a traveler.");
  }

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  if (!loyaltyNumber) {
    throw new Error("Loyalty number is required.");
  }

  if (!VALID_LOYALTY_TYPES.includes(loyaltyType)) {
    throw new Error("Invalid loyalty type.");
  }

  const { data: traveler, error: travelerError } = await supabase
    .from("traveler_profiles")
    .select("id, first_name, middle_name, last_name, passport_full_name")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  const travelerName =
    traveler.passport_full_name ||
    buildName(traveler.first_name, traveler.middle_name, traveler.last_name);

  const { error } = await supabase.from("traveler_loyalty_numbers").insert({
    traveler_profile_id: travelerId,
    client_account_id: clientAccount.id,
    loyalty_type: loyaltyType,
    company_name: companyName,
    program_name: cleanText(formData, "program_name"),
    loyalty_number: loyaltyNumber,
    traveler_name_snapshot: travelerName || null,
    notes: cleanText(formData, "notes"),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function updateLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const loyaltyId = String(formData.get("loyalty_id") ?? "").trim();
  const travelerId = String(formData.get("traveler_profile_id") ?? "").trim();
  const loyaltyType = String(formData.get("loyalty_type") ?? "airline").trim();
  const companyName = cleanText(formData, "company_name");
  const loyaltyNumber = cleanText(formData, "loyalty_number");

  if (!loyaltyId) {
    throw new Error("Missing loyalty ID.");
  }

  if (!travelerId) {
    throw new Error("Please choose a traveler.");
  }

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  if (!loyaltyNumber) {
    throw new Error("Loyalty number is required.");
  }

  if (!VALID_LOYALTY_TYPES.includes(loyaltyType)) {
    throw new Error("Invalid loyalty type.");
  }

  const { data: traveler, error: travelerError } = await supabase
    .from("traveler_profiles")
    .select("id, first_name, middle_name, last_name, passport_full_name")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  const travelerName =
    traveler.passport_full_name ||
    buildName(traveler.first_name, traveler.middle_name, traveler.last_name);

  const { error } = await supabase
    .from("traveler_loyalty_numbers")
    .update({
      traveler_profile_id: travelerId,
      loyalty_type: loyaltyType,
      company_name: companyName,
      program_name: cleanText(formData, "program_name"),
      loyalty_number: loyaltyNumber,
      traveler_name_snapshot: travelerName || null,
      notes: cleanText(formData, "notes"),
    })
    .eq("id", loyaltyId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function deleteLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const loyaltyId = String(formData.get("loyalty_id") ?? "").trim();

  if (!loyaltyId) {
    throw new Error("Missing loyalty ID.");
  }

  const { error } = await supabase
    .from("traveler_loyalty_numbers")
    .delete()
    .eq("id", loyaltyId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

function PrimaryTravelerNumbersForm({ traveler }: { traveler: TravelerProfile }) {
  return (
    <form action={updatePrimaryTravelerNumbers} className="stack">
      <input type="hidden" name="traveler_id" value={traveler.id} />

      <div className="grid grid-3">
        <label className="stack-sm">
          <span className="label">Known Traveler Number / KTN</span>
          <input
            className="input"
            name="known_traveler_number"
            defaultValue={traveler.known_traveler_number ?? ""}
          />
        </label>

        <label className="stack-sm">
          <span className="label">Redress Number</span>
          <input
            className="input"
            name="redress_number"
            defaultValue={traveler.redress_number ?? ""}
          />
        </label>

        <label className="stack-sm">
          <span className="label">Global Entry PASSID</span>
          <input
            className="input"
            name="global_entry_passid"
            defaultValue={traveler.global_entry_passid ?? ""}
          />
        </label>
      </div>

      <label className="stack-sm">
        <span className="label">Other Traveler Numbers / IDs</span>
        <input
          className="input"
          name="other_traveler_numbers"
          placeholder="NEXUS, SENTRI, military ID, agency ID, etc."
        />
      </label>

      <label className="stack-sm">
        <span className="label">Notes</span>
        <textarea
          className="textarea"
          name="notes"
          defaultValue={traveler.notes ?? ""}
          rows={3}
          placeholder="Optional notes about trusted traveler numbers or travel IDs"
        />
      </label>

      <button type="submit" className="btn btn-primary">
        Save Primary Traveler Numbers
      </button>
    </form>
  );
}

function AdditionalTravelerForm({
  traveler,
  passportDocuments,
}: {
  traveler: TravelerProfile;
  passportDocuments: TravelerPassportDocument[];
}) {
  return (
    <details
      className="card stack"
      style={{
        background: "#fbfdfe",
        border: "1px solid #e6f0f2",
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
            <TravelerBadge
              relationship={traveler.relationship_to_client}
              isPrimary={false}
              isMinor={traveler.is_minor}
            />
            <h3 style={{ margin: "8px 0 0" }}>{getTravelerName(traveler)}</h3>
            <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
              Added {formatDateTime(traveler.created_at)}
            </p>
          </div>

          <span
            style={{
              color: "var(--accent-dark)",
              fontWeight: 800,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Open Traveler Details
          </span>
        </div>
      </summary>

      <form action={updateAdditionalTravelerProfile} className="stack">
        <input type="hidden" name="traveler_id" value={traveler.id} />

        <section className="stack">
          <h4 style={{ margin: 0 }}>Traveler Details</h4>

          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Enter the traveler&apos;s name exactly as it appears on their passport
            or travel document.
          </p>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">First Name</span>
              <input
                className="input"
                name="first_name"
                defaultValue={traveler.first_name ?? ""}
                required
              />
            </label>

            <label className="stack-sm">
              <span className="label">Middle Name</span>
              <input
                className="input"
                name="middle_name"
                defaultValue={traveler.middle_name ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Last Name</span>
              <input
                className="input"
                name="last_name"
                defaultValue={traveler.last_name ?? ""}
                required
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Relationship to Client</span>
              <select
                className="select"
                name="relationship_to_client"
                defaultValue={traveler.relationship_to_client ?? ""}
              >
                <option value="">Select relationship</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Parent">Parent</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Grandchild">Grandchild</option>
                <option value="Friend">Friend</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">Date of Birth</span>
              <input
                className="input"
                type="date"
                name="date_of_birth"
                defaultValue={traveler.date_of_birth ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Minor Traveler</span>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 46,
                }}
              >
                <input
                  type="checkbox"
                  name="is_minor"
                  defaultChecked={traveler.is_minor === true}
                />
                This traveler is a minor child
              </label>
            </label>
          </div>
        </section>

        <section className="stack">
          <h4 style={{ margin: 0 }}>Traveler Numbers</h4>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Known Traveler Number / KTN</span>
              <input
                className="input"
                name="known_traveler_number"
                defaultValue={traveler.known_traveler_number ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Redress Number</span>
              <input
                className="input"
                name="redress_number"
                defaultValue={traveler.redress_number ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Global Entry PASSID</span>
              <input
                className="input"
                name="global_entry_passid"
                defaultValue={traveler.global_entry_passid ?? ""}
              />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Other Traveler Numbers / IDs</span>
            <input
              className="input"
              name="other_traveler_numbers"
              placeholder="NEXUS, SENTRI, military ID, agency ID, etc."
            />
          </label>
        </section>

        <section
          className="stack"
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #e6f0f2",
            background: "#ffffff",
          }}
        >
          <h4 style={{ margin: 0 }}>Additional Traveler Passport Information</h4>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Passport Number</span>
              <input
                className="input"
                name="passport_number"
                defaultValue={traveler.passport_number ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Country</span>
              <input
                className="input"
                name="passport_country"
                defaultValue={traveler.passport_country ?? ""}
                placeholder="US"
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Expiration Date</span>
              <input
                className="input"
                type="date"
                name="passport_expiration_date"
                defaultValue={traveler.passport_expiration_date ?? ""}
              />
            </label>
          </div>
        </section>

        <label className="stack-sm">
          <span className="label">Notes</span>
          <textarea
            className="textarea"
            name="notes"
            defaultValue={traveler.notes ?? ""}
            rows={3}
          />
        </label>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            Save Traveler Details
          </button>
        </div>
      </form>

      <div
        className="stack"
        style={{
          padding: 14,
          borderRadius: 14,
          border: "1px solid #e6f0f2",
          background: "#ffffff",
        }}
      >
        <h4 style={{ margin: 0 }}>Passport Upload</h4>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Upload a passport image or PDF for this additional traveler. The file stays
          connected to this client account and this traveler.
        </p>

        <form action={uploadAdditionalTravelerPassport} className="stack">
          <input type="hidden" name="traveler_id" value={traveler.id} />

          <label className="stack-sm">
            <span className="label">Document Title</span>
            <input
              className="input"
              name="document_title"
              placeholder={`${getTravelerName(traveler)} Passport`}
            />
          </label>

          <label className="stack-sm">
            <span className="label">Passport File</span>
            <input
              className="input"
              type="file"
              name="passport_file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </label>

          <label className="stack-sm">
            <span className="label">Passport Upload Notes</span>
            <textarea
              className="textarea"
              name="passport_notes"
              rows={3}
              placeholder="Optional notes about this passport upload"
            />
          </label>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              lineHeight: 1.5,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="passport_upload_consent"
              value="accepted"
              required
              style={{ marginTop: 4 }}
            />
            <span>
              I authorize Cozy Adventure Vacations to store this passport document
              in my secure client document area for travel planning, supplier
              documentation, or trip support purposes.
            </span>
          </label>

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#c2410c",
              lineHeight: 1.6,
            }}
          >
            <strong>Upload limits:</strong> JPG, PNG, WEBP, or PDF. Maximum file size
            is 15MB.
          </div>

          <button type="submit" className="btn btn-primary">
            Upload Traveler Passport
          </button>
        </form>

        {passportDocuments.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No passport documents have been uploaded for this traveler yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                </tr>
              </thead>

              <tbody>
                {passportDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>{document.document_title}</td>
                    <td>{document.file_name}</td>
                    <td>{formatDateTime(document.created_at)}</td>
                    <td>
                      {document.signedUrl ? (
                        <a
                          href={document.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open Secure Link
                        </a>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form action={deleteTravelerProfile}>
        <input type="hidden" name="traveler_id" value={traveler.id} />
        <button type="submit" className="btn btn-primary">
          Delete Traveler
        </button>
      </form>
    </details>
  );
}

export default async function TravelerNumbersPage({
  searchParams,
}: {
  searchParams: Promise<{ passportUploaded?: string }>;
}) {
  const { passportUploaded } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const primaryTraveler = await ensurePrimaryTravelerProfile(supabase, clientAccount);

  const { data: travelers, error: travelersError } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .order("is_primary_traveler", { ascending: false })
    .order("created_at", { ascending: true });

  const travelerRows = (travelers ?? []) as TravelerProfile[];
  const additionalTravelers = travelerRows.filter(
    (traveler) => traveler.is_primary_traveler !== true,
  );

  const { data: loyaltyNumbers, error: loyaltyError } = await supabase
    .from("traveler_loyalty_numbers")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .order("created_at", { ascending: false });

  const loyaltyRows = (loyaltyNumbers ?? []) as LoyaltyNumber[];

  const { data: travelerPassportDocuments, error: passportDocumentsError } =
    await supabase
      .from("client_documents")
      .select(
        "id, traveler_profile_id, document_type, document_title, file_name, storage_path, content_type, notes, created_at",
      )
      .eq("client_account_id", clientAccount.id)
      .eq("document_type", "passport")
      .not("traveler_profile_id", "is", null)
      .order("created_at", { ascending: false });

  const passportDocumentRows =
    (travelerPassportDocuments ?? []) as Omit<TravelerPassportDocument, "signedUrl">[];

  const passportDocumentsWithUrls: TravelerPassportDocument[] = await Promise.all(
    passportDocumentRows.map(async (document) => {
      const { data } = await supabaseAdmin.storage
        .from("client-documents")
        .createSignedUrl(document.storage_path, 60 * 5);

      return {
        ...document,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <PageShell
      title="Traveler Numbers & Rewards"
      subtitle="Manage trusted traveler numbers and rewards memberships."
    >
      {passportUploaded === "true" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Additional traveler passport document uploaded successfully.</strong>
        </div>
      ) : null}

      {passportDocumentsError ? (
        <div className="card">
          <p>
            <strong>Error loading additional traveler passport documents:</strong>
          </p>
          <pre>{JSON.stringify(passportDocumentsError, null, 2)}</pre>
        </div>
      ) : null}

      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
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
          Keep trusted traveler numbers, rewards memberships, additional travelers,
          and supporting passport files organized in one place.
        </p>

        <div className="grid grid-3">
          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Travelers</span>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 900 }}>
              {travelerRows.length}
            </p>
          </div>

          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Rewards Memberships</span>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 900 }}>
              {loyaltyRows.length}
            </p>
          </div>

          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Passport Uploads</span>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 900 }}>
              {passportDocumentsWithUrls.length}
            </p>
          </div>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Sensitive information notice:</strong> Do not store passwords here.
          Only add traveler numbers and rewards information needed for travel planning
          or reservation support.
        </p>
      </div>

      {travelersError ? (
        <div className="card">
          <p>
            <strong>Error loading travelers:</strong>
          </p>
          <pre>{JSON.stringify(travelersError, null, 2)}</pre>
        </div>
      ) : (
        <>
          <div className="card stack">
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
                <h2 style={{ margin: 0 }}>Primary Traveler Numbers</h2>
                <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                  These numbers are connected to your primary client profile. Your
                  name, date of birth, and passport details are managed from your
                  main profile and passport section.
                </p>
              </div>

              <TravelerBadge
                relationship="Self"
                isPrimary={true}
                isMinor={false}
              />
            </div>

            <PrimaryTravelerNumbersForm traveler={primaryTraveler} />
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Rewards Memberships</h2>

            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Add airline, hotel, cruise, rental car, theme park, credit card travel, and other rewards accounts for each traveler.
            </p>

            {loyaltyError ? (
              <div>
                <p>
                  <strong>Error loading loyalty numbers:</strong>
                </p>
                <pre>{JSON.stringify(loyaltyError, null, 2)}</pre>
              </div>
            ) : (
              <>
                <form action={addLoyaltyNumber} className="stack">
                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">Traveler</span>
                      <select
                        className="select"
                        name="traveler_profile_id"
                        defaultValue={primaryTraveler.id}
                        required
                      >
                        {travelerRows.map((traveler) => (
                          <option key={traveler.id} value={traveler.id}>
                            {getTravelerName(traveler)}
                            {traveler.is_primary_traveler ? " — Primary" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="stack-sm">
                      <span className="label">Rewards Type</span>
                      <select className="select" name="loyalty_type" defaultValue="airline">
                        <option value="airline">Airline</option>
                        <option value="hotel">Hotel</option>
                        <option value="cruise">Cruise Line</option>
                        <option value="rental_car">Rental Car</option>
                        <option value="rail">Rail</option>
                        <option value="theme_park">Theme Park</option>
                        <option value="credit_card">Credit Card Travel Program</option>
                        <option value="tour">Tour / Activity</option>
                        <option value="vacation_package">
                          Vacation Package / Supplier
                        </option>
                        <option value="other">Other</option>
                      </select>
                    </label>

                    <label className="stack-sm">
                      <span className="label">Company Name</span>
                      <input
                        className="input"
                        name="company_name"
                        placeholder="American Airlines, Hilton, Disney, Royal Caribbean"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">Program Name</span>
                      <input
                        className="input"
                        name="program_name"
                        placeholder="AAdvantage, Hilton Honors, Castaway Club"
                      />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Rewards / Membership Number</span>
                      <input className="input" name="loyalty_number" required />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Notes</span>
                      <input className="input" name="notes" placeholder="Optional notes" />
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Add Rewards Membership
                  </button>
                </form>

                <div className="card stack" style={{ background: "#ffffff" }}>
                  <h3 style={{ margin: 0 }}>Existing Rewards Memberships</h3>

                  {loyaltyRows.length === 0 ? (
                    <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                      No rewards memberships have been added yet.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {loyaltyRows.map((loyalty) => (
                        <details
                          key={loyalty.id}
                          style={{
                            border: "1px solid #e6f0f2",
                            borderRadius: 16,
                            background: "#fbfdfe",
                            overflow: "hidden",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              padding: "12px 14px",
                              background: "#ffffff",
                              borderBottom: "1px solid #e6f0f2",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <LoyaltyTypeBadge type={loyalty.loyalty_type} />

                                <h4 style={{ margin: "8px 0 0", fontSize: 17 }}>
                                  {loyalty.company_name}
                                </h4>

                                <p style={{ margin: "4px 0 0", color: "#667085" }}>
                                  {loyalty.traveler_name_snapshot
                                    ? `${loyalty.traveler_name_snapshot} • `
                                    : ""}
                                  {loyalty.program_name
                                    ? `${loyalty.program_name} • ${loyalty.loyalty_number}`
                                    : loyalty.loyalty_number}
                                </p>
                              </div>

                              <span
                                style={{
                                  color: "var(--accent-dark)",
                                  fontWeight: 800,
                                  fontSize: 14,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Edit Details
                              </span>
                            </div>
                          </summary>

                          <div className="card stack" style={{ border: "none", borderRadius: 0 }}>
                            <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>
                              Added {formatDateTime(loyalty.created_at)}
                            </p>

                            <form action={updateLoyaltyNumber} className="stack">
                              <input type="hidden" name="loyalty_id" value={loyalty.id} />

                              <div className="grid grid-3">
                                <label className="stack-sm">
                                  <span className="label">Traveler</span>
                                  <select
                                    className="select"
                                    name="traveler_profile_id"
                                    defaultValue={loyalty.traveler_profile_id}
                                    required
                                  >
                                    {travelerRows.map((travelerOption) => (
                                      <option key={travelerOption.id} value={travelerOption.id}>
                                        {getTravelerName(travelerOption)}
                                        {travelerOption.is_primary_traveler ? " — Primary" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Rewards Type</span>
                                  <select
                                    className="select"
                                    name="loyalty_type"
                                    defaultValue={loyalty.loyalty_type}
                                  >
                                    <option value="airline">Airline</option>
                                    <option value="hotel">Hotel</option>
                                    <option value="cruise">Cruise Line</option>
                                    <option value="rental_car">Rental Car</option>
                                    <option value="rail">Rail</option>
                                    <option value="theme_park">Theme Park</option>
                                    <option value="credit_card">
                                      Credit Card Travel Program
                                    </option>
                                    <option value="tour">Tour / Activity</option>
                                    <option value="vacation_package">
                                      Vacation Package / Supplier
                                    </option>
                                    <option value="other">Other</option>
                                  </select>
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Company Name</span>
                                  <input
                                    className="input"
                                    name="company_name"
                                    defaultValue={loyalty.company_name}
                                    required
                                  />
                                </label>
                              </div>

                              <div className="grid grid-3">
                                <label className="stack-sm">
                                  <span className="label">Program Name</span>
                                  <input
                                    className="input"
                                    name="program_name"
                                    defaultValue={loyalty.program_name ?? ""}
                                  />
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Rewards / Membership Number</span>
                                  <input
                                    className="input"
                                    name="loyalty_number"
                                    defaultValue={loyalty.loyalty_number}
                                    required
                                  />
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Notes</span>
                                  <input
                                    className="input"
                                    name="notes"
                                    defaultValue={loyalty.notes ?? ""}
                                    placeholder="Optional notes"
                                  />
                                </label>
                              </div>

                              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                                <button type="submit" className="btn btn-primary">
                                  Save Rewards Membership
                                </button>
                              </div>
                            </form>

                            <form action={deleteLoyaltyNumber}>
                              <input type="hidden" name="loyalty_id" value={loyalty.id} />
                              <button type="submit" className="btn btn-primary">
                                Remove Rewards Membership
                              </button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Additional Travelers</h2>

            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Use this section for a spouse, child, minor traveler, grandparent, friend, or anyone else connected to your trip.
            </p>

            <details
              style={{
                border: "1px solid #e6f0f2",
                borderRadius: 16,
                background: "#fbfdfe",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  padding: "12px 14px",
                  background: "#ffffff",
                  borderBottom: "1px solid #e6f0f2",
                  fontWeight: 800,
                  color: "var(--accent-dark)",
                }}
              >
                Add Traveler
              </summary>

              <form action={addAdditionalTravelerProfile} className="stack" style={{ padding: 16 }}>
                <section className="stack">
                  <h3 style={{ margin: 0 }}>Traveler Details</h3>

                  <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                    Enter the traveler&apos;s name exactly as it appears on their
                    passport or travel document.
                  </p>

                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">First Name</span>
                      <input className="input" name="first_name" required />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Middle Name</span>
                      <input className="input" name="middle_name" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Last Name</span>
                      <input className="input" name="last_name" required />
                    </label>
                  </div>

                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">Relationship to Client</span>
                      <select className="select" name="relationship_to_client">
                        <option value="">Select relationship</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Child">Child</option>
                        <option value="Parent">Parent</option>
                        <option value="Grandparent">Grandparent</option>
                        <option value="Grandchild">Grandchild</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <label className="stack-sm">
                      <span className="label">Date of Birth</span>
                      <input className="input" type="date" name="date_of_birth" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Minor Traveler</span>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minHeight: 46,
                        }}
                      >
                        <input type="checkbox" name="is_minor" />
                        This traveler is a minor child
                      </label>
                    </label>
                  </div>
                </section>

                <section className="stack">
                  <h3 style={{ margin: 0 }}>Traveler Numbers</h3>

                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">Known Traveler Number / KTN</span>
                      <input className="input" name="known_traveler_number" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Redress Number</span>
                      <input className="input" name="redress_number" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Global Entry PASSID</span>
                      <input className="input" name="global_entry_passid" />
                    </label>
                  </div>

                  <label className="stack-sm">
                    <span className="label">Other Traveler Numbers / IDs</span>
                    <input
                      className="input"
                      name="other_traveler_numbers"
                      placeholder="NEXUS, SENTRI, military ID, agency ID, etc."
                    />
                  </label>
                </section>

                <section
                  className="stack"
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid #e6f0f2",
                    background: "#ffffff",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Additional Traveler Passport Information</h3>

                  <div className="grid grid-3">
                    <label className="stack-sm">
                      <span className="label">Passport Number</span>
                      <input className="input" name="passport_number" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Passport Country</span>
                      <input className="input" name="passport_country" placeholder="US" />
                    </label>

                    <label className="stack-sm">
                      <span className="label">Passport Expiration Date</span>
                      <input className="input" type="date" name="passport_expiration_date" />
                    </label>
                  </div>
                </section>

                <label className="stack-sm">
                  <span className="label">Notes</span>
                  <textarea
                    className="textarea"
                    name="notes"
                    placeholder="Optional traveler notes"
                    rows={3}
                  />
                </label>

                <button type="submit" className="btn btn-primary">
                  Add Traveler
                </button>
              </form>
            </details>

            {additionalTravelers.length === 0 ? (
              <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                No additional travelers have been added yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {additionalTravelers.map((traveler) => (
                  <AdditionalTravelerForm
                    key={traveler.id}
                    traveler={traveler}
                    passportDocuments={passportDocumentsWithUrls.filter(
                      (document) => document.traveler_profile_id === traveler.id,
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
