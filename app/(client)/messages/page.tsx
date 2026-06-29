import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendNewClientMessageNotification } from "@/lib/email/message-notification";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";
import { InviteCompanionForm } from "./invite-companion-form";

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

type TripMemberSummary = {
  id: string;
  display_name: string;
  role: string;
  invite_status: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDateGroupLabel(value: string | null | undefined) {
  if (!value) return "Earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getClientDisplayName(client: ClientAccount) {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Traveler";
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function containsAdvisorMention(body: string) {
  return /@advisor/i.test(body);
}

function groupMessagesByDate(messages: MessageRow[]) {
  const groups: { label: string; messages: MessageRow[] }[] = [];
  let currentLabel = "";
  for (const message of messages) {
    const label = getDateGroupLabel(message.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, messages: [message] });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }
  return groups;
}

// ── UI Components ─────────────────────────────────────────────────────────────

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "good" | "warning" | "neutral" }) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: styles.background, color: styles.color, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ThreadTypePill({ threadType }: { threadType: string | null | undefined }) {
  const isGroup = threadType === "trip_group";
  return <StatusPill label={isGroup ? "Travel Circle" : "Private"} tone={isGroup ? "warning" : "neutral"} />;
}

function MessageHelpCard({ title, description, tone = "neutral" }: { title: string; description: string; tone?: "warning" | "neutral" }) {
  const styles = {
    warning: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" },
    neutral: { background: "#f7fbfc", border: "1px solid #e6f0f2", color: "#667085" },
  }[tone];
  return (
    <div style={{ padding: "12px", borderRadius: 12, background: styles.background, border: styles.border, color: styles.color, lineHeight: 1.55 }}>
      <strong>{title}</strong>
      <p style={{ margin: "4px 0 0" }}>{description}</p>
    </div>
  );
}

