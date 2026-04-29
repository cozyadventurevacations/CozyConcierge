import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TripRow = {
  id: string;
  trip_name: string | null;
  client_account_id: string;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ClientDocumentRow = {
  id: string;
  client_account_id: string;
  document_type: string;
  document_title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  notes: string | null;
  created_at: string | null;
};

type LinkedDocumentRow = {
  id: string;
  trip_id: string;
  client_document_id: string;
  visibility: string;
  display_title: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
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

function getClientName(client: ClientRow | null) {
  if (!client) return "Unknown Client";

  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed Client";
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
  const isMinor =
    type === "minor_permission" || type === "minor_international_consent";
  const isMedical = type === "medical";
  const isInsurance = type === "insurance";

  let background = "#f0f7f8";
  let color = "var(--accent-dark)";

  if (isPassport) {
    background = "#fff7ed";
    color = "#c2410c";
  } else if (isMinor) {
    background = "#eff6ff";
    color = "#1d4ed8";
  } else if (isMedical) {
    background = "#fef2f2";
    color = "#b42318";
  } else if (isInsurance) {
    background = "#ecfdf3";
    color = "#027a48";
  }

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
      {getDocumentTypeLabel(type)}
    </span>
  );
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
      {isClient ? "Visible to Client" : "Admin Only"}
    </span>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid #eef2f5",
        borderRadius: 12,
        background: "#fbfdfe",
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "6px 0 0", lineHeight: 1.45, overflowWrap: "anywhere" }}>
        {value === null || value === undefined || value === "" ? "Not provided" : value}
      </p>
    </div>
  );
}

