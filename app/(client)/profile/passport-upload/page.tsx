import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptIfPresent, decryptIfPresent } from "@/lib/encryption";

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

type PassportDocument = {
  id: string;
  document_type: string;
  document_title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  notes: string | null;
  created_at: string | null;
};

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

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function buildName(
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
) {
  return `${firstName ?? ""} ${middleName ?? ""} ${lastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function getClientName(client: ClientAccount | null | undefined) {
  if (!client) return "Unknown Client";
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed Client";
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
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

async function updatePrimaryPassportDetails(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing primary traveler ID.");
  }

  const passportFirstName = cleanText(formData, "passport_first_name");
  const passportMiddleName = cleanText(formData, "passport_middle_name");
  const passportLastName = cleanText(formData, "passport_last_name");

  if (!passportFirstName || !passportLastName) {
    throw new Error("Passport first name and last name are required.");
  }

  const passportFullName = buildName(
    passportFirstName,
    passportMiddleName,
    passportLastName,
  );

  const { error } = await supabase
    .from("traveler_profiles")
    .update({
      first_name: passportFirstName,
      middle_name: passportMiddleName,
      last_name: passportLastName,
      passport_full_name: passportFullName,
      passport_number: encryptIfPresent(cleanText(formData, "passport_number")),
      passport_country: cleanText(formData, "passport_country"),
      passport_expiration_date: cleanText(formData, "passport_expiration_date"),
      relationship_to_client: "Self",
      is_primary_traveler: true,
      is_minor: false,
    })
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .eq("is_primary_traveler", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/passport-upload");
  revalidatePath("/profile/traveler-numbers");
  redirect("/profile/passport-upload?details=saved");
}

async function uploadPassportDocument(formData: FormData) {
  "use server";

  const { user, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

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

  const documentTitle =
    cleanText(formData, "document_title") ?? "Passport Document";

  const notes = cleanText(formData, "notes");

  const originalFileName = sanitizeFileName(file.name || "passport-document");

  const storagePath = `${clientAccount.id}/passport/${crypto.randomUUID()}-${originalFileName}`;

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
  redirect("/profile/passport-upload?uploaded=true");
}

export default async function PassportUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string; details?: string }>;
}) {
  const { uploaded, details } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const primaryTraveler = await ensurePrimaryTravelerProfile(supabase, clientAccount);

  const { data: passportDocuments, error: passportDocumentsError } = await supabase
    .from("client_documents")
    .select(
      "id, document_type, document_title, file_name, storage_path, content_type, notes, created_at",
    )
    .eq("client_account_id", clientAccount.id)
    .eq("document_type", "passport")
    .order("created_at", { ascending: false });

  const documentRows = (passportDocuments ?? []) as PassportDocument[];

  const documentsWithUrls = await Promise.all(
    documentRows.map(async (doc) => {
      const { data } = await supabaseAdmin.storage
        .from("client-documents")
        .createSignedUrl(doc.storage_path, 60 * 5);

      return {
        ...doc,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <PageShell
      title="Passport Details & Upload"
      subtitle="Manage passport reference details and securely upload passport documentation."
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
          Secure Passport Area
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          Passport Details & Documents
        </h1>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Profile owner: <strong>{getClientName(clientAccount)}</strong>
          {clientAccount.email ? ` — ${clientAccount.email}` : ""}
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile" className="btn btn-primary">
            Back to Profile
          </Link>
          <Link href="/profile/documents/upload" className="btn btn-primary">
            Upload Other Travel Documents
          </Link>
          <Link href="/trips" className="btn btn-primary">
            Back to My Trips
          </Link>
        </div>
      </div>

      {uploaded === "true" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Passport document uploaded successfully.</strong>
        </div>
      ) : null}

      {details === "saved" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Passport details saved successfully.</strong>
        </div>
      ) : null}

      <div
        className="card"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Passport information notice:</strong> Passport details and documents
        contain sensitive identity information. Only add passport information that is
        necessary for travel planning, supplier documentation, or trip support.
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Primary Passport Details</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Enter your name exactly as it appears on your passport or travel document.
          These details are connected to your primary traveler profile.
        </p>

        <form action={updatePrimaryPassportDetails} className="stack">
          <input type="hidden" name="traveler_id" value={primaryTraveler.id} />

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Passport First Name</span>
              <input
                className="input"
                name="passport_first_name"
                defaultValue={primaryTraveler.first_name ?? clientAccount.first_name ?? ""}
                required
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Middle Name</span>
              <input
                className="input"
                name="passport_middle_name"
                defaultValue={primaryTraveler.middle_name ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Last Name</span>
              <input
                className="input"
                name="passport_last_name"
                defaultValue={primaryTraveler.last_name ?? clientAccount.last_name ?? ""}
                required
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Passport Number</span>
              <input
                className="input"
                name="passport_number"
                defaultValue={decryptIfPresent(primaryTraveler.passport_number) ?? ""}
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Country</span>
              <input
                className="input"
                name="passport_country"
                defaultValue={primaryTraveler.passport_country ?? ""}
                placeholder="US"
              />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Expiration Date</span>
              <input
                className="input"
                type="date"
                name="passport_expiration_date"
                defaultValue={primaryTraveler.passport_expiration_date ?? ""}
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            Save Passport Details
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upload Passport Document</h2>

        <form action={uploadPassportDocument} className="stack">
          <label className="stack-sm">
            <span className="label">Document Title</span>
            <input
              className="input"
              name="document_title"
              placeholder="Passport Document"
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
            <span className="label">Notes</span>
            <textarea
              className="textarea"
              name="notes"
              rows={4}
              placeholder="Traveler name or trip this passport is connected to."
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
            is 15MB. Uploaded copies do not replace your original passport for travel.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Upload Passport Document
            </button>
            <Link href="/profile" className="btn btn-primary">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Passport Documents</h2>

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
          Passport document links expire after 5 minutes. Refresh the page to generate
          a new temporary link.
        </div>

        {passportDocumentsError ? (
          <div>
            <p>
              <strong>Error loading passport documents:</strong>
            </p>
            <pre>{JSON.stringify(passportDocumentsError, null, 2)}</pre>
          </div>
        ) : documentsWithUrls.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No passport documents have been uploaded yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Notes</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {documentsWithUrls.map((document) => (
                  <tr key={document.id}>
                    <td>{document.document_title}</td>
                    <td>{document.file_name}</td>
                    <td>{formatDateTime(document.created_at)}</td>
                    <td>{document.notes ?? "Not provided"}</td>
<td>
  {document.signedUrl ? (
    <a
      href={document.signedUrl}
      target="_blank"
      rel="noreferrer"
      className="btn btn-primary"
    >
      Open
    </a>
  ) : (
    <span style={{ color: "#64748b" }}>Unavailable</span>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}