import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getMailingLines,
  hasCompleteMailingAddress,
  mailingClientSelect,
  sortMailingClients,
  type MailingClient,
} from "@/lib/mailing/clients";
import { PrintButton } from "./print-button";

export default async function ClientLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const selectedClientId = String(clientId ?? "").trim();
  const { supabase } = await requireAdmin();

  let query = supabase.from("client_accounts").select(mailingClientSelect);

  if (selectedClientId) {
    query = query.eq("id", selectedClientId);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <PageShell title="Mailing Labels" subtitle="Print client address labels.">
        <div className="card">
          <p><strong>Error loading clients:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const allRows = sortMailingClients((data ?? []) as MailingClient[]);
  const mailableRows = allRows.filter(hasCompleteMailingAddress);
  const skippedCount = allRows.length - mailableRows.length;
  const title = selectedClientId ? "Client Mailing Label" : "Client Mailing Labels";

  return (
    <PageShell title={title} subtitle="Formatted for Avery 5160-style 30-up address label sheets.">
      <div className="card stack label-toolbar">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <p style={{ margin: 0, color: "#64748b" }}>
            Ready to print {mailableRows.length} label{mailableRows.length === 1 ? "" : "s"}.
            {skippedCount > 0 ? ` Skipping ${skippedCount} client${skippedCount === 1 ? "" : "s"} without a complete mailing address.` : ""}
          </p>
          <div className="row">
            <PrintButton />
            <Link href="/admin/clients" className="btn btn-outline">Back to Clients</Link>
            <Link href="/api/admin/clients/mailing-export" className="btn btn-outline">Export Mailing CSV</Link>
          </div>
        </div>
      </div>

      {mailableRows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b" }}>No complete mailing addresses were found for this selection.</p>
        </div>
      ) : (
        <section className="label-sheet" aria-label="Printable mailing labels">
          {mailableRows.map((client) => (
            <div key={client.id} className="mailing-label">
              {getMailingLines(client).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ))}
        </section>
      )}
    </PageShell>
  );
}

