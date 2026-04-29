import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const allowedExtensions = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];

function validateVisibility(value: string) {
  if (value !== "internal" && value !== "client") {
    throw new Error("Invalid document visibility.");
  }

  return value;
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex).toLowerCase();
}

function validateUploadedFile(file: File) {
  if (file.size === 0) {
    throw new Error("Selected file is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is too large. Maximum upload size is 15MB.");
  }

  const extension = getFileExtension(file.name);
  const mimeType = file.type || "";

  const hasAllowedExtension = allowedExtensions.includes(extension);
  const hasAllowedMimeType = mimeType ? allowedMimeTypes.includes(mimeType) : false;

  if (!hasAllowedExtension || (mimeType && !hasAllowedMimeType)) {
    throw new Error(
      "Invalid file type. Allowed files: PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, and XLSX.",
    );
  }
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null | undefined, fallback = "") {
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

function VisibilityBadge({ visibility }: { visibility: string | null | undefined }) {
  const isClient = visibility === "client";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isClient ? "#ecfdf3" : "#fff7ed",
        color: isClient ? "#027a48" : "#c2410c",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {isClient ? "Visible to Client" : "Internal Only"}
    </span>
  );
}

async function uploadTripDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const visibility = validateVisibility(
    String(formData.get("visibility") ?? "internal").trim(),
  );
  const file = formData.get("file");

  if (!tripId) throw new Error("Missing trip ID.");
  if (!(file instanceof File)) throw new Error("File is required.");

  validateUploadedFile(file);

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error("Trip not found or access denied.");
  }

  const safeFileName =
    file.name
      .trim()
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .replace(/_+/g, "_") || "document";

  const storagePath = `${tripId}/${crypto.randomUUID()}-${safeFileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("trip-documents")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await supabase
    .from("trip_documents")
    .insert({
      trip_id: tripId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      visibility,
      uploaded_by_user_profile_id: userProfile.id,
    });

  if (insertError) {
    await supabase.storage.from("trip-documents").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function updateDocumentVisibility(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();
  const visibility = validateVisibility(
    String(formData.get("visibility") ?? "").trim(),
  );

  if (!tripId) throw new Error("Missing trip ID.");
  if (!documentId) throw new Error("Missing document ID.");

  const { data: document, error: docError } = await supabase
    .from("trip_documents")
    .select("id, trip_id")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .single();

  if (docError || !document) {
    throw new Error(docError?.message ?? "Document not found.");
  }

  const { error } = await supabase
    .from("trip_documents")
    .update({ visibility })
    .eq("id", documentId)
    .eq("trip_id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function deleteTripDocument(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!documentId) throw new Error("Missing document ID.");

  const { data: document, error: docError } = await supabase
    .from("trip_documents")
    .select("id, trip_id, storage_path")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .single();

  if (docError || !document) {
    throw new Error(docError?.message ?? "Document not found.");
  }

  const { error: storageDeleteError } = await supabase.storage
    .from("trip-documents")
    .remove([document.storage_path]);

  if (storageDeleteError) {
    throw new Error(storageDeleteError.message);
  }

  const { error: deleteRowError } = await supabase
    .from("trip_documents")
    .delete()
    .eq("id", documentId)
    .eq("trip_id", tripId);

  if (deleteRowError) {
    throw new Error(deleteRowError.message);
  }

  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

export default async function AdminTripDocumentsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { supabase } = await requireAdmin();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_name")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Documents" subtitle="We could not load this trip.">
        <div className="card">
          <pre>{JSON.stringify(tripError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const { data: documents, error: docsError } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(doc.storage_path, 60 * 60);

      return {
        ...doc,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <PageShell
      title="Trip Documents"
      subtitle={`Upload and manage files for ${trip.trip_name ?? "this trip"}.`}
    >
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
        <Link href={`/admin/trips/${trip.id}`} className="btn btn-primary">
          Back to Trip
        </Link>
      </div>

      <form
        action={uploadTripDocument}
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />

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
          Trip Document Upload
        </p>

        <h2 style={{ margin: 0 }}>Upload Document</h2>

        <label className="stack-sm">
          <span className="label">File</span>
          <input
            className="input"
            type="file"
            name="file"
            required
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          />
        </label>

        <label className="stack-sm">
          <span className="label">Visibility</span>
          <select className="select" name="visibility" defaultValue="internal">
            <option value="internal">Internal Only</option>
            <option value="client">Visible to Client</option>
          </select>
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
          <strong>Upload limits:</strong> PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, or XLSX.
          Maximum file size is 15MB.
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary">
            Upload Document
          </button>
        </div>
      </form>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Documents</h2>

        {docsError ? (
          <pre>{JSON.stringify(docsError, null, 2)}</pre>
        ) : documentsWithUrls.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>No documents uploaded yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Visibility</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                  <th>Update Visibility</th>
                  <th>Delete</th>
                </tr>
              </thead>

              <tbody>
                {documentsWithUrls.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.file_name}</td>
                    <td>
                      <VisibilityBadge visibility={doc.visibility} />
                    </td>
                    <td>{doc.mime_type ?? "unknown"}</td>
                    <td>{formatFileSize(doc.file_size_bytes)}</td>
                    <td>{formatDateTime(doc.created_at)}</td>
                    <td>
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open
                        </a>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                    <td>
                      <form action={updateDocumentVisibility} className="row">
                        <input type="hidden" name="trip_id" value={trip.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <select
                          className="select"
                          name="visibility"
                          defaultValue={doc.visibility}
                        >
                          <option value="internal">Internal</option>
                          <option value="client">Client</option>
                        </select>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={deleteTripDocument}>
                        <input type="hidden" name="trip_id" value={trip.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
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