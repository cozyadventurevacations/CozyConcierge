import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedDocumentTypes = [
  "minor_permission",
  "minor_international_consent",
  "medical",
  "insurance",
  "accessibility",
  "supplier_required",
  "general",
];

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ClientDocument = {
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

function getDocumentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "minor_permission":
      return "Minor Permission Slip";
    case "minor_international_consent":
      return "Minor International Travel Consent";
    case "medical":
      return "Medical / Health Document";
    case "insurance":
      return "Travel Insurance Document";
    case "accessibility":
      return "Accessibility Document";
    case "supplier_required":
      return "Supplier-Required Document";
    case "passport":
      return "Passport";
    case "general":
      return "General Travel Document";
    default:
      return "General Travel Document";
  }
}

function requireAllowedDocumentType(value: string) {
  if (!allowedDocumentTypes.includes(value)) {
    throw new Error("Invalid document type submitted.");
  }

  return value;
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

async function uploadClientDocument(formData: FormData) {
  "use server";

  const { user, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const consent = String(formData.get("document_upload_consent") ?? "");

  if (consent !== "accepted") {
    throw new Error("You must acknowledge the document upload notice before uploading.");
  }

  const file = formData.get("document_file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a document to upload.");
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
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, WEBP, PDF, DOC, or DOCX file.");
  }

  const documentType = requireAllowedDocumentType(
    String(formData.get("document_type") ?? "general").trim(),
  );

  const documentTitle =
    cleanText(formData, "document_title") ?? getDocumentTypeLabel(documentType);

  const originalFileName = sanitizeFileName(file.name || "client-document");

  const storagePath = `${clientAccount.id}/${documentType}/${crypto.randomUUID()}-${originalFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("client-documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const notes = cleanText(formData, "notes");

  const { error: insertError } = await supabaseAdmin.from("client_documents").insert({
    client_account_id: clientAccount.id,
    uploaded_by_user_id: user.id,
    document_type: documentType,
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
  revalidatePath("/profile/documents/upload");
  redirect("/profile/documents/upload?uploaded=true");
}

export default async function ClientDocumentUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const { uploaded } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: clientDocuments, error: documentsError } = await supabase
    .from("client_documents")
    .select(
      "id, document_type, document_title, file_name, storage_path, content_type, notes, created_at",
    )
    .eq("client_account_id", clientAccount.id)
    .neq("document_type", "passport")
    .order("created_at", { ascending: false });

  const documentRows = (clientDocuments ?? []) as ClientDocument[];

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
      title="Upload Travel Documents"
      subtitle="Securely upload supporting documents for your travel profile."
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
          Secure Client Document Upload
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          Supporting Travel Documents
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Upload documents that may be needed for travel, including minor travel
          permission slips, one-parent international travel consent forms, insurance
          documents, medical notes, accessibility documentation, or other
          supplier-required paperwork.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile" className="btn btn-outline">
            Back to Profile
          </Link>

          <Link href="/profile/passport-upload" className="btn btn-outline">
            Upload Passport Image
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
          <strong>Travel document uploaded successfully.</strong>
        </div>
      ) : null}

      <div
        className="card stack"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
        }}
      >
        <h2 style={{ margin: 0 }}>Important Document Upload Notice</h2>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Some travel documents may contain sensitive personal, medical, legal, or
          identity information. Only upload documents that are necessary for travel
          planning, supplier documentation, or trip support.
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          <li>Do not upload documents for another traveler unless you are authorized.</li>
          <li>Do not upload documents from a public or shared computer.</li>
          <li>Do not share temporary document links with anyone who should not see them.</li>
          <li>Uploaded copies do not replace required original documents.</li>
        </ul>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upload Document</h2>

        <form action={uploadClientDocument} className="stack">
          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Document Type</span>
              <select className="select" name="document_type" defaultValue="general">
                <option value="minor_permission">Minor Permission Slip</option>
                <option value="minor_international_consent">
                  Minor International Travel Consent
                </option>
                <option value="medical">Medical / Health Document</option>
                <option value="insurance">Travel Insurance Document</option>
                <option value="accessibility">Accessibility Document</option>
                <option value="supplier_required">Supplier-Required Document</option>
                <option value="general">General Travel Document</option>
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">Document Title</span>
              <input
                className="input"
                name="document_title"
                placeholder="Example: Notarized Minor Travel Consent"
              />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Document File</span>
            <input
              className="input"
              type="file"
              name="document_file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
              required
            />
            <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
              Accepted formats: JPG, PNG, WEBP, PDF, DOC, or DOCX. Maximum size:
              15MB.
            </span>
          </label>

          <label className="stack-sm">
            <span className="label">Notes</span>
            <textarea
              className="textarea"
              name="notes"
              rows={4}
              placeholder="Optional notes, such as traveler name, trip name, destination, or what this document is for."
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
              name="document_upload_consent"
              value="accepted"
              required
              style={{ marginTop: 4 }}
            />
            <span>
              I understand this document may contain sensitive information, and I
              authorize Cozy Adventure Vacations to store it in my secure client
              document area for travel planning, supplier documentation, or trip
              support purposes.
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
            <strong>Reminder:</strong> Uploading a document here helps keep things
            organized, but travelers are still responsible for carrying and
            presenting required originals when airlines, border officials, cruise
            lines, resorts, or suppliers require them.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Upload Travel Document
            </button>

            <Link href="/profile" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Travel Documents</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          For security, document links on this page expire after 5 minutes. Refresh
          the page to generate a new temporary link if needed.
        </p>

        {documentsError ? (
          <div>
            <p>
              <strong>Error loading documents:</strong>
            </p>
            <pre>{JSON.stringify(documentsError, null, 2)}</pre>
          </div>
        ) : documentsWithUrls.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No supporting travel documents have been uploaded yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Type</th>
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
                    <td>{getDocumentTypeLabel(document.document_type)}</td>
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