import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type MessageThreadRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  subject: string;
  status: string;
  priority: string;
  admin_unread_count: number | null;
  client_unread_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  client_account_id: string;
  trip_id: string | null;
  sender_type: "client" | "admin" | "system";
  body: string;
  is_read_by_admin: boolean | null;
  is_read_by_client: boolean | null;
  created_at: string | null;
};

type ClientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripInfo = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
};

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getClientName(client: ClientInfo | undefined) {
  if (!client) return "Client";
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.email || "Client";
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "good" | "warning" | "danger" | "neutral" }) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    danger: { background: "#fef2f2", color: "#b42318" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  }[tone];

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
      {label}
    </span>
  );
}

async function replyAsAdmin(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId) throw new Error("Missing thread ID.");
  if (!body) throw new Error("Message is required.");

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, status, client_unread_count")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Message thread not found.");
  }

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: threadId,
    client_account_id: thread.client_account_id,
    trip_id: thread.trip_id,
    sender_type: "admin",
    body,
    is_read_by_admin: true,
    is_read_by_client: false,
  });

  if (messageError) throw new Error(messageError.message);

  const { error: updateError } = await supabase
    .from("message_threads" as any)
    .update({
      status: thread.status === "archived" ? "open" : thread.status,
      client_unread_count: Number(thread.client_unread_count ?? 0) + 1,
      admin_unread_count: 0,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/messages");
}

async function updateThreadStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!threadId) throw new Error("Missing thread ID.");
  if (!["open", "resolved", "archived"].includes(status)) {
    throw new Error("Invalid thread status.");
  }

  const { error } = await supabase
    .from("message_threads" as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", threadId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/messages");
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string; status?: string }>;
}) {
  const { threadId, status } = await searchParams;
  const { supabase } = await requireAdmin();

  let threadQuery = supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, admin_unread_count, client_unread_count, last_message_at, created_at")
    .order("last_message_at", { ascending: false });

  if (status && ["open", "resolved", "archived"].includes(status)) {
    threadQuery = threadQuery.eq("status", status);
  }

  const { data: threads, error: threadsError } = await threadQuery;

  if (threadsError) {
    return (
      <PageShell title="Concierge Messages" subtitle="Client message inbox.">
        <div className="card">
          <p><strong>Error loading messages:</strong></p>
          <pre>{JSON.stringify(threadsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const threadRows = (threads ?? []) as MessageThreadRow[];
  const selectedThread = threadRows.find((thread) => thread.id === threadId) ?? threadRows[0] ?? null;

  const clientIds = Array.from(new Set(threadRows.map((thread) => thread.client_account_id).filter(Boolean)));
  const tripIds = Array.from(new Set(threadRows.map((thread) => thread.trip_id).filter(Boolean))) as string[];

  const { data: clients } = clientIds.length > 0
    ? await supabase.from("client_accounts").select("id, first_name, last_name, email").in("id", clientIds)
    : { data: [] as ClientInfo[] };

  const { data: trips } = tripIds.length > 0
    ? await supabase.from("trips").select("id, trip_name, destinations, departure_date").in("id", tripIds)
    : { data: [] as TripInfo[] };

  const clientMap = new Map((clients ?? []).map((client) => [client.id, client as ClientInfo]));
  const tripMap = new Map((trips ?? []).map((trip) => [trip.id, trip as TripInfo]));

  let messageRows: MessageRow[] = [];

  if (selectedThread) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages" as any)
      .select("id, thread_id, client_account_id, trip_id, sender_type, body, is_read_by_admin, is_read_by_client, created_at")
      .eq("thread_id", selectedThread.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return (
        <PageShell title="Concierge Messages" subtitle="Client message inbox.">
          <div className="card">
            <p><strong>Error loading thread:</strong></p>
            <pre>{JSON.stringify(messagesError, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }

    messageRows = (messages ?? []) as MessageRow[];

    if ((selectedThread.admin_unread_count ?? 0) > 0) {
      await supabase
        .from("messages" as any)
        .update({ is_read_by_admin: true })
        .eq("thread_id", selectedThread.id);

      await supabase
        .from("message_threads" as any)
        .update({ admin_unread_count: 0 })
        .eq("id", selectedThread.id);
    }
  }

  const openCount = threadRows.filter((thread) => thread.status === "open").length;
  const unreadCount = threadRows.reduce((sum, thread) => sum + Number(thread.admin_unread_count ?? 0), 0);

  return (
    <PageShell title="Concierge Messages" subtitle="Read and reply to client messages from one inbox.">
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
          Cozy Concierge
        </p>
        <h2 style={{ margin: 0 }}>Message Inbox</h2>
        <div className="grid grid-3">
          <div className="card">
            <span className="label">Open Threads</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{openCount}</p>
          </div>
          <div className="card">
            <span className="label">Unread Messages</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{unreadCount}</p>
          </div>
          <div className="card">
            <span className="label">Total Threads</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{threadRows.length}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/messages" className="btn btn-primary">All</Link>
          <Link href="/admin/messages?status=open" className="btn btn-primary">Open</Link>
          <Link href="/admin/messages?status=resolved" className="btn btn-primary">Resolved</Link>
          <Link href="/admin/dashboard" className="btn btn-primary">Admin Dashboard</Link>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Threads</h2>
          {threadRows.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>No message threads yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {threadRows.map((thread) => {
                const client = clientMap.get(thread.client_account_id);
                const trip = thread.trip_id ? tripMap.get(thread.trip_id) : null;
                return (
                  <Link
                    key={thread.id}
                    href={`/admin/messages?threadId=${thread.id}${status ? `&status=${status}` : ""}`}
                    style={{
                      display: "block",
                      padding: "12px",
                      borderRadius: 12,
                      border: selectedThread?.id === thread.id ? "2px solid var(--accent-dark)" : "1px solid #e6f0f2",
                      textDecoration: "none",
                      color: "inherit",
                      background: selectedThread?.id === thread.id ? "#f7fbfc" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>{thread.subject}</strong>
                      <StatusPill label={thread.status} tone={thread.status === "resolved" ? "good" : "neutral"} />
                    </div>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      {getClientName(client)}{trip ? ` • ${trip.trip_name ?? "Trip"}` : ""}
                    </p>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      Last activity: {formatDateTime(thread.last_message_at)}
                    </p>
                    {(thread.admin_unread_count ?? 0) > 0 ? (
                      <p style={{ margin: "6px 0 0", color: "#c2410c", fontWeight: 800 }}>
                        {thread.admin_unread_count} unread
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card stack">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>{selectedThread ? selectedThread.subject : "Conversation"}</h2>
            {selectedThread ? <StatusPill label={selectedThread.status} tone={selectedThread.status === "resolved" ? "good" : "neutral"} /> : null}
          </div>

          {!selectedThread ? (
            <p style={{ margin: 0, color: "#667085" }}>Choose a thread to read and reply.</p>
          ) : (
            <>
              <div className="card" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
                <p style={{ margin: 0 }}>
                  <strong>Client:</strong> {getClientName(clientMap.get(selectedThread.client_account_id))}
                </p>
                {selectedThread.trip_id ? (
                  <p style={{ margin: "6px 0 0" }}>
                    <strong>Trip:</strong> {tripMap.get(selectedThread.trip_id)?.trip_name ?? "Trip"}
                  </p>
                ) : null}
                <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <Link href={`/admin/clients/${selectedThread.client_account_id}`} className="btn btn-primary">
                    Open Client
                  </Link>
                  {selectedThread.trip_id ? (
                    <Link href={`/admin/trips/${selectedThread.trip_id}`} className="btn btn-primary">
                      Open Trip
                    </Link>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {messageRows.map((message) => {
                  const isAdmin = message.sender_type === "admin";
                  return (
                    <div
                      key={message.id}
                      style={{
                        justifySelf: isAdmin ? "end" : "start",
                        maxWidth: "78%",
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid #e6f0f2",
                        background: isAdmin ? "#f0f7f8" : "#ffffff",
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
                        {isAdmin ? "You" : getClientName(clientMap.get(message.client_account_id))}
                      </p>
                      <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{message.body}</p>
                      <p style={{ margin: "8px 0 0", color: "#667085", fontSize: 13 }}>
                        {formatDateTime(message.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <form action={replyAsAdmin} className="stack">
                <input type="hidden" name="thread_id" value={selectedThread.id} />
                <label>
                  <span className="label">Reply</span>
                  <textarea className="textarea" name="body" rows={5} placeholder="Type your reply..." />
                </label>
                <button type="submit" className="btn btn-primary">Send Reply</button>
              </form>

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <form action={updateThreadStatus}>
                  <input type="hidden" name="thread_id" value={selectedThread.id} />
                  <input type="hidden" name="status" value="open" />
                  <button type="submit" className="btn btn-primary">Mark Open</button>
                </form>
                <form action={updateThreadStatus}>
                  <input type="hidden" name="thread_id" value={selectedThread.id} />
                  <input type="hidden" name="status" value="resolved" />
                  <button type="submit" className="btn btn-primary">Mark Resolved</button>
                </form>
                <form action={updateThreadStatus}>
                  <input type="hidden" name="thread_id" value={selectedThread.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className="btn btn-primary">Archive</button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
