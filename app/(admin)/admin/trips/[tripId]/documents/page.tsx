import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI, { toFile } from "openai";
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

const tripComponentTypes = Object.keys(tripComponentTypeLabels);

function getComponentTypeLabel(componentType: string | null | undefined) {
  if (!componentType) return "General Trip Document";
  return tripComponentTypeLabels[componentType] ?? componentType;
}

function validateComponentType(value: string) {
  if (!tripComponentTypes.includes(value)) {
    throw new Error("Invalid travel component type.");
  }

  return value;
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

function ExtractionStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const normalized = status ?? "not_started";
  const styles =
    normalized === "extracted"
      ? { background: "#ecfdf3", color: "#027a48", label: "Extracted" }
      : normalized === "failed"
        ? { background: "#fef2f2", color: "#b42318", label: "Needs Review" }
        : normalized === "processing"
          ? { background: "#eff6ff", color: "#1d4ed8", label: "Processing" }
          : { background: "#f8fafc", color: "#475467", label: "Not Extracted" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: styles.background,
        color: styles.color,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {styles.label}
    </span>
  );
}

async function uploadTripDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const componentId = String(formData.get("component_id") ?? "").trim();
  const newComponentType = String(formData.get("new_component_type") ?? "").trim();
  const visibility = validateVisibility(
    String(formData.get("visibility") ?? "internal").trim(),
  );
  const attachToCommission = formData.get("attach_to_commission") === "on";
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
  } else if (newComponentType) {
    const componentType = validateComponentType(newComponentType);
    const { data: existingComponent, error: existingComponentError } =
      await supabase
        .from("trip_components")
        .select("id, component_type")
        .eq("trip_id", tripId)
        .eq("component_type", componentType)
        .maybeSingle();

    if (existingComponentError) {
      throw new Error(existingComponentError.message);
    }

    if (existingComponent) {
      componentLink = existingComponent as { id: string; component_type: string };
    } else {
      const componentLabel = getComponentTypeLabel(componentType);
      const { data: insertedComponent, error: insertComponentError } =
        await supabase
          .from("trip_components")
          .insert({
            trip_id: tripId,
            component_type: componentType,
            display_name: `${componentLabel} from uploaded document`,
            booking_status: "quoted",
            commission_admin_only: 0,
          })
          .select("id, component_type")
          .single();

      if (insertComponentError || !insertedComponent) {
        throw new Error(
          insertComponentError?.message ?? `Failed to create ${componentLabel} component.`,
        );
      }

      componentLink = insertedComponent as { id: string; component_type: string };
    }
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
      attach_to_commission: Boolean(componentLink && attachToCommission),
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
  const attachToCommission = formData.get("attach_to_commission") === "on";

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
      attach_to_commission: Boolean(componentLink && attachToCommission),
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

async function extractBookingDetails(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!documentId) throw new Error("Missing document ID.");

  const { data: document, error: docError } = await supabase
    .from("trip_documents")
    .select("id, trip_id, file_name, storage_path, mime_type, component_id, component_type")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .single();

  if (docError || !document) {
    throw new Error(docError?.message ?? "Document not found.");
  }

  if (!document.component_id || !document.component_type) {
    throw new Error("Attach this document to a travel component before extracting booking details.");
  }

  const mimeType = String(document.mime_type ?? "");
  const canExtract =
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/");

  if (!canExtract) {
    throw new Error("Booking extraction currently supports PDF and image documents.");
  }

  await supabase
    .from("trip_documents")
    .update({
      booking_extraction_status: "processing",
      booking_extraction_summary: null,
      booking_extraction_json: null,
      booking_extracted_at: null,
    })
    .eq("id", documentId)
    .eq("trip_id", tripId);

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("trip-documents")
    .download(document.storage_path);

  if (downloadError || !fileBlob) {
    await supabase
      .from("trip_documents")
      .update({
        booking_extraction_status: "failed",
        booking_extraction_summary: downloadError?.message ?? "Could not download document.",
      })
      .eq("id", documentId)
      .eq("trip_id", tripId);

    throw new Error(downloadError?.message ?? "Could not download document.");
  }

  try {
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const extracted = await extractBookingDetailsFromDocument({
      fileName: document.file_name,
      mimeType: mimeType || null,
      bytes,
    });

    const summary = formatExtractedSummary(extracted);
    await applyExtractedBookingDetailsToComponent(supabase, document, extracted);

    const { error: updateError } = await supabase
      .from("trip_documents")
      .update({
        booking_extraction_status: "extracted",
        booking_extraction_json: extracted,
        booking_extraction_summary: summary,
        booking_extracted_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("trip_id", tripId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } catch (error) {
    await supabase
      .from("trip_documents")
      .update({
        booking_extraction_status: "failed",
        booking_extraction_summary:
          error instanceof Error ? error.message : "Booking extraction failed.",
      })
      .eq("id", documentId)
      .eq("trip_id", tripId);

    throw error;
  }

  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  redirect(`/admin/trips/${tripId}/documents?extracted=1`);
}

export default async function AdminTripDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ extracted?: string; uploaded?: string }>;
}) {
  const { tripId } = await params;
  const { extracted, uploaded } = await searchParams;
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
          <span className="label">Or Create Component From Upload</span>
          <select className="select" name="new_component_type" defaultValue="">
            <option value="">Do not create a component</option>
            {tripComponentTypes.map((componentType) => (
              <option key={componentType} value={componentType}>
                {getComponentTypeLabel(componentType)}
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

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px",
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <input type="checkbox" name="attach_to_commission" />
          <span style={{ fontWeight: 800 }}>
            Attach to matching commission
          </span>
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
          <strong>Extraction:</strong> Select an existing component or choose a component type above, then upload a PDF or image and use Extract Booking Details below.
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

      {extracted ? (
        <div
          className="card"
          style={{
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            color: "#027a48",
            fontWeight: 800,
          }}
        >
          Booking details were extracted and saved for review.
        </div>
      ) : null}

      {uploaded ? (
        <div
          className="card"
          style={{
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            color: "#027a48",
            fontWeight: 800,
          }}
        >
          Document uploaded. If it is a PDF or image attached to a component, use Extract Booking Details below to fill the component details.
        </div>
      ) : null}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Documents</h2>

        {docsError ? (
          <pre>{JSON.stringify(docsError, null, 2)}</pre>
        ) : documentsWithUrls.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>No documents uploaded yet.</p>
        ) : (
          <div className="stack">
            {documentsWithUrls.map((doc) => {
              const canExtract =
                Boolean(doc.component_id) &&
                (doc.mime_type === "application/pdf" ||
                  String(doc.mime_type ?? "").startsWith("image/"));

              return (
                <div
                  key={doc.id}
                  className="card stack"
                  style={{
                    borderRadius: 14,
                    background: "#ffffff",
                    border: "1px solid #e6f0f2",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="stack-sm" style={{ minWidth: 0, flex: "1 1 260px" }}>
                      <h3 style={{ margin: 0, overflowWrap: "anywhere" }}>
                        {doc.file_name}
                      </h3>
                      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>
                        {getComponentTypeLabel(doc.component_type)} | {formatFileSize(doc.file_size_bytes)} | Uploaded {formatDateTime(doc.created_at)}
                      </p>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <VisibilityBadge visibility={doc.visibility} />
                      <ExtractionStatusBadge status={doc.booking_extraction_status} />
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge">
                      Commission: {doc.attach_to_commission ? "Attached" : "No"}
                    </span>
                    <span className="badge" style={{ background: "#f8fafc", color: "#475467" }}>
                      {doc.mime_type ?? "unknown type"}
                    </span>
                  </div>

                  {doc.booking_extraction_summary ? (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: 12,
                        background:
                          doc.booking_extraction_status === "failed"
                            ? "#fef2f2"
                            : "#f7fbfc",
                        border:
                          doc.booking_extraction_status === "failed"
                            ? "1px solid #fecaca"
                            : "1px solid #e6f0f2",
                        color:
                          doc.booking_extraction_status === "failed"
                            ? "#b42318"
                            : "#123f5b",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Extracted details:</strong> {doc.booking_extraction_summary}
                    </div>
                  ) : null}

                  {doc.booking_extraction_json ? (
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                        View extracted fields
                      </summary>
                      <pre
                        style={{
                          margin: "10px 0 0",
                          padding: 12,
                          borderRadius: 12,
                          background: "#0f172a",
                          color: "#e2e8f0",
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(doc.booking_extraction_json, null, 2)}
                      </pre>
                    </details>
                  ) : null}

                  <div
                    className="grid grid-2"
                    style={{
                      alignItems: "start",
                    }}
                  >
                    <form action={updateDocumentVisibility} className="stack-sm">
                      <input type="hidden" name="trip_id" value={trip.id} />
                      <input type="hidden" name="document_id" value={doc.id} />

                      <div className="grid grid-2">
                        <label className="stack-sm">
                          <span className="label">Component</span>
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
                        </label>

                        <label className="stack-sm">
                          <span className="label">Visibility</span>
                          <select
                            className="select"
                            name="visibility"
                            defaultValue={doc.visibility}
                          >
                            <option value="internal">Agent Only</option>
                            <option value="client">Client & Agent</option>
                            <option value="travel_circle">Travel Circle & Agent</option>
                          </select>
                        </label>
                      </div>

                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800 }}>
                        <input
                          type="checkbox"
                          name="attach_to_commission"
                          defaultChecked={Boolean(doc.attach_to_commission)}
                        />
                        Attach to matching commission
                      </label>

                      <button type="submit" className="btn btn-primary">
                        Save Document Settings
                      </button>
                    </form>

                    <div className="stack-sm">
                      <div className="row" style={{ gap: 8 }}>
                        {doc.signedUrl ? (
                          <a
                            href={doc.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline"
                          >
                            Open Document
                          </a>
                        ) : null}

                        {canExtract ? (
                          <form action={extractBookingDetails}>
                            <input type="hidden" name="trip_id" value={trip.id} />
                            <input type="hidden" name="document_id" value={doc.id} />
                            <button type="submit" className="btn btn-secondary">
                              Extract Booking Details
                            </button>
                          </form>
                        ) : (
                          <span style={{ color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                            Attach a PDF or image to a component to extract booking details.
                          </span>
                        )}
                      </div>

                      <form action={deleteTripDocument}>
                        <input type="hidden" name="trip_id" value={trip.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <button type="submit" className="btn btn-outline">
                          Delete Document
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("The booking extractor did not return any details.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("The booking extractor returned an unreadable response.");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function formatExtractedSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  const parts = [
    payload.supplier_name ? `Supplier: ${String(payload.supplier_name)}` : null,
    payload.confirmation_number
      ? `Confirmation: ${String(payload.confirmation_number)}`
      : null,
    payload.start_date || payload.end_date
      ? `Dates: ${String(payload.start_date ?? "unknown")} to ${String(payload.end_date ?? "unknown")}`
      : null,
    payload.total_amount ? `Total: ${String(payload.total_amount)}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "Booking details extracted for review.";
}

function cleanExtractedText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function cleanExtractedArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanExtractedText(item))
    .filter(Boolean) as string[];
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function parseExtractedAmount(value: unknown) {
  const text = cleanExtractedText(value);
  if (!text) return null;

  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function combineDateAndTime(date: string | null, time: string | null) {
  if (!date) return null;
  return time ? `${date} ${time}` : date;
}

async function upsertComponentDetail(
  supabase: any,
  tableName: string,
  componentId: string,
  payload: Record<string, unknown>,
) {
  const compacted = compactPayload(payload);
  if (Object.keys(compacted).length === 0) return;

  const { data: existingDetail, error: existingDetailError } = await supabase
    .from(tableName)
    .select("component_id")
    .eq("component_id", componentId)
    .maybeSingle();

  if (existingDetailError) throw new Error(existingDetailError.message);

  if (existingDetail) {
    const { error } = await supabase
      .from(tableName)
      .update(compacted)
      .eq("component_id", componentId);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from(tableName)
    .insert({ component_id: componentId, ...compacted });

  if (error) throw new Error(error.message);
}

async function applyExtractedBookingDetailsToComponent(
  supabase: any,
  document: {
    component_id: string | null;
    component_type: string | null;
  },
  payload: any,
) {
  if (!document.component_id || !document.component_type) return;

  const componentType = document.component_type;
  const supplierName = cleanExtractedText(payload.supplier_name);
  const confirmationNumber = cleanExtractedText(payload.confirmation_number);
  const startDate = cleanExtractedText(payload.start_date);
  const endDate = cleanExtractedText(payload.end_date);
  const startTime = cleanExtractedText(payload.start_time);
  const locationOrRoute = cleanExtractedText(payload.location_or_route);
  const roomOrService = cleanExtractedText(payload.room_or_cabin_or_service);
  const totalAmount = parseExtractedAmount(payload.total_amount);
  const finalPaymentDueDate = cleanExtractedText(payload.final_payment_due_date);
  const cancellationTerms = cleanExtractedText(payload.cancellation_terms);
  const paymentTerms = cleanExtractedText(payload.payment_terms);
  const notes = cleanExtractedArray(payload.important_notes);
  const notesText = notes.join("\n") || null;
  const displayName = roomOrService || supplierName || getComponentTypeLabel(componentType);

  const componentPayload = compactPayload({
    display_name: displayName,
    supplier_name: supplierName,
    booking_status: confirmationNumber ? "reserved" : null,
    confirmation_number: confirmationNumber,
    total_price: totalAmount,
    final_payment_due_date: finalPaymentDueDate,
    terms_and_conditions: paymentTerms,
    cancellation_policy: cancellationTerms,
  });

  if (Object.keys(componentPayload).length > 0) {
    const { error } = await supabase
      .from("trip_components")
      .update(componentPayload)
      .eq("id", document.component_id);

    if (error) throw new Error(error.message);
  }

  if (componentType === "hotel") {
    await upsertComponentDetail(supabase, "hotel_components", document.component_id, {
      hotel_name: supplierName || displayName,
      check_in_date: startDate,
      check_out_date: endDate,
      room_category: roomOrService,
      hotel_description: notesText,
    });
  } else if (componentType === "air") {
    await upsertComponentDetail(supabase, "air_components", document.component_id, {
      flight_type: "round_trip",
      traveler_count: 1,
      airline_locator: confirmationNumber,
      rate_class: roomOrService,
      flight_terms_and_conditions: paymentTerms,
      flight_cancellation_policy: cancellationTerms,
    });
  } else if (componentType === "cruise") {
    await upsertComponentDetail(supabase, "cruise_components", document.component_id, {
      cruise_line: supplierName,
      sailing_date: startDate,
      return_date: endDate,
      cabin_category: roomOrService,
      departure_port: locationOrRoute,
      cruise_description: notesText,
    });
  } else if (componentType === "transfer") {
    await upsertComponentDetail(supabase, "transfer_components", document.component_id, {
      supplier_name: supplierName,
      pickup_datetime: combineDateAndTime(startDate, startTime),
      pickup_location: locationOrRoute,
      vehicle_type: roomOrService,
      transfer_notes: notesText,
    });
  } else if (componentType === "activity") {
    await upsertComponentDetail(supabase, "activity_components", document.component_id, {
      activity_name: roomOrService || displayName,
      supplier_name: supplierName,
      activity_datetime: combineDateAndTime(startDate, startTime),
      location: locationOrRoute,
      activity_notes: notesText,
    });
  } else if (componentType === "insurance") {
    await upsertComponentDetail(supabase, "insurance_components", document.component_id, {
      provider_name: supplierName,
      plan_name: roomOrService,
      policy_number: confirmationNumber,
      coverage_start_date: startDate,
      coverage_end_date: endDate,
      premium_amount: totalAmount,
      insurance_notes: notesText,
    });
  }
}

async function extractBookingDetailsFromDocument({
  fileName,
  mimeType,
  bytes,
}: {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Booking extraction is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const openAiFile = await toFile(
    bytes,
    fileName,
    { type: mimeType || "application/octet-stream" },
  );

  const uploadedFile = await client.files.create({
    file: openAiFile,
    purpose: "user_data",
  });

  try {
    const fileInput =
      mimeType?.startsWith("image/")
        ? {
            type: "input_image" as const,
            file_id: uploadedFile.id,
            detail: "high" as const,
          }
        : {
            type: "input_file" as const,
            file_id: uploadedFile.id,
            detail: "high" as const,
          };

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            "You extract booking details for a travel agency CRM.",
            "Only use information visible in the uploaded document.",
            "Do not guess, invent, or calculate missing values.",
            "Return only valid JSON. No markdown.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract booking details from this travel document.",
                "Return this JSON shape:",
                "{",
                '  "component_type": "hotel | air | cruise | transfer | activity | insurance | unknown",',
                '  "supplier_name": string | null,',
                '  "confirmation_number": string | null,',
                '  "traveler_names": string[],',
                '  "start_date": "YYYY-MM-DD" | null,',
                '  "end_date": "YYYY-MM-DD" | null,',
                '  "start_time": string | null,',
                '  "end_time": string | null,',
                '  "location_or_route": string | null,',
                '  "room_or_cabin_or_service": string | null,',
                '  "total_amount": string | null,',
                '  "currency": string | null,',
                '  "deposit_amount": string | null,',
                '  "final_payment_due_date": "YYYY-MM-DD" | null,',
                '  "cancellation_terms": string | null,',
                '  "payment_terms": string | null,',
                '  "important_notes": string[],',
                '  "missing_or_unclear_fields": string[]',
                "}",
              ].join("\n"),
            },
            fileInput,
          ],
        },
      ],
      temperature: 0.1,
    });

    return extractJsonObject(response.output_text || "");
  } finally {
    await client.files.delete(uploadedFile.id).catch(() => {});
  }
}
