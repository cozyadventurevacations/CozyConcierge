import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendNewClientMessageNotification } from "@/lib/email/message-notification";

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
  thread_type: "private" | "trip_group" | string;
  admin_unread_count: number | null;
  client_unread_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
  advisor_invited_at: string | null;
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

function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getClientDisplayName(client: ClientAccount) {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Traveler";
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warning" | "neutral";
}) {
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

function ThreadTypePill({ threadType }: { threadType: string | null | undefined }) {
  const isGroup = threadType === "trip_group";
  return (
    <StatusPill
      label={isGroup ? "Travel Circle" : "Private"}
      tone={isGroup ? "warning" : "neutral"}
    />
  );
}

function MessageHelpCard({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "warning" | "neutral";
}) {
  const styles = {
    warning: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" },
    neutral: { background: "#f7fbfc", border: "1px solid #e6f0f2", color: "#667085" },
  }[tone];

  return (
    <div
      style={{
        padding: "12px",
        borderRadius: 12,
        background: styles.background,
        border: styles.border,
        color: styles.color,
        lineHeight: 1.55,
      }}
    >
      <strong>{title}</strong>
      <p style={{ margin: "4px 0 0" }}>{description}</p>
    </div>
  );
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) throw new Error("Your login account does not have an email address.");

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

// ── Trip access helpers ───────────────────────────────────────────────────────

async function loadAccessibleTrips(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientAccountId: string,
) {
  const { data: ownedTrips, error: ownedTripsError } = await supabase
    .from("client_trip_summaries")
    .select("trip_id, trip_name, destinations, departure_date")
    .eq("client_account_id", clientAccountId)
    .order("departure_date", { ascending: false });

  if (ownedTripsError) throw new Error(ownedTripsError.message);

  const { data: memberRows, error: memberRowsError } = await supabase
    .from("trip_members" as any)
    .select("trip_id")
    .eq("client_account_id", clientAccountId)
    .eq("invite_status", "active")
    .eq("can_view_trip", true);

  if (memberRowsError) throw new Error(memberRowsError.message);

  const ownedTripRows = (ownedTrips ?? []) as TripOption[];
  const ownedTripIds = new Set(ownedTripRows.map((trip) => trip.trip_id));

  const memberTripIds = Array.from(
    new Set(
      (memberRows ?? [])
        .map((row: { trip_id?: string | null }) => row.trip_id)
        .filter((value): value is string => {
          if (!value) return false;
          return !ownedTripIds.has(value);
        }),
    ),
  );

  let companionTrips: TripOption[] = [];

  if (memberTripIds.length > 0) {
    const { data: companionTripRows, error: companionTripsError } = await supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date")
      .in("id", memberTripIds)
      .order("departure_date", { ascending: false });

    if (companionTripsError) throw new Error(companionTripsError.message);

    companionTrips = (companionTripRows ?? []).map((trip: any) => ({
      trip_id: trip.id,
      trip_name: trip.trip_name,
      destinations: trip.destinations,
      departure_date: trip.departure_date,
    }));
  }

  const tripMap = new Map<string, TripOption>();
  for (const trip of [...ownedTripRows, ...companionTrips]) {
    tripMap.set(trip.trip_id, trip);
  }

  return Array.from(tripMap.values());
}

async function assertCanUseTripMessages(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientAccountId: string,
  tripId: string,
  requireGroupPermission = false,
) {
  const { data: ownedTrip, error: ownedTripError } = await supabase
    .from("client_trip_summaries")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .maybeSingle();

  if (ownedTripError) throw new Error(ownedTripError.message);
  if (ownedTrip) return;

  let memberQuery = supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .eq("invite_status", "active")
    .eq("can_view_trip", true);

  if (requireGroupPermission) {
    memberQuery = memberQuery.eq("can_join_group_messages", true);
  }

  const { data: memberAccess, error: memberAccessError } = await memberQuery.maybeSingle();
  if (memberAccessError) throw new Error(memberAccessError.message);
  if (!memberAccess) throw new Error("Trip not found or access denied.");
}

// ── Server Actions ────────────────────────────────────────────────────────────

async function createClientMessageThread(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const requestedThreadType = String(formData.get("thread_type") ?? "private").trim();
  const threadType = requestedThreadType === "trip_group" ? "trip_group" : "private";
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim() || null;

  if (!body) throw new Error("Message is required.");

  // ── Travel Circle group thread ──────────────────────────────────────────────
  if (threadType === "trip_group") {
    if (!tripId) throw new Error("Choose a related trip for a Travel Circle message.");

    await assertCanUseTripMessages(supabase, clientAccount.id, tripId, true);

    const { data: trip } = await supabase
      .from("trips")
      .select("trip_name, destinations, departure_date")
      .eq("id", tripId)
      .maybeSingle();

    const groupSubject = subject || `${trip?.trip_name ?? "Trip"} — Travel Circle`;

    const { data: existingGroupThread, error: existingGroupThreadError } = await supabase
      .from("message_threads" as any)
      .select("id, status, admin_unread_count, advisor_invited_at")
      .eq("trip_id", tripId)
      .eq("thread_type", "trip_group")
      .maybeSingle();

    if (existingGroupThreadError) throw new Error(existingGroupThreadError.message);

    const threadId = existingGroupThread?.id;

    if (threadId) {
      // Add message to existing thread — do NOT notify admin unless invited
      const { error: messageError } = await supabase.from("messages" as any).insert({
        thread_id: threadId,
        client_account_id: clientAccount.id,
        trip_id: tripId,
        sender_type: "client",
        sender_client_account_id: clientAccount.id,
        audience: "trip_group",
        body,
        is_read_by_admin: false,
        is_read_by_client: true,
      });

      if (messageError) throw new Error(messageError.message);

      // Only increment admin unread if advisor has been invited to this thread
      const advisorInvited = Boolean(existingGroupThread.advisor_invited_at);

      const { error: updateError } = await supabase
        .from("message_threads" as any)
        .update({
          status: existingGroupThread.status === "archived" ? "open" : existingGroupThread.status,
          ...(advisorInvited
            ? { admin_unread_count: Number(existingGroupThread.admin_unread_count ?? 0) + 1 }
            : {}),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);

      if (updateError) throw new Error(updateError.message);

      // Only send email notification if advisor was invited
      if (advisorInvited) {
        await sendNewClientMessageNotification({
          threadId,
          threadType: "trip_group",
          subject: groupSubject,
          senderName: getClientDisplayName(clientAccount),
          senderEmail: clientAccount.email,
          tripName: trip?.trip_name ?? null,
          destinations: trip?.destinations ?? null,
          departureDate: trip?.departure_date ?? null,
          bodyPreview: body,
        });
      }

      revalidatePath("/messages");
      redirect(`/messages?threadId=${threadId}`);
    }

    // Create new group thread — no admin notification, no admin_unread_count
    const { data: newThread, error: threadError } = await supabase
      .from("message_threads" as any)
      .insert({
        client_account_id: clientAccount.id,
        trip_id: tripId,
        subject: groupSubject,
        status: "open",
        priority: "normal",
        thread_type: "trip_group",
        created_by_client_account_id: clientAccount.id,
        admin_unread_count: 0,   // admin not notified until invited
        client_unread_count: 0,
        advisor_invited_at: null, // not invited yet
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (threadError || !newThread) {
      throw new Error(threadError?.message ?? "Could not create Travel Circle thread.");
    }

    const { error: messageError } = await supabase.from("messages" as any).insert({
      thread_id: newThread.id,
      client_account_id: clientAccount.id,
      trip_id: tripId,
      sender_type: "client",
      sender_client_account_id: clientAccount.id,
      audience: "trip_group",
      body,
      is_read_by_admin: false,
      is_read_by_client: true,
    });

    if (messageError) throw new Error(messageError.message);

    // No email notification — admin hasn't been invited yet

    revalidatePath("/messages");
    redirect(`/messages?threadId=${newThread.id}`);
  }

  // ── Private thread ──────────────────────────────────────────────────────────
  if (!subject) throw new Error("Subject is required.");

  let privateTrip: {
    trip_name: string | null;
    destinations: string | null;
    departure_date: string | null;
  } | null = null;

  if (tripId) {
    await assertCanUseTripMessages(supabase, clientAccount.id, tripId, false);

    const { data: relatedTrip } = await supabase
      .from("trips")
      .select("trip_name, destinations, departure_date")
      .eq("id", tripId)
      .maybeSingle();

    privateTrip = relatedTrip ?? null;
  }

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .insert({
      client_account_id: clientAccount.id,
      trip_id: tripId,
      subject,
      status: "open",
      priority: "normal",
      thread_type: "private",
      created_by_client_account_id: clientAccount.id,
      admin_unread_count: 1,   // private messages always notify admin
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
    sender_client_account_id: clientAccount.id,
    audience: "private",
    body,
    is_read_by_admin: false,
    is_read_by_client: true,
  });

  if (messageError) throw new Error(messageError.message);

  await sendNewClientMessageNotification({
    threadId: thread.id,
    threadType: "private",
    subject,
    senderName: getClientDisplayName(clientAccount),
    senderEmail: clientAccount.email,
    tripName: privateTrip?.trip_name ?? null,
    destinations: privateTrip?.destinations ?? null,
    departureDate: privateTrip?.departure_date ?? null,
    bodyPreview: body,
  });

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
    .select("id, client_account_id, trip_id, subject, status, thread_type, admin_unread_count, advisor_invited_at")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Message thread not found.");
  }

  const isGroupThread = thread.thread_type === "trip_group";

  if (isGroupThread) {
    if (!thread.trip_id) throw new Error("This group thread is missing a trip.");
    await assertCanUseTripMessages(supabase, clientAccount.id, thread.trip_id, true);
  } else if (thread.client_account_id !== clientAccount.id) {
    throw new Error("Message thread not found.");
  }

  const { error: messageError } = await supabase.from("messages" as any).insert({
    thread_id: threadId,
    client_account_id: clientAccount.id,
    trip_id: thread.trip_id,
    sender_type: "client",
    sender_client_account_id: clientAccount.id,
    audience: isGroupThread ? "trip_group" : "private",
    body,
    is_read_by_admin: false,
    is_read_by_client: true,
  });

  if (messageError) throw new Error(messageError.message);

  // For group threads: only notify admin if advisor has been invited
  const advisorInvited = isGroupThread ? Boolean(thread.advisor_invited_at) : true;

  const { error: updateError } = await supabase
    .from("message_threads" as any)
    .update({
      status: thread.status === "archived" ? "open" : thread.status,
      ...(advisorInvited
        ? { admin_unread_count: Number(thread.admin_unread_count ?? 0) + 1 }
        : {}),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (updateError) throw new Error(updateError.message);

  if (advisorInvited) {
    let replyTrip: {
      trip_name: string | null;
      destinations: string | null;
      departure_date: string | null;
    } | null = null;

    if (thread.trip_id) {
      const { data: relatedTrip } = await supabase
        .from("trips")
        .select("trip_name, destinations, departure_date")
        .eq("id", thread.trip_id)
        .maybeSingle();
      replyTrip = relatedTrip ?? null;
    }

    await sendNewClientMessageNotification({
      threadId,
      threadType: isGroupThread ? "trip_group" : "private",
      subject: thread.subject ?? "Message reply",
      senderName: getClientDisplayName(clientAccount),
      senderEmail: clientAccount.email,
      tripName: replyTrip?.trip_name ?? null,
      destinations: replyTrip?.destinations ?? null,
      departureDate: replyTrip?.departure_date ?? null,
      bodyPreview: body,
    });
  }

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

async function inviteAdvisorToThread(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim() || null;

  if (!threadId) throw new Error("Missing thread ID.");

  // Fetch thread and verify ownership
  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, thread_type, advisor_invited_at, admin_unread_count")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Thread not found.");
  }

  // Only the thread owner can invite the advisor
  if (thread.client_account_id !== clientAccount.id) {
    throw new Error("Only the trip owner can invite the advisor.");
  }

  // Already invited — do nothing
  if (thread.advisor_invited_at) {
    redirect(`/messages?threadId=${threadId}`);
  }

  // Verify group thread
  if (thread.thread_type !== "trip_group") {
    throw new Error("Advisor invite is only available for Travel Circle threads.");
  }

  let trip: {
    trip_name: string | null;
    destinations: string | null;
    departure_date: string | null;
  } | null = null;

  if (tripId ?? thread.trip_id) {
    const { data: tripData } = await supabase
      .from("trips")
      .select("trip_name, destinations, departure_date")
      .eq("id", tripId ?? thread.trip_id)
      .maybeSingle();
    trip = tripData ?? null;
  }

  // Mark thread as advisor invited + notify admin
  const { error: updateError } = await supabase
    .from("message_threads" as any)
    .update({
      advisor_invited_at: new Date().toISOString(),
      admin_unread_count: Number(thread.admin_unread_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (updateError) throw new Error(updateError.message);

  // Send one-time notification email to admin
  await sendNewClientMessageNotification({
    threadId,
    threadType: "trip_group",
    subject: thread.subject ?? "Travel Circle — Advisor Invited",
    senderName: getClientDisplayName(clientAccount),
    senderEmail: clientAccount.email,
    tripName: trip?.trip_name ?? null,
    destinations: trip?.destinations ?? null,
    departureDate: trip?.departure_date ?? null,
    bodyPreview: `${getClientDisplayName(clientAccount)} has invited you to join this Travel Circle conversation.`,
  });

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    threadId?: string;
    sent?: string;
    tripId?: string;
    subject?: string;
    scope?: string;
  }>;
}) {
  const {
    threadId,
    tripId: requestedTripId,
    subject: requestedSubject,
    scope,
  } = await searchParams;

  const { supabase, clientAccount } = await getCurrentClientAccount();

  let tripRows: TripOption[] = [];

  try {
    tripRows = await loadAccessibleTrips(supabase, clientAccount.id);
  } catch (error) {
    return (
      <PageShell title="Messages" subtitle="We could not load your message center.">
        <div className="card">
          <p><strong>Error loading available trips:</strong></p>
          <p>{error instanceof Error ? error.message : "Unable to load trips."}</p>
        </div>
      </PageShell>
    );
  }

  const tripIds = tripRows.map((trip) => trip.trip_id);

  const { data: privateThreads, error: privateThreadsError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at, advisor_invited_at")
    .eq("client_account_id", clientAccount.id)
    .eq("thread_type", "private")
    .order("last_message_at", { ascending: false });

  if (privateThreadsError) {
    return (
      <PageShell title="Messages" subtitle="We could not load your message threads.">
        <div className="card">
          <p><strong>Error loading messages:</strong></p>
          <pre>{JSON.stringify(privateThreadsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  let groupThreadRows: MessageThreadRow[] = [];

  if (tripIds.length > 0) {
    const { data: groupThreads, error: groupThreadsError } = await supabase
      .from("message_threads" as any)
      .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at, advisor_invited_at")
      .eq("thread_type", "trip_group")
      .in("trip_id", tripIds)
      .order("last_message_at", { ascending: false });

    if (groupThreadsError) {
      return (
        <PageShell title="Messages" subtitle="We could not load your Travel Circle messages.">
          <div className="card">
            <p><strong>Error loading Travel Circle messages:</strong></p>
            <pre>{JSON.stringify(groupThreadsError, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }

    groupThreadRows = (groupThreads ?? []) as MessageThreadRow[];
  }

  const threadMap = new Map<string, MessageThreadRow>();
  for (const thread of [
    ...((privateThreads ?? []) as MessageThreadRow[]),
    ...groupThreadRows,
  ]) {
    threadMap.set(thread.id, thread);
  }

  const threadRows = Array.from(threadMap.values()).sort((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });

  const defaultTripId =
    requestedTripId && tripRows.some((trip) => trip.trip_id === requestedTripId)
      ? requestedTripId
      : "";

  const defaultSubject = requestedSubject ? decodeURIComponent(requestedSubject) : "";
  const defaultThreadType = scope === "group" ? "trip_group" : "private";

  const selectedThread =
    threadRows.find((thread) => thread.id === threadId) ?? threadRows[0] ?? null;

  let messageRows: MessageRow[] = [];

  if (selectedThread) {
    const isGroupThread = selectedThread.thread_type === "trip_group";

    if (isGroupThread && selectedThread.trip_id) {
      await assertCanUseTripMessages(supabase, clientAccount.id, selectedThread.trip_id, true);
    } else if (!isGroupThread && selectedThread.client_account_id !== clientAccount.id) {
      return (
        <PageShell title="Messages" subtitle="We could not load this thread.">
          <div className="card">
            <p><strong>Error loading thread:</strong></p>
            <p>Message thread not found.</p>
          </div>
        </PageShell>
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages" as any)
      .select("id, thread_id, client_account_id, trip_id, sender_type, sender_client_account_id, audience, body, is_read_by_admin, is_read_by_client, created_at")
      .eq("thread_id", selectedThread.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return (
        <PageShell title="Messages" subtitle="We could not load this thread.">
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
        .eq("thread_id", selectedThread.id);

      await supabase
        .from("message_threads" as any)
        .update({ client_unread_count: 0 })
        .eq("id", selectedThread.id);
    }
  }

  const senderClientIds = Array.from(
    new Set(
      messageRows
        .map((message) => message.sender_client_account_id ?? message.client_account_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: senderClients } =
    senderClientIds.length > 0
      ? await supabase
          .from("client_accounts")
          .select("id, first_name, last_name, email")
          .in("id", senderClientIds)
      : { data: [] as ClientAccount[] };

  const senderClientMap = new Map(
    (senderClients ?? []).map((client) => [client.id, client as ClientAccount]),
  );

  const tripMap = new Map(tripRows.map((trip) => [trip.trip_id, trip]));
  const clientName = getClientDisplayName(clientAccount);

  const privateThreadCount = threadRows.filter((t) => t.thread_type !== "trip_group").length;
  const groupThreadCount = threadRows.filter((t) => t.thread_type === "trip_group").length;
  const unreadReplyCount = threadRows.reduce(
    (sum, thread) => sum + Number(thread.client_unread_count ?? 0),
    0,
  );

  const isGroupThread = selectedThread?.thread_type === "trip_group";
  const advisorAlreadyInvited = Boolean(selectedThread?.advisor_invited_at);
  const isThreadOwner = selectedThread?.client_account_id === clientAccount.id;

  return (
    <PageShell
      title="Concierge Messages"
      subtitle={`Your secure message center, ${clientName}.`}
    >
      {/* ── Banner ── */}
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
          Cozy Concierge
        </p>
        <h2 style={{ margin: 0 }}>Message Center</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Send a private message to your advisor or use Travel Circle messages for approved companions on a shared trip.
        </p>
        <div className="grid grid-3">
          <MessageHelpCard title={`${privateThreadCount} Private`} description="Advisor-only conversations." />
          <MessageHelpCard title={`${groupThreadCount} Travel Circle`} description="Shared trip conversations." tone={groupThreadCount > 0 ? "warning" : "neutral"} />
          <MessageHelpCard title={`${unreadReplyCount} Unread`} description="Replies waiting for you." tone={unreadReplyCount > 0 ? "warning" : "neutral"} />
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* ── New Message Form ── */}
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Start a New Message</h2>
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Private messages stay between you and your advisor. Travel Circle messages are visible to approved companions on the selected trip.
          </p>

          <form action={createClientMessageThread} className="stack">
            <label>
              <span className="label">Message Type</span>
              <select className="select" name="thread_type" defaultValue={defaultThreadType}>
                <option value="private">Private Advisor Message</option>
                <option value="trip_group">Travel Circle Group Message</option>
              </select>
            </label>

            <label>
              <span className="label">Related Trip</span>
              <select className="select" name="trip_id" defaultValue={defaultTripId}>
                <option value="">General question</option>
                {tripRows.map((trip) => (
                  <option key={trip.trip_id} value={trip.trip_id}>
                    {trip.trip_name ?? "Trip"}
                    {trip.destinations ? ` — ${trip.destinations}` : ""}
                    {trip.departure_date ? ` (${formatDate(trip.departure_date)})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Subject</span>
              <input
                className="input"
                name="subject"
                defaultValue={defaultSubject}
                placeholder="Example: Question about my final payment"
              />
            </label>

            <label>
              <span className="label">Message</span>
              <textarea className="textarea" name="body" rows={6} placeholder="Type your message here..." />
            </label>

            <button type="submit" className="btn btn-primary">Send Message</button>
          </form>
        </div>

        {/* ── Thread List ── */}
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Message Threads</h2>
          {threadRows.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>No messages yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {threadRows.map((thread) => {
                const trip = thread.trip_id ? tripMap.get(thread.trip_id) : null;
                const unreadCount = Number(thread.client_unread_count ?? 0);
                return (
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
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <ThreadTypePill threadType={thread.thread_type} />
                        {unreadCount > 0 ? <StatusPill label={`${unreadCount} unread`} tone="warning" /> : null}
                      </div>
                    </div>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      {trip ? trip.trip_name ?? "Trip" : "General message"} · {thread.status}
                    </p>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      Last activity: {formatDateTime(thread.last_message_at)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Conversation ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>{selectedThread ? selectedThread.subject : "Conversation"}</h2>
            {selectedThread?.trip_id ? (
              <p style={{ margin: "6px 0 0", color: "#667085" }}>
                Related trip: {tripMap.get(selectedThread.trip_id)?.trip_name ?? "Trip"}
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
          <p style={{ margin: 0, color: "#667085" }}>Choose a message thread or start a new message.</p>
        ) : (
          <>
            {/* Thread type notice */}
            {isGroupThread ? (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", lineHeight: 1.5 }}>
                <strong>Travel Circle conversation:</strong> Messages here are shared with approved companions who have access to this trip.
              </div>
            ) : (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #e6f0f2", background: "#f7fbfc", color: "#667085", lineHeight: 1.5 }}>
                <strong>Private advisor conversation:</strong> Messages here stay between you and Cozy Adventure Vacations.
              </div>
            )}

            {/* Invite Advisor button — group threads only, owner only, not yet invited */}
            {isGroupThread && isThreadOwner && !advisorAlreadyInvited ? (
              <div
                style={{
                  padding: "14px",
                  borderRadius: 12,
                  border: "1px solid #e6f0f2",
                  background: "#f7fbfc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>Invite Your Advisor</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    Your advisor isn&apos;t in this conversation yet. Invite them if you have a question or need help.
                  </p>
                </div>
                <form action={inviteAdvisorToThread}>
                  <input type="hidden" name="thread_id" value={selectedThread.id} />
                  <input type="hidden" name="trip_id" value={selectedThread.trip_id ?? ""} />
                  <button type="submit" className="btn btn-primary">
                    Invite Advisor
                  </button>
                </form>
              </div>
            ) : null}

            {/* Advisor invited confirmation */}
            {isGroupThread && advisorAlreadyInvited ? (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", lineHeight: 1.5, fontSize: 13 }}>
                Your advisor has been invited to this conversation and will be notified of new messages.
              </div>
            ) : null}

            {/* Messages */}
            <div style={{ display: "grid", gap: 12 }}>
              {messageRows.map((message) => {
                const isCurrentClient =
                  message.sender_type === "client" &&
                  (message.sender_client_account_id ?? message.client_account_id) === clientAccount.id;

                const senderClient =
                  message.sender_type === "client"
                    ? senderClientMap.get(message.sender_client_account_id ?? message.client_account_id)
                    : null;

                const senderLabel = isCurrentClient
                  ? "You"
                  : message.sender_type === "admin"
                  ? "Cozy Adventure Vacations"
                  : senderClient
                  ? getClientDisplayName(senderClient)
                  : "Travel Companion";

                return (
                  <div
                    key={message.id}
                    style={{
                      justifySelf: isCurrentClient ? "end" : "start",
                      maxWidth: "78%",
                      padding: "12px",
                      borderRadius: 14,
                      border: "1px solid #e6f0f2",
                      background: isCurrentClient ? "#f0f7f8" : "#ffffff",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>{senderLabel}</p>
                    <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{message.body}</p>
                    <p style={{ margin: "8px 0 0", color: "#667085", fontSize: 13 }}>{formatDateTime(message.created_at)}</p>
                  </div>
                );
              })}
            </div>

            {/* Reply form */}
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
