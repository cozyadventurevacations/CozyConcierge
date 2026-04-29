import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientFollowUpRow = {
  id: string;
  client_account_id: string;
  note_type: string;
  title: string | null;
  content: string | null;
  follow_up_date: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  client_accounts:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function formatDate(value: string | null | undefined, fallback = "") {
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function getClientFromFollowUp(row: ClientFollowUpRow) {
  if (Array.isArray(row.client_accounts)) {
    return row.client_accounts[0] ?? null;
  }

  return row.client_accounts ?? null;
}

function getClientDisplayName(row: ClientFollowUpRow) {
  const client = getClientFromFollowUp(row);

  if (!client) return "Unknown Client";

  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();

  return name || client.email || "Unnamed Client";
}

function isOverdueFollowUp(row: ClientFollowUpRow, todayStr: string) {
  return Boolean(row.follow_up_date) && row.follow_up_date! < todayStr;
}

function isUpcomingFollowUp(row: ClientFollowUpRow, todayStr: string) {
  return Boolean(row.follow_up_date) && row.follow_up_date! >= todayStr;
}

function FollowUpBadge({
  isCompleted,
  isOverdue,
}: {
  isCompleted: boolean | null | undefined;
  isOverdue: boolean;
}) {
  let label = "upcoming";
  let background = "#f0f7f8";
  let color = "var(--accent-dark)";

  if (isCompleted) {
    label = "completed";
    background = "#ecfdf3";
    color = "#027a48";
  } else if (isOverdue) {
    label = "overdue";
    background = "#fff1f2";
    color = "#be123c";
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
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="card" style={{ border: "1px solid #e6f0f2" }}>
      <span className="label">{title}</span>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}

async function updateFollowUpStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const followUpId = String(formData.get("follow_up_id") ?? "").trim();
  const isCompleted = String(formData.get("is_completed") ?? "") === "true";

  if (!followUpId) {
    throw new Error("Missing follow-up ID.");
  }

  const { error } = await supabase
    .from("client_notes")
    .update({
      is_completed: isCompleted,
    })
    .eq("id", followUpId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/follow-ups");
}

export default async function AdminFollowUpsPage() {
  const { supabase } = await requireAdmin();

  const today = startOfToday();
  const todayStr = today.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("client_notes")
    .select(
      "id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, updated_at, client_accounts(id, first_name, last_name, email)",
    )
    .order("is_completed", { ascending: true })
    .order("follow_up_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ClientFollowUpRow[];

  const openRows = rows.filter((row) => !row.is_completed);
  const completedRows = rows.filter((row) => row.is_completed);
  const overdueRows = openRows.filter((row) => isOverdueFollowUp(row, todayStr));
  const upcomingRows = openRows.filter((row) => isUpcomingFollowUp(row, todayStr));
  const noDateRows = openRows.filter((row) => !row.follow_up_date);

  return (
    <PageShell
      title="Client Follow-Ups"
      subtitle="View and manage client notes, reminders, and follow-up tasks."
    >
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
          Follow-Up Center
        </p>

        <h2 style={{ margin: 0 }}>Client Follow-Up Summary</h2>

        <div className="grid grid-3">
          <SummaryCard title="Open Follow-Ups" value={openRows.length} />
          <SummaryCard title="Overdue" value={overdueRows.length} />
          <SummaryCard title="Upcoming" value={upcomingRows.length} />
          <SummaryCard title="No Date" value={noDateRows.length} />
          <SummaryCard title="Completed" value={completedRows.length} />
          <SummaryCard title="Total Notes" value={rows.length} />
        </div>
      </div>

      <div className="card stack">
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>All Client Follow-Ups</h2>

          <Link href="/admin/clients" className="btn btn-primary">
            View Clients
          </Link>
        </div>

        {error ? (
          <div>
            <p>
              <strong>Error loading follow-ups:</strong>
            </p>
            <pre>{JSON.stringify(error, null, 2)}</pre>
          </div>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No client notes found yet. Add a client note from any client profile.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Note</th>
                  <th>Follow-Up Date</th>
                  <th>Created</th>
                  <th>Open Client</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const client = getClientFromFollowUp(row);
                  const overdue = isOverdueFollowUp(row, todayStr);

                  return (
                    <tr key={row.id}>
                      <td>
                        <FollowUpBadge
                          isCompleted={row.is_completed}
                          isOverdue={overdue}
                        />
                      </td>

                      <td>{getClientDisplayName(row)}</td>
                      <td>{row.note_type}</td>
                      <td>{row.title ?? "Not provided"}</td>

                      <td style={{ maxWidth: 380 }}>
                        <span
                          style={{
                            display: "block",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.45,
                          }}
                        >
                          {row.content ?? "Not provided"}
                        </span>
                      </td>

                      <td>{formatDate(row.follow_up_date)}</td>
                      <td>{formatDateTime(row.created_at)}</td>

                      <td>
                        {client?.id ? (
                          <Link
                            href={`/admin/clients/${client.id}`}
                            className="btn btn-primary"
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Open Client
                          </Link>
                        ) : (
                          "Unavailable"
                        )}
                      </td>

                      <td>
                        <form action={updateFollowUpStatus}>
                          <input type="hidden" name="follow_up_id" value={row.id} />
                          <input
                            type="hidden"
                            name="is_completed"
                            value={row.is_completed ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.is_completed ? "Reopen" : "Mark Complete"}
                          </button>
                        </form>
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