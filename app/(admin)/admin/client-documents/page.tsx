import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function getDocumentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "passport": return "Passport";
    case "minor_permission": return "Minor Permission";
    case "minor_international_consent": return "Minor International Consent";
    case "medical": return "Medical";
    case "insurance": return "Insurance";
    case "accessibility": return "Accessibility";
    case "supplier_required": return "Supplier Required";
    case "general": return "General";
    default: return type ?? "Unknown";
  }
}

function getClientFromRelation(clientRelation: ClientDocumentRow["client_accounts"]): ClientSummary | null {
  if (!clientRelation) return null;
  if (Array.isArray(clientRelation)) return clientRelation[0] ?? null;
  return clientRelation;
}

function getClientName(client: ClientSummary | null) {
  if (!client) return "—";
  const display = client.preferred_name ?? client.first_name;
  return `${display ?? ""} ${client.last_name ?? ""}`.trim() || "—";
}

function DocumentTypeBadge({ type }: { type: string | null | undefined }) {
  const isPassport = type === "passport";
  const isMinor = type === "minor_permission" || type === "minor_international_consent";
  const isMedical = type === "medical";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
      background: isPassport ? "#fff7ed" : isMinor ? "#eff6ff" : isMedical ? "#fff1f2" : "#f0f7f8",
      color: isPassport ? "#c2410c" : isMinor ? "#1d4ed8" : isMedical ? "#be123c" : "var(--accent-dark)",
    }}>
      {getDocumentTypeLabel(type)}
    </span>
  );
}

export default async function AdminClientDocumentsIndexPage() {
  const { supabase } = await requireAdmin();

  const { data: documents, error: documentsError } = await supabase
    .from("client_documents")
    .select(`
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
        preferred_name,
        email
      )
    `)
    .order("created_at", { ascending: false });

  const documentRows = (documents ?? []) as ClientDocumentRow[];

  const passportCount = documentRows.filter((d) => d.document_type === "passport").length;
  const minorCount = documentRows.filter((d) =>
    d.document_type === "minor_permission" || d.document_type === "minor_international_consent"
  ).length;
  const sensitiveCount = documentRows.filter((d) =>
    ["passport", "medical", "minor_permission", "minor_international_consent"].includes(d.document_type)
  ).length;

  return (
    <PageShell
      title="Client Documents"
      subtitle="Review client-uploaded passport files, consent forms, permission slips, and supporting travel documents."
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/admin/dashboard" className="btn btn-primary">Back to Dashboard</Link>
        <Link href="/admin/clients" className="btn btn-primary">View Clients</Link>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{documentRows.length}</p>
        </div>
        <div className="card">
          <span className="label">Passport Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{passportCount}</p>
        </div>
        <div className="card">
          <span className="label">Minor Travel Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{minorCount}</p>
        </div>
      </div>

      <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed" }}>
        <h2 style={{ margin: 0 }}>Sensitive Document Reminder</h2>
        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Some files may contain sensitive personal, identity, legal, or medical information.
          Only open documents when needed for legitimate trip support. Secure links expire after 5 minutes.
        </p>
        <p style={{ margin: 0, color: "#9a3412" }}>
          Sensitive documents shown: <strong>{sensitiveCount}</strong>
        </p>
      </div>

      <div className="card stack">
        {documentsError ? (
          <div>
            <p><strong>Error loading client documents:</strong></p>
            <pre>{JSON.stringify(documentsError, null, 2)}</pre>
          </div>
        ) : documentRows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No client-uploaded documents found yet.</p>
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
                  <th>Client Docs</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((document) => {
                  const client = getClientFromRelation(document.client_accounts);
                  const clientName = getClientName(client);

                  return (
                    <tr key={document.id}>
                      <td><DocumentTypeBadge type={document.document_type} /></td>
                      <td>{clientName}</td>
                      <td>{client?.email ?? "—"}</td>
                      <td>{document.document_title}</td>
                      <td>{document.file_name}</td>
                      <td>{formatDateTime(document.created_at)}</td>
                      <td style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>
                        {document.notes ?? "—"}
                      </td>
                      <td>
                        <Link
                          href={`/admin/clients/${document.client_account_id}/documents`}
                          className="btn btn-primary"
                          style={{ fontSize: 13, padding: "5px 12px", whiteSpace: "nowrap" }}
                        >
                          Client Docs
                        </Link>
                      </td>
                      <td>
                        <a
                          href={`/api/admin/client-documents/${document.id}/open`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ fontSize: 13, padding: "5px 12px", whiteSpace: "nowrap" }}
                        >
                          Open File
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