function TravelCircleMembersStrip({ members, advisorInvited }: { members: TripMemberSummary[]; advisorInvited: boolean }) {
  if (members.length === 0 && !advisorInvited) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
      <span style={{ fontSize: 12, color: "#667085", fontWeight: 700, whiteSpace: "nowrap" }}>In this circle:</span>
      {members.map((member) => {
        const initials = getInitials(member.display_name);
        const isPending = member.invite_status === "invited";
        return (
          <div key={member.id} title={`${member.display_name}${isPending ? " (pending)" : ""}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: isPending ? "#f0f7f8" : "var(--accent-dark)", color: isPending ? "var(--accent-dark)" : "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, border: isPending ? "1px dashed var(--accent-dark)" : "none", flexShrink: 0 }}>
              {initials}
            </div>
            <span style={{ fontSize: 12, color: isPending ? "#94a3b8" : "var(--accent-dark)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {member.display_name}{isPending ? " (pending)" : ""}
            </span>
          </div>
        );
      })}
      {advisorInvited && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: "#ecfdf3", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#027a48", flexShrink: 0 }}>JB</div>
          <span style={{ fontSize: 12, color: "#027a48", fontWeight: 600, whiteSpace: "nowrap" }}>Advisor ✓</span>
        </div>
      )}
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

  const { data: byEmail, error: emailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .ilike("email", userEmail)
    .maybeSingle();

  if (emailError) throw new Error(emailError.message);
  if (byEmail) return { supabase, user, clientAccount: byEmail as ClientAccount };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User profile not found.");

  const { data: byProfile, error: profileAccountError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", profile.id)
    .maybeSingle();

  if (profileAccountError) throw new Error(profileAccountError.message);
  if (!byProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: byProfile as ClientAccount };
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
  const ownedTripIds = new Set(ownedTripRows.map((t) => t.trip_id));

  const memberTripIds = Array.from(
    new Set(
      (memberRows ?? [])
        .map((row: { trip_id?: string | null }) => row.trip_id)
        .filter((v): v is string => !!v && !ownedTripIds.has(v)),
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
    companionTrips = (companionTripRows ?? []).map((t: any) => ({
      trip_id: t.id, trip_name: t.trip_name, destinations: t.destinations, departure_date: t.departure_date,
    }));
  }

  const tripMap = new Map<string, TripOption>();
  for (const t of [...ownedTripRows, ...companionTrips]) tripMap.set(t.trip_id, t);
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

  let q = supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .eq("invite_status", "active")
    .eq("can_view_trip", true);

  if (requireGroupPermission) q = q.eq("can_join_group_messages", true);

  const { data: memberAccess, error: memberAccessError } = await q.maybeSingle();
  if (memberAccessError) throw new Error(memberAccessError.message);
  if (!memberAccess) throw new Error("Trip not found or access denied.");
}

// ── Check if client can manage companions for a trip ─────────────────────────

async function canManageCompanions(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientAccountId: string,
  tripId: string,
) {
  // Primary client always can
  const { data: ownedTrip } = await supabase
    .from("client_trip_summaries")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .maybeSingle();

  if (ownedTrip) return true;

  // Trip owner role can also manage
  const { data: ownerRow } = await supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .eq("role", "owner")
    .eq("invite_status", "active")
    .maybeSingle();

  return Boolean(ownerRow);
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

  if (threadType === "trip_group") {
    if (!tripId) throw new Error("Choose a related trip for a Travel Circle message.");
    await assertCanUseTripMessages(supabase, clientAccount.id, tripId, true);

    const { data: trip } = await supabase.from("trips").select("trip_name").eq("id", tripId).maybeSingle();
    const groupSubject = subject || `${trip?.trip_name ?? "Trip"} — Travel Circle`;

    const { data: existing, error: existingError } = await supabase
      .from("message_threads" as any)
      .select("id, status, admin_unread_count, advisor_invited_at")
      .eq("trip_id", tripId)
      .eq("thread_type", "trip_group")
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing?.id) {
      await supabase.from("messages" as any).insert({
        thread_id: existing.id, client_account_id: clientAccount.id, trip_id: tripId,
        sender_type: "client", sender_client_account_id: clientAccount.id,
        audience: "trip_group", body, is_read_by_admin: false, is_read_by_client: true,
      });

      const shouldNotify = Boolean(existing.advisor_invited_at) || containsAdvisorMention(body);
      await supabase.from("message_threads" as any).update({
        status: existing.status === "archived" ? "open" : existing.status,
        ...(shouldNotify ? { admin_unread_count: Number(existing.admin_unread_count ?? 0) + 1 } : {}),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);

      revalidatePath("/messages");
      redirect(`/messages?threadId=${existing.id}&sent=1`);
    }

    const mentionsAdvisor = containsAdvisorMention(body);
    const { data: newThread, error: threadError } = await supabase
      .from("message_threads" as any)
      .insert({
        client_account_id: clientAccount.id, trip_id: tripId, subject: groupSubject,
        status: "open", priority: "normal", thread_type: "trip_group",
        created_by_client_account_id: clientAccount.id,
        admin_unread_count: mentionsAdvisor ? 1 : 0, client_unread_count: 0,
        advisor_invited_at: null, last_message_at: new Date().toISOString(),
      })
      .select("id").single();

    if (threadError || !newThread) throw new Error(threadError?.message ?? "Could not create Travel Circle thread.");

    await supabase.from("messages" as any).insert({
      thread_id: newThread.id, client_account_id: clientAccount.id, trip_id: tripId,
      sender_type: "client", sender_client_account_id: clientAccount.id,
      audience: "trip_group", body, is_read_by_admin: false, is_read_by_client: true,
    });

    revalidatePath("/messages");
    redirect(`/messages?threadId=${newThread.id}&sent=1`);
  }

  if (!subject) throw new Error("Subject is required.");

  let privateTrip: { trip_name: string | null; destinations: string | null; departure_date: string | null } | null = null;
  if (tripId) {
    await assertCanUseTripMessages(supabase, clientAccount.id, tripId, false);
    const { data: rt } = await supabase.from("trips").select("trip_name, destinations, departure_date").eq("id", tripId).maybeSingle();
    privateTrip = rt ?? null;
  }

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .insert({
      client_account_id: clientAccount.id, trip_id: tripId, subject,
      status: "open", priority: "normal", thread_type: "private",
      created_by_client_account_id: clientAccount.id,
      admin_unread_count: 1, client_unread_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select("id").single();

  if (threadError || !thread) throw new Error(threadError?.message ?? "Could not create message thread.");

  await supabase.from("messages" as any).insert({
    thread_id: thread.id, client_account_id: clientAccount.id, trip_id: tripId,
    sender_type: "client", sender_client_account_id: clientAccount.id,
    audience: "private", body, is_read_by_admin: false, is_read_by_client: true,
  });

  await sendNewClientMessageNotification({
    threadId: thread.id, threadType: "private", subject,
    senderName: getClientDisplayName(clientAccount), senderEmail: clientAccount.email,
    tripName: privateTrip?.trip_name ?? null, destinations: privateTrip?.destinations ?? null,
    departureDate: privateTrip?.departure_date ?? null, bodyPreview: body,
  });

  revalidatePath("/messages");
  redirect(`/messages?threadId=${thread.id}&sent=1`);
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
    .eq("id", threadId).single();

  if (threadError || !thread) throw new Error(threadError?.message ?? "Message thread not found.");

  const isGroupThread = thread.thread_type === "trip_group";

  if (isGroupThread) {
    if (!thread.trip_id) throw new Error("This group thread is missing a trip.");
    await assertCanUseTripMessages(supabase, clientAccount.id, thread.trip_id, true);
  } else if (thread.client_account_id !== clientAccount.id) {
    throw new Error("Message thread not found.");
  }

  await supabase.from("messages" as any).insert({
    thread_id: threadId, client_account_id: clientAccount.id, trip_id: thread.trip_id,
    sender_type: "client", sender_client_account_id: clientAccount.id,
    audience: isGroupThread ? "trip_group" : "private",
    body, is_read_by_admin: false, is_read_by_client: true,
  });

  const advisorInvited = isGroupThread ? Boolean(thread.advisor_invited_at) : true;
  const mentionsAdvisor = isGroupThread ? containsAdvisorMention(body) : false;
  const shouldNotifyAdmin = advisorInvited || mentionsAdvisor;

  await supabase.from("message_threads" as any).update({
    status: thread.status === "archived" ? "open" : thread.status,
    ...(shouldNotifyAdmin ? { admin_unread_count: Number(thread.admin_unread_count ?? 0) + 1 } : {}),
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", threadId);

  if (advisorInvited) {
    let replyTrip: { trip_name: string | null; destinations: string | null; departure_date: string | null } | null = null;
    if (thread.trip_id) {
      const { data: rt } = await supabase.from("trips").select("trip_name, destinations, departure_date").eq("id", thread.trip_id).maybeSingle();
      replyTrip = rt ?? null;
    }
    await sendNewClientMessageNotification({
      threadId, threadType: isGroupThread ? "trip_group" : "private",
      subject: thread.subject ?? "Message reply",
      senderName: getClientDisplayName(clientAccount), senderEmail: clientAccount.email,
      tripName: replyTrip?.trip_name ?? null, destinations: replyTrip?.destinations ?? null,
      departureDate: replyTrip?.departure_date ?? null, bodyPreview: body,
    });
  }

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}&sent=1`);
}

async function inviteAdvisorToThread(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim() || null;

  if (!threadId) throw new Error("Missing thread ID.");

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, thread_type, advisor_invited_at, admin_unread_count")
    .eq("id", threadId).single();

  if (threadError || !thread) throw new Error(threadError?.message ?? "Thread not found.");
  if (thread.advisor_invited_at) redirect(`/messages?threadId=${threadId}`);
  if (thread.thread_type !== "trip_group") throw new Error("Advisor invite is only available for Travel Circle threads.");

  // Allow primary client or trip owner role
  const canManage = await canManageCompanions(supabase, clientAccount.id, tripId ?? thread.trip_id ?? "");
  if (!canManage) throw new Error("Only the trip owner can invite the advisor.");

  let trip: { trip_name: string | null; destinations: string | null; departure_date: string | null } | null = null;
  if (tripId ?? thread.trip_id) {
    const { data: tripData } = await supabase.from("trips").select("trip_name, destinations, departure_date").eq("id", tripId ?? thread.trip_id).maybeSingle();
    trip = tripData ?? null;
  }

  await supabase.from("message_threads" as any).update({
    advisor_invited_at: new Date().toISOString(),
    admin_unread_count: Number(thread.admin_unread_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", threadId);

  await sendNewClientMessageNotification({
    threadId, threadType: "trip_group",
    subject: thread.subject ?? "Travel Circle — Advisor Invited",
    senderName: getClientDisplayName(clientAccount), senderEmail: clientAccount.email,
    tripName: trip?.trip_name ?? null, destinations: trip?.destinations ?? null,
    departureDate: trip?.departure_date ?? null,
    bodyPreview: `${getClientDisplayName(clientAccount)} has invited you to join this Travel Circle conversation.`,
  });

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

async function notifyAdvisorInThread(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentClientAccount();
  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) throw new Error("Missing thread ID.");

  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .select("id, thread_type, advisor_invited_at, admin_unread_count")
    .eq("id", threadId).single();

  if (threadError || !thread) throw new Error(threadError?.message ?? "Thread not found.");
  if (thread.thread_type !== "trip_group") throw new Error("Notify is only for Travel Circle threads.");
  if (thread.advisor_invited_at) redirect(`/messages?threadId=${threadId}`);

  await supabase.from("message_threads" as any).update({
    admin_unread_count: Number(thread.admin_unread_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", threadId);

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

async function inviteCompanionToCircle(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  const inviteClientAccountId = String(formData.get("invite_client_account_id") ?? "").trim();

  if (!threadId) throw new Error("Missing thread ID.");
  if (!tripId) throw new Error("Missing trip ID.");
  if (!inviteClientAccountId) throw new Error("Choose a registered client to add.");

  // Allow primary client OR trip owner role to invite
  const canManage = await canManageCompanions(supabase, clientAccount.id, tripId);
  if (!canManage) throw new Error("Only the trip owner can invite companions.");

  const { data: existingClient } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, notify_travel_circle_invites")
    .eq("id", inviteClientAccountId)
    .maybeSingle();

  if (!existingClient?.id || !existingClient.email) {
    throw new Error("The selected client account could not be found.");
  }

  const { data: existing } = await supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", existingClient.id)
    .neq("invite_status", "removed")
    .maybeSingle();

  if (existing) {
    revalidatePath("/messages");
    redirect(`/messages?threadId=${threadId}`);
  }

  const { data: tripRow } = await supabase
    .from("trips")
    .select("trip_name, destinations, departure_date")
    .eq("id", tripId)
    .maybeSingle();

  const inviteName = `${existingClient.first_name ?? ""} ${existingClient.last_name ?? ""}`.trim() || null;

  await supabase.from("trip_members" as any).insert({
    trip_id: tripId,
    client_account_id: existingClient.id,
    invite_email: existingClient.email,
    invite_name: inviteName,
    role: "viewer",
    invite_status: "active",
    invited_by_type: "client",
    can_view_trip: true,
    can_view_shared_documents: true,
    can_join_group_messages: true,
    can_upload_own_documents: false,
    can_manage_companions: false,
    updated_at: new Date().toISOString(),
  });

  if (existingClient.notify_travel_circle_invites !== false) {
    await sendTravelCircleInviteEmail({
      to: existingClient.email, inviteName, role: "viewer",
      tripName: tripRow?.trip_name ?? "Your Trip",
      destinations: tripRow?.destinations ?? null,
      departureDate: tripRow?.departure_date ?? null,
    });
  }

  revalidatePath("/messages");
  redirect(`/messages?threadId=${threadId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string; sent?: string; tripId?: string; subject?: string; scope?: string }>;
}) {
  const { threadId, sent, tripId: requestedTripId, subject: requestedSubject, scope } = await searchParams;

  const { supabase, clientAccount } = await getCurrentClientAccount();

  let tripRows: TripOption[] = [];
  try {
    tripRows = await loadAccessibleTrips(supabase, clientAccount.id);
  } catch (error) {
    return (
      <PageShell title="Messages" subtitle="We could not load your message center.">
        <div className="card"><p><strong>Error:</strong> {error instanceof Error ? error.message : "Unable to load trips."}</p></div>
      </PageShell>
    );
  }

  const tripIds = tripRows.map((t) => t.trip_id);

  const { data: privateThreads, error: privateThreadsError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at, advisor_invited_at")
    .eq("client_account_id", clientAccount.id)
    .eq("thread_type", "private")
    .order("last_message_at", { ascending: false });

  if (privateThreadsError) {
    return (
      <PageShell title="Messages" subtitle="We could not load your message threads.">
        <div className="card"><pre>{JSON.stringify(privateThreadsError, null, 2)}</pre></div>
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
          <div className="card"><pre>{JSON.stringify(groupThreadsError, null, 2)}</pre></div>
        </PageShell>
      );
    }
    groupThreadRows = (groupThreads ?? []) as MessageThreadRow[];
  }

  const threadMap = new Map<string, MessageThreadRow>();
  for (const t of [...((privateThreads ?? []) as MessageThreadRow[]), ...groupThreadRows]) {
    threadMap.set(t.id, t);
  }

  const threadRows = Array.from(threadMap.values()).sort((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });

  const defaultTripId = requestedTripId && tripRows.some((t) => t.trip_id === requestedTripId) ? requestedTripId : "";
  const defaultSubject = requestedSubject ? decodeURIComponent(requestedSubject) : "";
  const defaultThreadType = scope === "group" ? "trip_group" : "private";
  const selectedThread = threadRows.find((t) => t.id === threadId) ?? threadRows[0] ?? null;

  let messageRows: MessageRow[] = [];

  if (selectedThread) {
    const isGroup = selectedThread.thread_type === "trip_group";

    if (isGroup && selectedThread.trip_id) {
      await assertCanUseTripMessages(supabase, clientAccount.id, selectedThread.trip_id, true);
    } else if (!isGroup && selectedThread.client_account_id !== clientAccount.id) {
      return (
        <PageShell title="Messages" subtitle="We could not load this thread.">
          <div className="card"><p>Message thread not found.</p></div>
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
          <div className="card"><pre>{JSON.stringify(messagesError, null, 2)}</pre></div>
        </PageShell>
      );
    }

    messageRows = (messages ?? []) as MessageRow[];

    if ((selectedThread.client_unread_count ?? 0) > 0) {
      await supabase.from("messages" as any).update({ is_read_by_client: true }).eq("thread_id", selectedThread.id);
      await supabase.from("message_threads" as any).update({ client_unread_count: 0 }).eq("id", selectedThread.id);
    }
  }

  // ── Travel Circle members — clean separate query, works for all members ────
  let travelCircleMembers: TripMemberSummary[] = [];

  if (selectedThread?.thread_type === "trip_group" && selectedThread.trip_id) {
    const { data: memberRows } = await supabase
      .from("trip_members" as any)
      .select("id, client_account_id, invite_email, invite_name, role, invite_status")
      .eq("trip_id", selectedThread.trip_id)
      .neq("invite_status", "removed")
      .order("created_at", { ascending: true });

    const linkedAccountIds = ((memberRows ?? []) as any[])
      .map((m: any) => m.client_account_id)
      .filter(Boolean);

    const accountMap = new Map<string, ClientAccount>();
    if (linkedAccountIds.length > 0) {
      const { data: accounts } = await supabase
        .from("client_accounts")
        .select("id, first_name, last_name, email")
        .in("id", linkedAccountIds);
      for (const a of accounts ?? []) accountMap.set(a.id, a as ClientAccount);
    }

    travelCircleMembers = ((memberRows ?? []) as any[]).map((m: any) => {
      const account = m.client_account_id ? accountMap.get(m.client_account_id) : null;
      const name = account
        ? `${account.first_name ?? ""} ${account.last_name ?? ""}`.trim() || account.email || "Companion"
        : m.invite_name || m.invite_email || "Companion";
      return { id: m.id, display_name: name, role: m.role, invite_status: m.invite_status };
    });
  }

  const senderClientIds = Array.from(
    new Set(messageRows.map((m) => m.sender_client_account_id ?? m.client_account_id).filter((v): v is string => Boolean(v))),
  );

  const { data: senderClients } = senderClientIds.length > 0
    ? await supabase.from("client_accounts").select("id, first_name, last_name, email").in("id", senderClientIds)
    : { data: [] as ClientAccount[] };

  const senderClientMap = new Map((senderClients ?? []).map((c) => [c.id, c as ClientAccount]));
  const tripMap = new Map(tripRows.map((t) => [t.trip_id, t]));
  const clientName = getClientDisplayName(clientAccount);

  const privateThreadCount = threadRows.filter((t) => t.thread_type !== "trip_group").length;
  const groupThreadCount = threadRows.filter((t) => t.thread_type === "trip_group").length;
  const unreadReplyCount = threadRows.reduce((sum, t) => sum + Number(t.client_unread_count ?? 0), 0);
  const pendingInviteCount = clientAccount.email
    ? (await supabase
        .from("trip_members" as any)
        .select("id", { count: "exact", head: true })
        .ilike("invite_email", clientAccount.email.trim().toLowerCase())
        .eq("invite_status", "invited")).count ?? 0
    : 0;

  const isGroupThread = selectedThread?.thread_type === "trip_group";
  const advisorAlreadyInvited = Boolean(selectedThread?.advisor_invited_at);

  // Check if current client can manage companions for this thread's trip
  const canInvite = selectedThread?.trip_id
    ? await canManageCompanions(supabase, clientAccount.id, selectedThread.trip_id)
    : false;

  const messageGroups = groupMessagesByDate(messageRows);

  return (
    <PageShell title="Concierge Messages" subtitle={`Your secure message center, ${clientName}.`}>

      {/* ── Sent confirmation ── */}
      {sent === "1" && (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <strong>Message sent successfully.</strong>
        </div>
      )}

      {/* ── Banner ── */}
      <div className="card stack" style={{ background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)", border: "1px solid #e6f0f2" }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Cozy Concierge</p>
        <h2 style={{ margin: 0 }}>Message Center</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Send a private message to your advisor or use Travel Circle messages for approved companions on a shared trip.
        </p>
        <div className="grid grid-4">
          <MessageHelpCard title={`${privateThreadCount} Private`} description="Advisor-only conversations." />
          <MessageHelpCard title={`${groupThreadCount} Travel Circle`} description="Shared trip conversations." tone={groupThreadCount > 0 ? "warning" : "neutral"} />
          <MessageHelpCard title={`${pendingInviteCount} Invites`} description="Trip invitations to review." tone={pendingInviteCount > 0 ? "warning" : "neutral"} />
          <MessageHelpCard title={`${unreadReplyCount} Unread`} description="Replies waiting for you." tone={unreadReplyCount > 0 ? "warning" : "neutral"} />
        </div>
      </div>

      {pendingInviteCount > 0 && (
        <div
          className="card"
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 900, color: "#854d0e" }}>
              You have {pendingInviteCount} Travel Circle invitation{pendingInviteCount === 1 ? "" : "s"}
            </p>
            <p style={{ margin: "4px 0 0", color: "#92400e", fontSize: 13, lineHeight: 1.5 }}>
              Review shared trip invitations from your Messages area.
            </p>
          </div>
          <Link href="/invites" className="btn btn-primary" style={{ background: "#854d0e", padding: "9px 16px", fontSize: 13 }}>
            Review Invitations
          </Link>
        </div>
      )}

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
              <input className="input" name="subject" defaultValue={defaultSubject} placeholder="Example: Question about my final payment" />
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
            <div style={{ padding: "20px", borderRadius: 14, background: "#f7fbfc", border: "1px solid #e6f0f2", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 24 }}>✉️</p>
              <p style={{ margin: "10px 0 4px", fontWeight: 800, color: "var(--accent-dark)" }}>No messages yet</p>
              <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>Start a conversation with your advisor using the form on the left.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {threadRows.map((thread) => {
                const trip = thread.trip_id ? tripMap.get(thread.trip_id) : null;
                const unreadCount = Number(thread.client_unread_count ?? 0);
                const isSelected = selectedThread?.id === thread.id;
                const hasUnread = unreadCount > 0;
                return (
                  <Link
                    key={thread.id}
                    href={`/messages?threadId=${thread.id}`}
                    style={{
                      display: "block", padding: "12px", borderRadius: 12,
                      border: isSelected ? "2px solid var(--accent-dark)" : hasUnread ? "1px solid #fed7aa" : "1px solid #e6f0f2",
                      borderLeft: hasUnread && !isSelected ? "4px solid #f97316" : undefined,
                      textDecoration: "none", color: "inherit",
                      background: isSelected ? "#f7fbfc" : hasUnread ? "#fffbf7" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ color: hasUnread ? "#9a3412" : "inherit" }}>{thread.subject}</strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <ThreadTypePill threadType={thread.thread_type} />
                        {hasUnread ? <StatusPill label={`${unreadCount} new`} tone="warning" /> : null}
                      </div>
                    </div>
                    <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>
                      {trip ? trip.trip_name ?? "Trip" : "General message"} · {thread.status}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 12 }}>{formatDateTime(thread.last_message_at)}</p>
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
                Related trip:{" "}
                <Link href={`/trips/${selectedThread.trip_id}`} style={{ color: "var(--accent-dark)", fontWeight: 700 }}>
                  {tripMap.get(selectedThread.trip_id)?.trip_name ?? "View Trip"} →
                </Link>
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
          <div style={{ padding: "24px", borderRadius: 14, background: "#f7fbfc", border: "1px solid #e6f0f2", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 28 }}>💬</p>
            <p style={{ margin: "10px 0 4px", fontWeight: 800, color: "var(--accent-dark)" }}>Select a thread to start reading</p>
            <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>Choose a conversation from the list above, or start a new message.</p>
          </div>
        ) : (
          <>
            {/* Travel Circle members strip — visible to ALL members */}
            {isGroupThread && (
              <TravelCircleMembersStrip members={travelCircleMembers} advisorInvited={advisorAlreadyInvited} />
            )}

            {/* Thread type notice */}
            {isGroupThread ? (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", lineHeight: 1.5 }}>
                <strong>Travel Circle conversation</strong> — messages here are visible to all approved companions on this trip.
                {!advisorAlreadyInvited && (
                  <span style={{ display: "block", marginTop: 4, fontSize: 13 }}>
                    Type <strong>@advisor</strong> in your message to ping your advisor, or use the buttons below.
                  </span>
                )}
              </div>
            ) : (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #e6f0f2", background: "#f7fbfc", color: "#667085", lineHeight: 1.5 }}>
                <strong>Private advisor conversation</strong> — messages here stay between you and Cozy Adventure Vacations.
              </div>
            )}

            {/* Invite / Notify Advisor — any circle manager */}
            {isGroupThread && canInvite && !advisorAlreadyInvited ? (
              <div style={{ padding: "14px", borderRadius: 12, border: "1px solid #e6f0f2", background: "#f7fbfc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>Involve Your Advisor</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    <strong>Notify once</strong> — one-time ping. <strong>Invite</strong> — adds them permanently to this conversation.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <form action={notifyAdvisorInThread}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <button type="submit" className="btn btn-outline" style={{ fontSize: 13 }}>Notify Advisor Once</button>
                  </form>
                  <form action={inviteAdvisorToThread}>
                    <input type="hidden" name="thread_id" value={selectedThread.id} />
                    <input type="hidden" name="trip_id" value={selectedThread.trip_id ?? ""} />
                    <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }}>Invite Advisor</button>
                  </form>
                </div>
              </div>
            ) : null}

            {isGroupThread && advisorAlreadyInvited ? (
              <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", lineHeight: 1.5, fontSize: 13 }}>
                ✓ Your advisor has been invited and will be notified of new messages.
              </div>
            ) : null}

            {/* Invite Companion to Circle — with autofill search */}
            {isGroupThread && canInvite && selectedThread.trip_id ? (
              <details style={{ border: "1px solid #e6f0f2", borderRadius: 12, overflow: "visible" }}>
                <summary style={{ cursor: "pointer", padding: "12px 14px", background: "#f7fbfc", fontWeight: 700, color: "var(--accent-dark)", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", listStyle: "none", borderRadius: 12 }}>
                  <span>+ Invite someone to this Travel Circle</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>Expand</span>
                </summary>
                <div style={{ padding: "14px", background: "#ffffff", borderTop: "1px solid #e6f0f2" }}>
                  <InviteCompanionForm
                    threadId={selectedThread.id}
                    tripId={selectedThread.trip_id}
                    action={inviteCompanionToCircle}
                  />
                </div>
              </details>
            ) : null}

            {/* Messages grouped by date */}
            <div style={{ display: "grid", gap: 20 }}>
              {messageGroups.map((group) => (
                <div key={group.label} style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 1, background: "#e6f0f2" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap", letterSpacing: "0.05em", textTransform: "uppercase" }}>{group.label}</span>
                    <div style={{ flex: 1, height: 1, background: "#e6f0f2" }} />
                  </div>

                  {group.messages.map((message) => {
                    const isCurrentClient =
                      message.sender_type === "client" &&
                      (message.sender_client_account_id ?? message.client_account_id) === clientAccount.id;

                    const senderClient = message.sender_type === "client"
                      ? senderClientMap.get(message.sender_client_account_id ?? message.client_account_id)
                      : null;

                    const senderLabel = isCurrentClient
                      ? "You"
                      : message.sender_type === "admin"
                      ? "Cozy Adventure Vacations"
                      : senderClient
                      ? getClientDisplayName(senderClient)
                      : "Travel Companion";

                    const bodyHtml = message.body
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/\n/g, "<br/>")
                      .replace(/@advisor/gi, '<mark style="background:#fef9c3;color:#854d0e;border-radius:4px;padding:0 3px;font-weight:700;">@advisor</mark>');

                    return (
                      <div
                        key={message.id}
                        style={{
                          justifySelf: isCurrentClient ? "end" : "start",
                          maxWidth: "78%",
                          padding: "12px",
                          borderRadius: 14,
                          border: "1px solid #e6f0f2",
                          background: isCurrentClient ? "#f0f7f8" : message.sender_type === "admin" ? "#f7fbfc" : "#ffffff",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)", fontSize: 13 }}>{senderLabel}</p>
                        <p style={{ margin: "6px 0 0", lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                        <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>{formatDateTime(message.created_at)}</p>
                      </div>
                    );
                  })}
                </div>
              ))}

              {messageRows.length === 0 && (
                <p style={{ margin: 0, color: "#667085", textAlign: "center", fontSize: 13 }}>No messages in this thread yet.</p>
              )}
            </div>

            {/* Reply form */}
            <form action={replyToClientThread} className="stack">
              <input type="hidden" name="thread_id" value={selectedThread.id} />
              <label>
                <span className="label">Reply</span>
                <textarea
                  className="textarea"
                  name="body"
                  rows={4}
                  placeholder={isGroupThread && !advisorAlreadyInvited ? "Type your reply... Use @advisor to notify your advisor." : "Type your reply..."}
                />
              </label>
              <button type="submit" className="btn btn-primary">Send Reply</button>
            </form>
          </>
        )}
      </div>
    </PageShell>
  );
}


