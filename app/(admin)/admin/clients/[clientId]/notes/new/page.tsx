import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function getClientDisplayName(client: ClientOption) {
  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();

  return name || client.email || "Unnamed Client";
}

async function createClientNote(clientId: string, formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const noteType = cleanText(formData, "note_type") ?? "general";
  const title = cleanText(formData, "title");
  const content = cleanText(formData, "content");
  const followUpDate = cleanText(formData, "follow_up_date");

  if (!title && !content) {
    throw new Error("Please enter a note title or note content.");
  }

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "Client not found.");
  }

  const { error } = await supabase.from("client_notes").insert({
    client_account_id: clientId,
    note_type: noteType,
    title,
    content,
    follow_up_date: followUpDate,
    is_completed: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/admin/clients/${clientId}`);
}

export default async function NewClientNotePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase } = await requireAdmin();

  const { data: client, error } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return (
      <PageShell
        title="Add Client Note"
        subtitle="We could not load this client."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientRow = client as ClientOption;
  const clientName = getClientDisplayName(clientRow);
  const saveClientNote = createClientNote.bind(null, clientId);

  return (
    <PageShell
      title="Add Client Note"
      subtitle={`Create a CRM note or follow-up for ${clientName}.`}
    >
      <form action={saveClientNote} className="card stack" style={{ maxWidth: 900 }}>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Note Details</h2>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Note Type</span>
              <select name="note_type" defaultValue="general" className="select">
                <option value="general">General Note</option>
                <option value="follow_up">Follow Up</option>
                <option value="preference">Client Preference</option>
                <option value="passport">Passport / Documents</option>
                <option value="payment">Payment</option>
                <option value="insurance">Insurance</option>
                <option value="accessibility">Accessibility / Mobility</option>
                <option value="supplier">Supplier / Booking</option>
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">Follow-Up Date</span>
              <input
                name="follow_up_date"
                type="date"
                className="input"
              />
            </label>

            <label className="stack-sm" style={{ gridColumn: "1 / -1" }}>
              <span className="label">Title</span>
              <input
                name="title"
                type="text"
                className="input"
                placeholder="Example: Follow up about passport expiration"
              />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Note</span>
            <textarea
              name="content"
              rows={8}
              className="textarea"
              placeholder="Example: Client prefers balcony cabins, needs accessible transfers, and wants Allianz quoted on all international trips."
            />
          </label>
        </section>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Use this for follow-ups, client preferences, document reminders, payment notes,
          supplier updates, and anything you want attached to this client’s CRM record.
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            Save Client Note
          </button>

          <a href={`/admin/clients/${clientId}`} className="btn btn-outline">
            Cancel
          </a>
        </div>
      </form>
    </PageShell>
  );
}