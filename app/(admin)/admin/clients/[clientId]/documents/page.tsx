import Link from "next/link";
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

export default async function AdminClientDocumentsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
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