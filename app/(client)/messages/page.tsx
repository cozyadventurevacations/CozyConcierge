import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripOption = {
  trip_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
};

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

function getClientDisplayName(client: ClientAccount) {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Traveler";
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "good" | "warning" | "neutral" }) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
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

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = user.email?.trim().toLowerCase();

  if (!userEmail) {
    throw new Error("Your login account does not have an email address.");
  }

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .ilike("email", userEmail)
    .maybeSingle();

  if (clientEmailError) throw new Error(clientEmailError.message);

  if (clientAccountByEmail) {
    return { supabase, user, clientAccount: clientAccountByEmail as ClientAccount };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!userProfile) throw new Error("User profile not found.");

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) throw new Error(clientProfileError.message);
  if (!clientAccountByProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: clientAccountByProfile as ClientAccount };
}

async function createClientMessageThread(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim() || null;

  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message is required.");

  if (tripId) {
    const { data: trip, error: tripError } = await supabase
      .from("client_trip_summaries")
      .select("trip_id")
      .eq("trip_id", tripId)
      .eq("client_account_id", clientAccount.id)
      .maybeSingle();

    if (tripError) throw new Error(tripError.message);
    if (!trip) throw new Error("Trip not found for this client account.");
  }

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .insert({
      client_account_id: clientAccount.id,
      trip_id: tripId,
      subject,
      status: "open",
      priority: "normal",
      admin_unread_count: 1,
      client_unread_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Could not create message thread.");
  }

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: thread.id,
    client_account_id: clientAccount.id,
    trip_id: tripId,
    sender_type: "client",
    body,
    is_read_by_admin: false,
    is_read_by_client: true,
  });

  if (messageError) throw new Error(messageError.message);

  revalidatePath("/messages");
  redirect(`/messages?threadId=${thread.id}`);
}

async function replyToClientThread(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId) throw new Error("Missing thread ID.");
  if (!body) throw new Error("Message is required.");

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, trip_id, status")
    .eq("id", threadId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Message thread not found.");
  }

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: threadId,
    client_account_id: clientAccount.id,
    trip_id: thread.trip_id,
    sender_type: "client",
    body,
    is_read_by_admin: false,
    is_read_by_client: true,
  });

  if (messageError) throw new Error(messageError.message);

  const { error: updateError } = await supabase
    .from("message_threads" as any)
    .update({
      status: thread.status === "archived" ? "open" : thread.status,
      admin_unread_count: 1,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("client_account_id", clientAccount.id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string; sent?: string }>;
}) {
  const { threadId } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: trips } = await supabase
    .from("client_trip_summaries")
    .select("trip_id, trip_name, destinations, departure_date")
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: false });

  const { data: threads, error: threadsError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, admin_unread_count, client_unread_count, last_message_at, created_at")
    .eq("client_account_id", clientAccount.id)
    .order("last_message_at", { ascending: false });

  if (threadsError) {
    return (
      <PageShell title="Messages" subtitle="Ask your travel advisor a question.">
        <div className="card">
          <p><strong>Error loading messages:</strong></p>
          <pre>{JSON.stringify(threadsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripRows = (trips ?? []) as TripOption[];
  const threadRows = (threads ?? []) as MessageThreadRow[];
  const selectedThread = threadRows.find((thread) => thread.id === threadId) ?? threadRows[0] ?? null;

  let messageRows: MessageRow[] = [];

  if (selectedThread) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages" as any)
      .select("id, thread_id, client_account_id, trip_id, sender_type, body, is_read_by_admin, is_read_by_client, created_at")
      .eq("thread_id", selectedThread.id)
      .eq("client_account_id", clientAccount.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return (
        <PageShell title="Messages" subtitle="Ask your travel advisor a question.">
          <div className="card">
            <p><strong>Error loading thread:</strong></p>
            <pre>{JSON.stringify(messagesError, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }

    messageRows = (messages ?? []) as MessageRow[];

    if ((selectedThread.client_unread_count ?? 0) > 0) {
      await supabase
        .from("messages" as any)
        .update({ is_read_by_client: true })
        .eq("thread_id", selectedThread.id)
        .eq("client_account_id", clientAccount.id);

      await supabase
        .from("message_threads" as any)
        .update({ client_unread_count: 0 })
        .eq("id", selectedThread.id)
        .eq("client_account_id", clientAccount.id);
    }
  }

  const clientName = getClientDisplayName(clientAccount);

  return (
    <PageShell
      title="Concierge Messages"
      subtitle={`Send questions directly to your Cozy Adventure Vacations advisor, ${clientName}.`}
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
          Cozy Concierge
        </p>
        <h2 style={{ margin: 0 }}>Ask Your Travel Advisor</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Use this secure message center for trip questions, document questions, special requests, or anything your advisor should know.
        </p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
          <Link href="/trips" className="btn btn-primary">View My Trips</Link>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Start a New Message</h2>
          <form action={createClientMessageThread} className="stack">
            <label>
              <span className="label">Related Trip</span>
              <select className="select" name="trip_id" defaultValue="">
                <option value="">General question</option>
                {tripRows.map((trip) => (
                  <option key={trip.trip_id} value={trip.trip_id}>
                    {trip.trip_name ?? "Trip"}{trip.destinations ? ` — ${trip.destinations}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Subject</span>
              <input className="input" name="subject" placeholder="Example: Question about my final payment" />
            </label>

            <label>
              <span className="label">Message</span>
              <textarea
                className="textarea"
                name="body"
                rows={6}
                placeholder="Type your message here..."
              />
            </label>

            <button type="submit" className="btn btn-primary">Send Message</button>
          </form>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Message Threads</h2>
          {threadRows.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>No messages yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {threadRows.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/messages?threadId=${thread.id}`}
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
                    Last activity: {formatDateTime(thread.last_message_at)}
                  </p>
                  {(thread.client_unread_count ?? 0) > 0 ? (
                    <p style={{ margin: "6px 0 0", color: "#c2410c", fontWeight: 800 }}>
                      {thread.client_unread_count} unread reply{thread.client_unread_count === 1 ? "" : "ies"}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{selectedThread ? selectedThread.subject : "Conversation"}</h2>
          {selectedThread ? (
            <StatusPill label={selectedThread.status} tone={selectedThread.status === "resolved" ? "good" : "neutral"} />
          ) : null}
        </div>

        {!selectedThread ? (
          <p style={{ margin: 0, color: "#667085" }}>Choose a message thread or start a new message.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {messageRows.map((message) => {
                const isClient = message.sender_type === "client";
                return (
                  <div
                    key={message.id}
                    style={{
                      justifySelf: isClient ? "end" : "start",
                      maxWidth: "78%",
                      padding: "12px",
                      borderRadius: 14,
                      border: "1px solid #e6f0f2",
                      background: isClient ? "#f0f7f8" : "#ffffff",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
                      {isClient ? "You" : "Cozy Adventure Vacations"}
                    </p>
                    <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{message.body}</p>
                    <p style={{ margin: "8px 0 0", color: "#667085", fontSize: 13 }}>
                      {formatDateTime(message.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>

            <form action={replyToClientThread} className="stack">
              <input type="hidden" name="thread_id" value={selectedThread.id} />
              <label>
                <span className="label">Reply</span>
                <textarea className="textarea" name="body" rows={5} placeholder="Type your reply..." />
              </label>
              <button type="submit" className="btn btn-primary">Send Reply</button>
            </form>
          </>
        )}
      </div>
    </PageShell>
  );
}
