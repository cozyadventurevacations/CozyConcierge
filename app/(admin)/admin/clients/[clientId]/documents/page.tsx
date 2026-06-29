import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ClientDocument = {
  id: string;
  client_account_id: string;
  uploaded_by_user_id: string | null;
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

function getDocumentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "passport":
      return "Passport";
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
    case "general":
      return "General Travel Document";
    default:
      return type ?? "Unknown Document";
  }
}

function DocumentTypeBadge({ type }: { type: string | null | undefined }) {
  const isPassport = type === "passport";
  const isMinorDocument =
    type === "minor_permission" || type === "minor_international_consent";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isPassport ? "#fff7ed" : isMinorDocument ? "#eff6ff" : "#f0f7f8",
        color: isPassport ? "#c2410c" : isMinorDocument ? "#1d4ed8" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {getDocumentTypeLabel(type)}
    </span>
  );
}

function ActionButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-primary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <span className="label">{label}</span>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}

async function uploadClientPassportDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();
  const supabaseAdmin = createSupabaseAdminClient();

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) throw new Error("Missing client ID.");

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "Client not found.");
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
  const storagePath = `${clientId}/passport/admin-${crypto.randomUUID()}-${originalFileName}`;

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
    client_account_id: clientId,
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

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/documents`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${clientId}/documents?uploaded=true`);
}

async function deleteClientDocument(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabaseAdmin = createSupabaseAdminClient();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!clientId) throw new Error("Missing client ID.");
  if (!documentId) throw new Error("Missing document ID.");

  const { data: document, error: documentError } = await supabaseAdmin
    .from("client_documents")
    .select("id, client_account_id, storage_path")
    .eq("id", documentId)
    .eq("client_account_id", clientId)
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? "Document not found.");
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from("client-documents")
    .remove([document.storage_path]);

  if (storageError) throw new Error(storageError.message);

  const { error: deleteError } = await supabaseAdmin
    .from("client_documents")
    .delete()
    .eq("id", documentId)
    .eq("client_account_id", clientId);

  if (deleteError) throw new Error(deleteError.message);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/documents`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${clientId}/documents?deleted=true`);
}

export default async function AdminClientDocumentsPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ uploaded?: string; deleted?: string }>;
  params: Promise<{ clientId: string }>;
}) {
  const { uploaded, deleted } = await searchParams;
  const { clientId } = await params;
  const { supabase } = await requireAdmin();

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return (
      <PageShell title="Client Documents" subtitle="We could not load this client.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(clientError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientRow = client as ClientDetail;

  const clientName =
    `${clientRow.first_name ?? ""} ${clientRow.last_name ?? ""}`.trim() ||
    "Unnamed Client";

  const { data: documents, error: documentsError } = await supabase
    .from("client_documents")
    .select(
      "id, client_account_id, uploaded_by_user_id, document_type, document_title, file_name, storage_path, content_type, notes, created_at",
    )
    .eq("client_account_id", clientId)
    .order("created_at", { ascending: false });

  const documentRows = (documents ?? []) as ClientDocument[];

  const passportDocuments = documentRows.filter(
    (document) => document.document_type === "passport",
  );

  const minorTravelDocuments = documentRows.filter(
    (document) =>
      document.document_type === "minor_permission" ||
      document.document_type === "minor_international_consent",
  );

  const otherDocuments = documentRows.filter(
    (document) =>
      document.document_type !== "passport" &&
      document.document_type !== "minor_permission" &&
      document.document_type !== "minor_international_consent",
  );

  return (
    <PageShell title="Client Documents" subtitle={`Uploaded documents for ${clientName}.`}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <ActionButton href={`/admin/clients/${clientRow.id}`}>
          Back to Client
        </ActionButton>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ActionButton href="/admin/clients">Back to Clients</ActionButton>
          <ActionButton href="/admin/client-documents">All Client Documents</ActionButton>
        </div>
      </div>

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
          Secure Client Documents
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>{clientName}</h1>

        <div className="grid grid-3">
          <StatCard label="Total Documents" value={documentRows.length} />
          <StatCard label="Passport Documents" value={passportDocuments.length} />
          <StatCard label="Minor Travel Documents" value={minorTravelDocuments.length} />
        </div>

        <div className="grid grid-3">
          <StatCard label="Other Documents" value={otherDocuments.length} />
        </div>
      </div>

      <div
        className="card"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Sensitive document reminder:</strong> Only open client documents when needed
        for legitimate trip support, supplier documentation, or travel planning.
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

      {deleted === "true" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Document deleted successfully.</strong>
        </div>
      ) : null}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upload Passport for Client</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Use this when the client sends you a passport copy directly. The file
          is stored in the same secure client document vault and marked as a
          passport document.
        </p>

        <form action={uploadClientPassportDocument} className="stack">
          <input type="hidden" name="client_id" value={clientRow.id} />

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Document Title</span>
              <input
                className="input"
                name="document_title"
                placeholder={`${clientName} Passport`}
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
          </div>

          <label className="stack-sm">
            <span className="label">Notes</span>
            <textarea
              className="textarea"
              name="notes"
              rows={3}
              placeholder="Optional notes, such as traveler name or trip this passport supports."
            />
          </label>

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
            <strong>Upload limits:</strong> JPG, PNG, WEBP, or PDF. Maximum file
            size is 15MB. Only upload documents the client has provided for
            legitimate travel support.
          </div>

          <button type="submit" className="btn btn-primary">
            Upload Passport Document
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Documents</h2>

        {documentsError ? (
          <div>
            <p>
              <strong>Error loading documents:</strong>
            </p>
            <pre>{JSON.stringify(documentsError, null, 2)}</pre>
          </div>
        ) : documentRows.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              This client has not uploaded any profile documents yet.
            </p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Content Type</th>
                  <th>Notes</th>
                  <th>Open</th>
                  <th>Delete</th>
                </tr>
              </thead>

              <tbody>
                {documentRows.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <DocumentTypeBadge type={document.document_type} />
                    </td>

                    <td>{document.document_title}</td>

                    <td>{document.file_name}</td>

                    <td>{formatDateTime(document.created_at)}</td>

                    <td>{document.content_type ?? "Not provided"}</td>

                    <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                      {document.notes ?? "Not provided"}
                    </td>

                    <td>
                      <a
                        href={`/api/admin/client-documents/${document.id}/open`}
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
                    </td>
                    <td>
                      <form action={deleteClientDocument}>
                        <input type="hidden" name="client_id" value={clientRow.id} />
                        <input type="hidden" name="document_id" value={document.id} />
                        <button
                          type="submit"
                          className="btn btn-outline"
                          style={{ color: "#b42318", borderColor: "#fecaca", whiteSpace: "nowrap" }}
                        >
                          Delete
                        </button>
                      </form>
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
