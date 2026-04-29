import Link from "next/link";
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
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const { uploaded } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

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
      title="Upload Passport"
      subtitle="Securely upload passport documentation for your travel profile."
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
          Secure Passport Upload
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>Passport Document</h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Uploading your passport image or PDF can help keep your travel profile
          organized when passport details are needed for trip planning, supplier
          documentation, or reservation support.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile" className="btn btn-outline">
            Back to Profile
          </Link>

          <Link href="/profile/documents/upload" className="btn btn-outline">
            Upload Other Travel Documents
          </Link>

          <Link href="/trips" className="btn btn-outline">
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

      <div
        className="card stack"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
        }}
      >
        <h2 style={{ margin: 0 }}>Important Passport Upload Notice</h2>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Passport documents contain highly sensitive identity information. Only
          upload this document if you are comfortable storing it in your secure
          Cozy Concierge profile for travel planning or trip support purposes.
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          <li>Do not upload passport documents from a public or shared computer.</li>
          <li>Do not upload another traveler’s passport unless you are authorized.</li>
          <li>Do not share temporary passport links with anyone who should not see them.</li>
          <li>Uploaded copies do not replace your original passport for travel.</li>
        </ul>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upload Passport Document</h2>

        <form action={uploadPassportDocument} className="stack">
          <label className="stack-sm">
            <span className="label">Document Title</span>
            <input
              className="input"
              name="document_title"
              placeholder="Example: Jeremy Passport"
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
            <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
              Accepted formats: JPG, PNG, WEBP, or PDF. Maximum size: 15MB.
            </span>
          </label>

          <label className="stack-sm">
            <span className="label">Notes</span>
            <textarea
              className="textarea"
              name="notes"
              rows={4}
              placeholder="Optional notes, such as traveler name or trip this passport is connected to."
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
              I understand this passport document contains sensitive identity
              information, and I authorize Cozy Adventure Vacations to store it
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
            <strong>Reminder:</strong> Uploading a passport copy here helps keep
            your profile organized, but travelers are still responsible for
            carrying and presenting their original passport when required by
            airlines, cruise lines, border officials, resorts, or suppliers.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Upload Passport Document
            </button>

            <Link href="/profile" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Passport Documents</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          For security, passport document links on this page expire after 5
          minutes. Refresh the page to generate a new temporary link if needed.
        </p>

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
                          className="btn btn-outline"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open 5-Min Link
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
    </PageShell>
  );
}