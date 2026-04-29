import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientSummary = {
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
  client_accounts: ClientSummary | ClientSummary[] | null;
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

function getClientFromRelation(
  clientRelation: ClientDocumentRow["client_accounts"],
): ClientSummary | null {
  if (!clientRelation) return null;

  if (Array.isArray(clientRelation)) {
    return clientRelation[0] ?? null;
  }

  return clientRelation;
}

function getClientName(client: ClientSummary | null) {
  if (!client) return "Unknown Client";

  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed Client";
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

function ActionButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 14px",
        borderRadius: 10,
        background: isPrimary ? "var(--accent-dark)" : "white",
        color: isPrimary ? "white" : "var(--accent-dark)",
        border: isPrimary ? "none" : "1px solid var(--accent-dark)",
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

export default async function AdminClientDocumentsIndexPage() {
  const { supabase } = await requireAdmin();

  const { data: documents, error: documentsError } = await supabase
    .from("client_documents")
    .select(
      `
      id,
      client_account_id,
      document_type,
      document_title,
      file_name,
      storage_path,
      content_type,
      notes,
      created_at,
      client_accounts (
        id,
        first_name,
        last_name,
        email
      )
      `,
    )
    .order("created_at", { ascending: false });

  const documentRows = (documents ?? []) as ClientDocumentRow[];

  const passportDocuments = documentRows.filter(
    (document) => document.document_type === "passport",
  );

  const minorTravelDocuments = documentRows.filter(
    (document) =>
      document.document_type === "minor_permission" ||
      document.document_type === "minor_international_consent",
  );

  const sensitiveDocuments = documentRows.filter(
    (document) =>
      document.document_type === "passport" ||
      document.document_type === "medical" ||
      document.document_type === "minor_permission" ||
      document.document_type === "minor_international_consent",
  );

  return (
    <PageShell
      title="Client Documents"
      subtitle="Review client-uploaded passport files, consent forms, permission slips, and supporting travel documents."
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
        <ActionButton href="/admin/dashboard" variant="secondary">
          Back to Dashboard
        </ActionButton>

        <ActionButton href="/admin/clients" variant="secondary">
          View Clients
        </ActionButton>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {documentRows.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Passport Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {passportDocuments.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Minor Travel Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {minorTravelDocuments.length}
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
        <h2 style={{ margin: 0 }}>Sensitive Document Reminder</h2>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Some uploaded files may contain sensitive personal, identity, legal, medical,
          or minor travel information. Only open documents when needed for legitimate
          trip support, supplier documentation, or travel planning. Temporary links
          expire after 5 minutes.
        </p>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Sensitive documents currently shown: <strong>{sensitiveDocuments.length}</strong>
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>All Client Documents</h2>

        {documentsError ? (
          <div>
            <p>
              <strong>Error loading client documents:</strong>
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
              No client-uploaded documents found yet.
            </p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Notes</th>
                  <th>Client Page</th>
                  <th>Open</th>
                </tr>
              </thead>

              <tbody>
                {documentRows.map((document) => {
                  const client = getClientFromRelation(document.client_accounts);
                  const clientName = getClientName(client);

                  return (
                    <tr key={document.id}>
                      <td>
                        <DocumentTypeBadge type={document.document_type} />
                      </td>

                      <td>{clientName}</td>

                      <td>{client?.email ?? "Not provided"}</td>

                      <td>{document.document_title}</td>

                      <td>{document.file_name}</td>

                      <td>{formatDateTime(document.created_at)}</td>

                      <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                        {document.notes ?? "Not provided"}
                      </td>

                      <td>
                        <Link
                          href={`/admin/clients/${document.client_account_id}/documents`}
                          style={{
                            color: "var(--accent-dark)",
                            fontWeight: 700,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Client Docs
                        </Link>
                      </td>

                      <td>
                        <a
                          href={`/api/admin/client-documents/${document.id}/open`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline"
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}