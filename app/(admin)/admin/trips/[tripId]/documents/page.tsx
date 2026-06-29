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

const tripComponentTypeLabels: Record<string, string> = {
  hotel: "Hotel",
  air: "Air",
  cruise: "Cruise",
  transfer: "Transfer",
  activity: "Activity",
  insurance: "Insurance",
};

function getComponentTypeLabel(componentType: string | null | undefined) {
  if (!componentType) return "General Trip Document";
  return tripComponentTypeLabels[componentType] ?? componentType;
}

function getComponentSelectLabel(component: any) {
  const typeLabel = getComponentTypeLabel(component.component_type);
  const detail =
    component.display_name ||
    component.supplier_name ||
    component.confirmation_number ||
    null;

  return detail ? `${typeLabel} - ${detail}` : typeLabel;
}

function validateVisibility(value: string) {
  if (
    value !== "internal" &&
    value !== "client" &&
    value !== "travel_circle"
  ) {
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
  const isTravelCircle = visibility === "travel_circle";

  const label = isTravelCircle
    ? "Shared With Travel Circle"
    : isClient
      ? "Visible to Lead Client"
      : "Internal Only";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isTravelCircle ? "#eff6ff" : isClient ? "#ecfdf3" : "#fff7ed",
        color: isTravelCircle ? "#1d4ed8" : isClient ? "#027a48" : "#c2410c",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

async function uploadTripDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const componentId = String(formData.get("component_id") ?? "").trim();
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

  let componentLink: { id: string; component_type: string } | null = null;
  if (componentId) {
    const { data: component, error: componentError } = await supabase
      .from("trip_components")
      .select("id, component_type")
      .eq("id", componentId)
      .eq("trip_id", tripId)
      .single();

    if (componentError || !component) {
      throw new Error("Selected trip component was not found.");
    }

    componentLink = component as { id: string; component_type: string };
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
      component_id: componentLink?.id ?? null,
      component_type: componentLink?.component_type ?? null,
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
  const componentId = String(formData.get("component_id") ?? "").trim();
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

  let componentLink: { id: string; component_type: string } | null = null;
  if (componentId) {
    const { data: component, error: componentError } = await supabase
      .from("trip_components")
      .select("id, component_type")
      .eq("id", componentId)
      .eq("trip_id", tripId)
      .single();

    if (componentError || !component) {
      throw new Error("Selected trip component was not found.");
    }

    componentLink = component as { id: string; component_type: string };
  }

  const { error } = await supabase
    .from("trip_documents")
    .update({
      visibility,
      component_id: componentLink?.id ?? null,
      component_type: componentLink?.component_type ?? null,
    })
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

  const { data: tripComponents, error: componentsError } = await supabase
    .from("trip_components")
    .select("id, component_type, display_name, supplier_name, confirmation_number")
    .eq("trip_id", tripId)
    .order("component_type", { ascending: true });

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

  const internalOnlyCount = documentsWithUrls.filter(
    (doc) => doc.visibility !== "client" && doc.visibility !== "travel_circle",
  ).length;
  const leadClientCount = documentsWithUrls.filter(
    (doc) => doc.visibility === "client",
  ).length;
  const travelCircleCount = documentsWithUrls.filter(
    (doc) => doc.visibility === "travel_circle",
  ).length;

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
          Document Visibility
        </p>

        <h2 style={{ margin: 0 }}>Shared Document Control</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Keep private files internal, share client-facing documents with the lead
          traveler, or make approved trip documents available to the full Travel Circle.
        </p>

        <div className="grid grid-3">
          <div className="card">
            <span className="label">Internal Only</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {internalOnlyCount}
            </p>
          </div>

          <div className="card">
            <span className="label">Lead Client Visible</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {leadClientCount}
            </p>
          </div>

          <div className="card">
            <span className="label">Travel Circle Shared</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {travelCircleCount}
            </p>
          </div>
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
          <strong>Privacy reminder:</strong> Do not share passports, traveler
          numbers, medical documents, or personal client files with the Travel Circle
          unless they are intentionally approved for the full travel party.
        </div>
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

        {componentsError ? (
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
            Could not load trip components for document tagging. You can still upload a general trip document.
          </div>
        ) : null}

        <label className="stack-sm">
          <span className="label">Travel Component</span>
          <select className="select" name="component_id" defaultValue="">
            <option value="">General trip document</option>
            {(tripComponents ?? []).map((component: any) => (
              <option key={component.id} value={component.id}>
                {getComponentSelectLabel(component)}
              </option>
            ))}
          </select>
        </label>

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
            <option value="internal">Agent Only</option>
            <option value="client">Client & Agent</option>
            <option value="travel_circle">Travel Circle & Agent</option>
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
          <br />
          <strong>Visibility:</strong> Use Agent Only for advisor-only files,
          Client & Agent for the primary traveler, and Travel Circle & Agent
          for itineraries, vouchers, confirmations, or travel packets approved for companions.
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
                  <th>Component</th>
                  <th>Visibility</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                  <th>Update Details</th>
                  <th>Delete</th>
                </tr>
              </thead>

              <tbody>
                {documentsWithUrls.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.file_name}</td>
                    <td>{getComponentTypeLabel(doc.component_type)}</td>
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
                          name="component_id"
                          defaultValue={doc.component_id ?? ""}
                        >
                          <option value="">General</option>
                          {(tripComponents ?? []).map((component: any) => (
                            <option key={component.id} value={component.id}>
                              {getComponentSelectLabel(component)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="select"
                          name="visibility"
                          defaultValue={doc.visibility}
                        >
                          <option value="internal">Agent Only</option>
                          <option value="client">Client & Agent</option>
                          <option value="travel_circle">Travel Circle & Agent</option>
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
