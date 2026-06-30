import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminReplyForm } from "./admin-reply-form";

type MessageThreadRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  subject: string;
  status: string;
  priority: string;
  thread_type: "private" | "trip_group" | string;
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
  sender_client_account_id: string | null;
  body: string;
  audience: "private" | "trip_group" | string;
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

function getClientName(client: ClientInfo | undefined | null) {
  if (!client) return "Client";
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.email || "Client";
}

// Safely highlight @advisor mentions in message body
function renderMessageBody(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
    .replace(
      /@advisor/gi,
      '<mark style="background:#fef9c3;color:#854d0e;border-radius:4px;padding:0 3px;font-weight:700;">@advisor</mark>',
    );
  return { __html: escaped };
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warning" | "danger" | "neutral";
}) {
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

function ThreadTypePill({ threadType }: { threadType: string | null | undefined }) {
  const isGroup = threadType === "trip_group";
  return (
    <StatusPill
      label={isGroup ? "Travel Circle" : "Private"}
      tone={isGroup ? "warning" : "neutral"}
    />
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
    .select("id, client_account_id, trip_id, status, thread_type, client_unread_count")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Message thread not found.");
  }

  const isGroupThread = thread.thread_type === "trip_group";

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: threadId,
    client_account_id: thread.client_account_id,
    trip_id: thread.trip_id,
    sender_type: "admin",
    audience: isGroupThread ? "trip_group" : "private",
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

async function deleteOldMessageThreads(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const olderThanDays = Number(formData.get("older_than_days") ?? 365);
  const threadType = String(formData.get("thread_type") ?? "all");
  const confirmation = String(formData.get("delete_old_messages_confirmation") ?? "").trim();

  if (![90, 180, 365, 730].includes(olderThanDays)) {
    throw new Error("Choose a valid age cutoff.");
  }

  if (!["all", "private", "trip_group"].includes(threadType)) {
    throw new Error("Choose a valid message type.");
  }

  if (confirmation !== "DELETE OLD MESSAGES") {
    throw new Error("Old message cleanup requires typing DELETE OLD MESSAGES.");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffIso = cutoff.toISOString();

  let oldThreadQuery = supabase
    .from("message_threads" as any)
    .select("id")
    .in("status", ["resolved", "archived"])
    .lt("last_message_at", cutoffIso);

  if (threadType !== "all") {
    oldThreadQuery = oldThreadQuery.eq("thread_type", threadType);
  }

  const { data: oldThreads, error: oldThreadsError } = await oldThreadQuery;

  if (oldThreadsError) throw new Error(oldThreadsError.message);

  const threadIds = ((oldThreads ?? []) as { id: string }[]).map((thread) => thread.id);

  if (threadIds.length === 0) {
    redirect("/admin/messages?oldMessageCleanup=none");
  }

  const { error: messagesError } = await supabase
    .from("messages" as any)
    .delete()
    .in("thread_id", threadIds);

  if (messagesError) throw new Error(messagesError.message);

  const { error: threadsError } = await supabase
    .from("message_threads" as any)
    .delete()
    .in("id", threadIds);

  if (threadsError) throw new Error(threadsError.message);

  revalidatePath("/admin/messages");
  redirect(`/admin/messages?oldMessageCleanup=${threadIds.length}`);
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string; status?: string; type?: string; oldMessageCleanup?: string }>;
}) {
  const { threadId, status, type, oldMessageCleanup } = await searchParams;
  const { supabase } = await requireAdmin();

  let threadQuery = supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at")
    .order("last_message_at", { ascending: false });

  if (status && ["open", "resolved", "archived"].includes(status)) {
    threadQuery = threadQuery.eq("status", status);
  }

  if (type && ["private", "trip_group"].includes(type)) {
    threadQuery = threadQuery.eq("thread_type", type);
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
  const selectedThread =
    threadRows.find((thread) => thread.id === threadId) ?? threadRows[0] ?? null;

  const threadClientIds = threadRows.map((thread) => thread.client_account_id).filter(Boolean);
  const tripIds = Array.from(
    new Set(threadRows.map((thread) => thread.trip_id).filter(Boolean)),
  ) as string[];

  let messageRows: MessageRow[] = [];

  if (selectedThread) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages" as any)
      .select("id, thread_id, client_account_id, trip_id, sender_type, sender_client_account_id, audience, body, is_read_by_admin, is_read_by_client, created_at")
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

  const messageClientIds = messageRows
    .map((message) => message.sender_client_account_id ?? message.client_account_id)
    .filter(Boolean);

  const clientIds = Array.from(new Set([...threadClientIds, ...messageClientIds]));

  const { data: clients } =
    clientIds.length > 0
      ? await supabase
          .from("client_accounts")
          .select("id, first_name, last_name, email")
          .in("id", clientIds)
      : { data: [] as ClientInfo[] };

  const { data: trips } =
    tripIds.length > 0
      ? await supabase
          .from("trips")
          .select("id, trip_name, destinations, departure_date")
          .in("id", tripIds)
      : { data: [] as TripInfo[] };

  const clientMap = new Map(
    (clients ?? []).map((client) => [client.id, client as ClientInfo]),
  );
  const tripMap = new Map((trips ?? []).map((trip) => [trip.id, trip as TripInfo]));

  const openCount = threadRows.filter((thread) => thread.status === "open").length;
  const unreadCount = threadRows.reduce(
    (sum, thread) => sum + Number(thread.admin_unread_count ?? 0),
    0,
  );
  const groupCount = threadRows.filter((thread) => thread.thread_type === "trip_group").length;
  const privateCount = threadRows.filter((thread) => thread.thread_type !== "trip_group").length;

  const selectedClient = selectedThread ? clientMap.get(selectedThread.client_account_id) : null;
  const selectedTrip = selectedThread?.trip_id ? tripMap.get(selectedThread.trip_id) : null;

  return (
    <PageShell
      title="Concierge Messages"
      subtitle="Read and reply to private client messages and Travel Circle group conversations from one inbox."
    >
      {/* ── Banner ── */}
      <div
        className="card stack"
        style={{ background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)", border: "1px solid #e6f0f2" }}
      >
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
          Cozy Concierge
        </p>
        <h2 style={{ margin: 0 }}>Message Inbox</h2>
        <div className="grid grid-4">
          <div className="card">
            <span className="label">Open Threads</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{openCount}</p>
          </div>
          <div className="card">
            <span className="label">Unread Messages</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{unreadCount}</p>
          </div>
          <div className="card">
            <span className="label">Private Threads</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{privateCount}</p>
          </div>
          <div className="card">
            <span className="label">Travel Circle Threads</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{groupCount}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/messages" className="btn btn-primary">All</Link>
          <Link href="/admin/messages?status=open" className="btn btn-primary">Open</Link>
          <Link href="/admin/messages?type=private" className="btn btn-primary">Private</Link>
          <Link href="/admin/messages?type=trip_group" className="btn btn-primary">Travel Circle</Link>
          <Link href="/admin/messages?status=resolved" className="btn btn-primary">Resolved</Link>
          <Link href="/admin/dashboard" className="btn btn-primary">Admin Dashboard</Link>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* ── Thread list ── */}
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Threads</h2>
          {threadRows.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>No message threads yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {threadRows.map((thread) => {
                const client = clientMap.get(thread.client_account_id);
                const trip = thread.trip_id ? tripMap.get(thread.trip_id) : null;
                const params = new URLSearchParams();
                params.set("threadId", thread.id);
                if (status) params.set("status", status);
                if (type) params.set("type", type);

                return (
                  <Link
                    key={thread.id}
                    href={`/admin/messages?${params.toString()}`}
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
                      <ThreadTypePill threadType={thread.thread_type} />
                    </div>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      {thread.thread_type === "trip_group" ? "Travel Circle Group" : getClientName(client)}
                      {trip ? ` • ${trip.trip_name ?? "Trip"}` : ""}
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

        {/* ── Conversation ── */}
        <div className="card stack">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedThread ? selectedThread.subject : "Conversation"}</h2>
              {selectedThread?.trip_id ? (
                <p style={{ margin: "6px 0 0", color: "#667085" }}>
                  Related trip: {selectedTrip?.trip_name ?? "Trip"}
                </p>
              ) : null}
            </div>
            {selectedThread ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ThreadTypePill threadType={selectedThread.thread_type} />
                <StatusPill label={selectedThread.status} tone={selectedThread.status === "resolved" ? "good" : "neutral"} />
              </div>
            ) : null}
          </div>

          {!selectedThread ? (
            <p style={{ margin: 0, color: "#667085" }}>Choose a thread to read and reply.</p>
          ) : (
            <>
              {/* Client / trip info card */}
              <div className="card" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
                <p style={{ margin: 0 }}>
                  <strong>{selectedThread.thread_type === "trip_group" ? "Primary Client:" : "Client:"}</strong>{" "}
                  {getClientName(selectedClient)}
                </p>
                {selectedThread.trip_id ? (
                  <p style={{ margin: "6px 0 0" }}>
                    <strong>Trip:</strong> {selectedTrip?.trip_name ?? "Trip"}
                  </p>
                ) : null}
                {selectedThread.thread_type === "trip_group" ? (
                  <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                    This is a Travel Circle conversation. Replies are visible to approved companions who can access this trip.
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

              {/* Messages */}
              <div style={{ display: "grid", gap: 12 }}>
                {messageRows.map((message) => {
                  const isAdmin = message.sender_type === "admin";
                  const senderClientId = message.sender_client_account_id ?? message.client_account_id;
                  const senderClient = clientMap.get(senderClientId);
                  const senderLabel = isAdmin ? "You" : getClientName(senderClient);
                  const hasMention = /@advisor/i.test(message.body);

                  return (
                    <div
                      key={message.id}
                      style={{
                        justifySelf: isAdmin ? "end" : "start",
                        maxWidth: "78%",
                        padding: "12px",
                        borderRadius: 14,
                        border: hasMention && !isAdmin ? "1px solid #fef08a" : "1px solid #e6f0f2",
                        background: isAdmin ? "#f0f7f8" : hasMention ? "#fefce8" : "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
                          {senderLabel}
                        </p>
                        {hasMention && !isAdmin && (
                          <span style={{ fontSize: 11, fontWeight: 800, background: "#fef9c3", color: "#854d0e", borderRadius: 999, padding: "2px 8px", border: "1px solid #fef08a" }}>
                            @advisor mention
                          </span>
                        )}
                      </div>
                      <p
                        style={{ margin: "6px 0 0", lineHeight: 1.55 }}
                        dangerouslySetInnerHTML={renderMessageBody(message.body)}
                      />
                      <p style={{ margin: "8px 0 0", color: "#667085", fontSize: 13 }}>
                        {formatDateTime(message.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Quick Replies</h3>
                  <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                    Send a common concierge response without retyping it.
                  </p>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <form action={replyAsAdmin}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <input type="hidden" name="body" value="Thank you for the message. I am reviewing this and will follow up shortly." />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Reviewing</button>
                  </form>
                  <form action={replyAsAdmin}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <input type="hidden" name="body" value="Thanks for the update. I have this noted on your trip file." />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Noted</button>
                  </form>
                  <form action={replyAsAdmin}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <input type="hidden" name="body" value="Could you please upload the requested document when you have a moment? That will help me keep everything moving." />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Document Request</button>
                  </form>
                  <form action={replyAsAdmin}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <input type="hidden" name="body" value="Your payment reminder is on my radar. Please let me know if you need the payment link resent." />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13, padding: "7px 12px" }}>Payment Reminder</button>
                  </form>
                </div>
              </div>
              {/* Reply form */}
              <AdminReplyForm threadId={selectedThread.id} action={replyAsAdmin} />

              {/* Status actions */}
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

      <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed" }}>
        <div>
          <h2 style={{ margin: 0, color: "#9a3412" }}>Old Message Cleanup</h2>
          <p style={{ margin: "6px 0 0", color: "#9a3412", lineHeight: 1.6 }}>
            This bottom-page tool permanently deletes old resolved or archived conversations. Open conversations are protected.
          </p>
        </div>
        {oldMessageCleanup ? (
          <div
            className="card"
            style={{
              border: oldMessageCleanup === "none" ? "1px solid #bfdbfe" : "1px solid #bbf7d0",
              background: oldMessageCleanup === "none" ? "#eff6ff" : "#f0fdf4",
              color: oldMessageCleanup === "none" ? "#1d4ed8" : "#166534",
            }}
          >
            <p style={{ margin: 0, fontWeight: 800 }}>
              {oldMessageCleanup === "none"
                ? "No old resolved or archived messages matched that cleanup."
                : `Deleted ${oldMessageCleanup} old message thread${oldMessageCleanup === "1" ? "" : "s"}.`}
            </p>
          </div>
        ) : null}
        <form action={deleteOldMessageThreads} className="grid grid-4" style={{ alignItems: "end" }}>
          <label className="stack-sm">
            <span className="label" style={{ color: "#9a3412" }}>Older than</span>
            <select className="select" name="older_than_days" defaultValue="365">
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </select>
          </label>
          <label className="stack-sm">
            <span className="label" style={{ color: "#9a3412" }}>Message type</span>
            <select className="select" name="thread_type" defaultValue="all">
              <option value="all">All types</option>
              <option value="private">Private only</option>
              <option value="trip_group">Travel Circle only</option>
            </select>
          </label>
          <label className="stack-sm" style={{ gridColumn: "span 2" }}>
            <span className="label" style={{ color: "#9a3412" }}>Type DELETE OLD MESSAGES</span>
            <input className="input" name="delete_old_messages_confirmation" placeholder="DELETE OLD MESSAGES" />
          </label>
          <button type="submit" className="btn btn-outline" style={{ color: "#c2410c", borderColor: "#fed7aa" }}>
            Delete Old Messages
          </button>
        </form>
      </div>
    </PageShell>
  );
}