async function attachClientDocumentToTrip(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const clientDocumentId = String(formData.get("client_document_id") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "client").trim();
  const displayTitle = cleanText(formData, "display_title");
  const notes = cleanText(formData, "notes");

  if (!tripId) throw new Error("Missing trip ID.");
  if (!clientDocumentId) throw new Error("Missing client document ID.");

  if (!["client", "admin"].includes(visibility)) {
    throw new Error("Invalid visibility.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Trip not found.");
  }

  const { data: document, error: documentError } = await supabase
    .from("client_documents")
    .select("id, client_account_id, document_title")
    .eq("id", clientDocumentId)
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? "Client document not found.");
  }

  if (document.client_account_id !== trip.client_account_id) {
    throw new Error("This document does not belong to this trip's client.");
  }

  const { error } = await supabase.from("trip_client_documents").upsert(
    {
      trip_id: tripId,
      client_document_id: clientDocumentId,
      visibility,
      display_title: displayTitle || document.document_title,
      notes,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "trip_id,client_document_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/trips/${tripId}/client-documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function updateLinkedClientDocument(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const linkedDocumentId = String(formData.get("linked_document_id") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "client").trim();
  const displayTitle = cleanText(formData, "display_title");
  const notes = cleanText(formData, "notes");

  if (!tripId) throw new Error("Missing trip ID.");
  if (!linkedDocumentId) throw new Error("Missing linked document ID.");

  if (!["client", "admin"].includes(visibility)) {
    throw new Error("Invalid visibility.");
  }

  const { error } = await supabase
    .from("trip_client_documents")
    .update({
      visibility,
      display_title: displayTitle,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkedDocumentId)
    .eq("trip_id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/trips/${tripId}/client-documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function removeLinkedClientDocument(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const linkedDocumentId = String(formData.get("linked_document_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!linkedDocumentId) throw new Error("Missing linked document ID.");

  const { error } = await supabase
    .from("trip_client_documents")
    .delete()
    .eq("id", linkedDocumentId)
    .eq("trip_id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/trips/${tripId}/client-documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

export default async function AdminTripClientDocumentsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { supabase } = await requireAdmin();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_name, client_account_id, destinations, departure_date, return_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Client Documents" subtitle="We could not load this trip.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(tripError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripRow = trip as TripRow;

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("id", tripRow.client_account_id)
    .single();

  if (clientError || !client) {
    return (
      <PageShell title="Trip Client Documents" subtitle="We could not load this client.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(clientError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientRow = client as ClientRow;
  const clientName = getClientName(clientRow);

  const { data: clientDocuments, error: clientDocumentsError } = await supabase
    .from("client_documents")
    .select(
      "id, client_account_id, document_type, document_title, file_name, storage_path, content_type, notes, created_at",
    )
    .eq("client_account_id", clientRow.id)
    .order("created_at", { ascending: false });

  const { data: linkedDocuments, error: linkedDocumentsError } = await supabase
    .from("trip_client_documents")
    .select("id, trip_id, client_document_id, visibility, display_title, notes, created_at, updated_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const clientDocumentRows = (clientDocuments ?? []) as ClientDocumentRow[];
  const linkedDocumentRows = (linkedDocuments ?? []) as LinkedDocumentRow[];

  const linkedDocumentIds = new Set(
    linkedDocumentRows.map((linkedDocument) => linkedDocument.client_document_id),
  );

  const availableDocuments = clientDocumentRows.filter(
    (document) => !linkedDocumentIds.has(document.id),
  );

  const linkedDocumentsWithDetails = linkedDocumentRows.map((linkedDocument) => {
    const document = clientDocumentRows.find(
      (clientDocument) => clientDocument.id === linkedDocument.client_document_id,
    );

    return {
      ...linkedDocument,
      document,
    };
  });

  const attachedVisibleCount = linkedDocumentRows.filter(
    (document) => document.visibility === "client",
  ).length;

  const attachedAdminOnlyCount = linkedDocumentRows.filter(
    (document) => document.visibility === "admin",
  ).length;

  return (
    <PageShell
      title="Attach Client Documents"
      subtitle={`Choose which uploaded client documents apply to ${tripRow.trip_name ?? "this trip"}.`}
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
        <Link href={`/admin/trips/${tripId}`} className="btn btn-outline">
          Back to Trip
        </Link>

        <Link href={`/admin/clients/${clientRow.id}/documents`} className="btn btn-outline">
          Client Documents
        </Link>

        <Link href={`/trips/${tripId}`} className="btn btn-outline">
          View Client Trip Page
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
          Trip Document Assignment
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          {tripRow.trip_name ?? "Trip"}
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Client: <strong>{clientName}</strong>
          {clientRow.email ? ` — ${clientRow.email}` : ""}
        </p>

        <div className="grid grid-3">
          <InfoCard label="Destination" value={tripRow.destinations} />
          <InfoCard label="Departure" value={formatDate(tripRow.departure_date)} />
          <InfoCard label="Return" value={formatDate(tripRow.return_date)} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Client Uploads</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {clientDocumentRows.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Visible on Trip</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {attachedVisibleCount}
          </p>
        </div>

        <div className="card">
          <span className="label">Admin Only</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {attachedAdminOnlyCount}
          </p>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
        }}
      >
        <h2 style={{ margin: 0 }}>How to Use This</h2>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Attach only the documents that matter for this specific trip. A passport may
          be needed for an international trip, but not for a domestic trip. Minor
          consent forms, insurance documents, medical notes, and accessibility
          documents should only be attached when they are relevant.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Attached to This Trip</h2>

        {linkedDocumentsError ? (
          <div>
            <p>
              <strong>Error loading attached documents:</strong>
            </p>
            <pre>{JSON.stringify(linkedDocumentsError, null, 2)}</pre>
          </div>
        ) : linkedDocumentsWithDetails.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              No client-uploaded documents are attached to this trip yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {linkedDocumentsWithDetails.map((linkedDocument) => {
              const document = linkedDocument.document;

              return (
                <div
                  key={linkedDocument.id}
                  className="card stack"
                  style={{ background: "#fbfdfe" }}
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
                      <DocumentTypeBadge type={document?.document_type} />

                      <h3 style={{ margin: "8px 0 0" }}>
                        {linkedDocument.display_title ||
                          document?.document_title ||
                          "Client Document"}
                      </h3>

                      <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
                        {document?.file_name ?? "Source document not found"}
                      </p>

                      <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
                        Uploaded: {formatDateTime(document?.created_at)}
                      </p>
                    </div>

                    <VisibilityBadge visibility={linkedDocument.visibility} />
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    {document?.id ? (
                      <a
                        href={`/api/admin/client-documents/${document.id}/open`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline"
                      >
                        Open Secure Link
                      </a>
                    ) : null}
                  </div>

                  <form action={updateLinkedClientDocument} className="stack">
                    <input type="hidden" name="trip_id" value={tripId} />
                    <input
                      type="hidden"
                      name="linked_document_id"
                      value={linkedDocument.id}
                    />

                    <div className="grid grid-2">
                      <label className="stack-sm">
                        <span className="label">Display Title</span>
                        <input
                          className="input"
                          name="display_title"
                          defaultValue={
                            linkedDocument.display_title ??
                            document?.document_title ??
                            ""
                          }
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Visibility</span>
                        <select
                          className="select"
                          name="visibility"
                          defaultValue={linkedDocument.visibility}
                        >
                          <option value="client">Visible to Client on Trip Page</option>
                          <option value="admin">Admin Only</option>
                        </select>
                      </label>
                    </div>

                    <label className="stack-sm">
                      <span className="label">Trip-Specific Notes</span>
                      <textarea
                        className="textarea"
                        name="notes"
                        rows={3}
                        defaultValue={linkedDocument.notes ?? ""}
                        placeholder="Example: Passport needed for international entry."
                      />
                    </label>

                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <button type="submit" className="btn btn-primary">
                        Update Assignment
                      </button>
                    </div>
                  </form>

                  <form action={removeLinkedClientDocument}>
                    <input type="hidden" name="trip_id" value={tripId} />
                    <input
                      type="hidden"
                      name="linked_document_id"
                      value={linkedDocument.id}
                    />

                    <button type="submit" className="btn btn-outline">
                      Remove from This Trip
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Available Client Uploads</h2>

        {clientDocumentsError ? (
          <div>
            <p>
              <strong>Error loading client documents:</strong>
            </p>
            <pre>{JSON.stringify(clientDocumentsError, null, 2)}</pre>
          </div>
        ) : availableDocuments.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              No unattached client documents are available for this trip.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {availableDocuments.map((document) => (
              <form
                key={document.id}
                action={attachClientDocumentToTrip}
                className="card stack"
                style={{ background: "#fbfdfe" }}
              >
                <input type="hidden" name="trip_id" value={tripId} />
                <input type="hidden" name="client_document_id" value={document.id} />

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
                    <DocumentTypeBadge type={document.document_type} />

                    <h3 style={{ margin: "8px 0 0" }}>{document.document_title}</h3>

                    <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
                      {document.file_name}
                    </p>

                    <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
                      Uploaded: {formatDateTime(document.created_at)}
                    </p>
                  </div>

                  <a
                    href={`/api/admin/client-documents/${document.id}/open`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                  >
                    Open Secure Link
                  </a>
                </div>

                <div className="grid grid-2">
                  <label className="stack-sm">
                    <span className="label">Display Title</span>
                    <input
                      className="input"
                      name="display_title"
                      defaultValue={document.document_title}
                    />
                  </label>

                  <label className="stack-sm">
                    <span className="label">Visibility</span>
                    <select className="select" name="visibility" defaultValue="client">
                      <option value="client">Visible to Client on Trip Page</option>
                      <option value="admin">Admin Only</option>
                    </select>
                  </label>
                </div>

                <label className="stack-sm">
                  <span className="label">Trip-Specific Notes</span>
                  <textarea
                    className="textarea"
                    name="notes"
                    rows={3}
                    placeholder="Example: Passport needed for international trip."
                  />
                </label>

                <button type="submit" className="btn btn-primary">
                  Attach to This Trip
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}