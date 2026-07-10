import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";
import { findActiveTripMemberAccess } from "@/lib/travel-circle-access";
import { TripDetailClient } from "./trip-detail-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(value: string | null | undefined) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getTimelineDateKey(value: string | null | undefined) {
  if (!value) return "unknown";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

const answeredInsuranceDecisionValues = new Set([
  "accepted",
  "accept",
  "yes",
  "declined",
  "decline",
  "no",
  "waived",
  "coverage_accepted",
  "coverage_declined",
]);

const insuranceOfferedMilestoneTitle = "Travel insurance offered";
const insuranceAnsweredMilestoneTitle = "Travel insurance accepted / declined";
const agencyName = "Cozy Adventure Vacations";
const agencyTagline = "Memories Await!";

function normalizeInsuranceDecision(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function hasInsuranceDecisionBeenAnswered(decision: unknown, decidedAt: unknown) {
  return (
    answeredInsuranceDecisionValues.has(normalizeInsuranceDecision(decision)) ||
    String(decidedAt ?? "").trim().length > 0
  );
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInsuranceWaiverDocument({
  clientName,
  clientEmail,
  tripName,
  destinations,
  departureDate,
  decision,
  decisionLabel,
  recordedAt,
}: {
  clientName: string;
  clientEmail: string | null;
  tripName: string;
  destinations: string | null;
  departureDate: string | null;
  decision: "accepted" | "declined";
  decisionLabel: string;
  recordedAt: string;
}) {
  const formattedDepartureDate = fmtDate(departureDate) ?? departureDate ?? "Not provided";
  const formattedRecordedAt = fmtDateTime(recordedAt) ?? recordedAt;
  const decisionSummary =
    decision === "accepted"
      ? "Client accepted travel insurance coverage review."
      : "Client declined travel insurance coverage review.";
  const acknowledgment =
    decision === "accepted"
      ? "I request that Cozy Adventure Vacations review travel insurance coverage options for this trip. I understand coverage is not bound until an insurance policy is selected, purchased, and confirmed by the insurance provider."
      : "I decline travel insurance coverage review for this trip at this time. I understand that I may be responsible for trip costs, penalties, medical expenses, delays, cancellations, interruptions, baggage issues, or other losses that may have been covered by a travel insurance policy.";
  const plainText = [
    `${agencyName}`,
    agencyTagline,
    "",
    "Travel Insurance Acknowledgment and Waiver",
    "",
    `Client: ${clientName}`,
    clientEmail ? `Client email: ${clientEmail}` : null,
    `Trip: ${tripName}`,
    destinations ? `Destination(s): ${destinations}` : null,
    `Departure date: ${formattedDepartureDate}`,
    `Decision: ${decisionSummary}`,
    `Decision detail: Client ${decisionLabel}.`,
    `Recorded at: ${formattedRecordedAt}`,
    "",
    "Client Acknowledgment",
    acknowledgment,
    "",
    "Advisor Record",
    "Travel insurance was offered through the client trip page. The client submitted the decision above while logged into their Cozy Concierge account.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Travel Insurance Acknowledgment and Waiver</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #14313f;
      --muted: #5f7180;
      --accent: #1f6f7a;
      --warm: #fff7ed;
      --line: #dbe8ec;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f5f8fa;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
    }
    main {
      max-width: 840px;
      margin: 28px auto;
      background: #ffffff;
      border: 1px solid var(--line);
      padding: 40px;
    }
    header {
      border-bottom: 3px solid var(--accent);
      padding-bottom: 22px;
      margin-bottom: 28px;
    }
    .brand {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0;
      margin: 0;
    }
    .tagline {
      margin: 4px 0 0;
      color: var(--muted);
      font-style: italic;
    }
    h1 {
      margin: 22px 0 0;
      font-size: 24px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 16px;
      margin: 24px 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--accent);
    }
    dl {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 16px;
      margin: 0;
    }
    dt {
      color: var(--muted);
      font-weight: 700;
    }
    dd {
      margin: 0;
      font-weight: 700;
    }
    .decision {
      margin: 18px 0;
      padding: 18px;
      background: var(--warm);
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-weight: 800;
    }
    .acknowledgment {
      border: 1px solid var(--line);
      padding: 18px;
      background: #fbfdfe;
    }
    .signature {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .signature div {
      border-top: 1px solid var(--line);
      padding-top: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
    }
    @media print {
      body { background: #ffffff; }
      main { margin: 0; border: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="brand">${escapeHtml(agencyName)}</p>
      <p class="tagline">${escapeHtml(agencyTagline)}</p>
      <h1>Travel Insurance Acknowledgment and Waiver</h1>
    </header>

    <section>
      <h2>Trip Record</h2>
      <dl>
        <dt>Client</dt>
        <dd>${escapeHtml(clientName)}</dd>
        <dt>Email</dt>
        <dd>${escapeHtml(clientEmail ?? "Not provided")}</dd>
        <dt>Trip</dt>
        <dd>${escapeHtml(tripName)}</dd>
        <dt>Destination(s)</dt>
        <dd>${escapeHtml(destinations ?? "Not provided")}</dd>
        <dt>Departure date</dt>
        <dd>${escapeHtml(formattedDepartureDate)}</dd>
        <dt>Recorded at</dt>
        <dd>${escapeHtml(formattedRecordedAt)}</dd>
        <dt>Decision detail</dt>
        <dd>Client ${escapeHtml(decisionLabel)}.</dd>
      </dl>
    </section>

    <section>
      <h2>Client Decision</h2>
      <div class="decision">${escapeHtml(decisionSummary)}</div>
      <div class="acknowledgment">
        <strong>Client acknowledgment:</strong>
        <p>${escapeHtml(acknowledgment)}</p>
      </div>
    </section>

    <section>
      <h2>Advisor Record</h2>
      <p>Travel insurance was offered through the client trip page. The client submitted this decision while logged into their Cozy Concierge account.</p>
      <div class="signature">
        <div>Client: ${escapeHtml(clientName)}</div>
        <div>Date recorded: ${escapeHtml(formattedRecordedAt)}</div>
      </div>
    </section>

    <footer>
      Generated by Cozy Concierge for ${escapeHtml(agencyName)}. This record documents the client's selection for this trip.
    </footer>
  </main>
</body>
</html>`;

  return { html, plainText };
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
  if (byEmail) return { supabase, user, clientAccount: byEmail };

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

  return { supabase, user, clientAccount: byProfile };
}

async function requireTripCircleManager(tripId: string) {
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id, client_account_id, trip_name, destinations, departure_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found or access denied.");

  if (trip.client_account_id === clientAccount.id) {
    return { supabase, clientAccount, trip };
  }

  const { data: managerAccess, error: managerAccessError } = await findActiveTripMemberAccess({
    supabase: supabaseAdmin,
    tripId,
    clientAccountId: clientAccount.id,
    email: clientAccount.email,
    select: "id, can_manage_companions, invite_status",
  });

  if (managerAccessError) throw new Error(managerAccessError.message);
  if (!managerAccess || managerAccess.can_manage_companions !== true) {
    throw new Error("You do not have permission to manage Travel Companions for this trip.");
  }

  return { supabase, clientAccount, trip };
}

// ─── Server actions ───────────────────────────────────────────────────────────

async function inviteTravelCompanion(formData: FormData) {
  "use server";
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const inviteClientAccountId = String(formData.get("invite_client_account_id") ?? "").trim();
  const requestedRole = String(formData.get("role") ?? "viewer").trim();
  const role = requestedRole === "contributor" ? "contributor" : "viewer";

  if (!inviteClientAccountId) throw new Error("Choose a registered client to add.");

  const { supabase, clientAccount, trip } = await requireTripCircleManager(tripId);

  const { data: existingClient } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, notify_travel_circle_invites")
    .eq("id", inviteClientAccountId)
    .maybeSingle();

  if (!existingClient?.id || !existingClient.email) {
    throw new Error("The selected client account could not be found.");
  }

  if (existingClient.id === clientAccount.id) return;
  if (existingClient?.id === trip.client_account_id) return;

  let existingMemberQuery = supabase
    .from("trip_members" as any)
    .select("id, invite_status")
    .eq("trip_id", tripId)
    .neq("invite_status", "removed");

  existingMemberQuery = existingMemberQuery.eq("client_account_id", existingClient.id);

  const { data: existingMembers } = await existingMemberQuery.limit(1);
  if ((existingMembers ?? []).length > 0) return;

  const inviteName = `${existingClient.first_name ?? ""} ${existingClient.last_name ?? ""}`.trim() || null;

  const { error: insertError } = await supabase.from("trip_members" as any).insert({
    trip_id: tripId,
    client_account_id: existingClient.id,
    invite_email: existingClient.email,
    invite_name: inviteName,
    role,
    invite_status: "active",
    invited_by_type: "client",
    invited_by_client_account_id: clientAccount.id,
    can_view_trip: true,
    can_view_shared_documents: true,
    can_join_group_messages: true,
    can_upload_own_documents: role === "contributor",
    can_manage_companions: false,
  });

  if (insertError) throw new Error(insertError.message);

  if (existingClient.notify_travel_circle_invites !== false) {
    await sendTravelCircleInviteEmail({
      to: existingClient.email,
      inviteName,
      role,
      tripName: trip.trip_name ?? "Your Trip",
      destinations: trip.destinations,
      departureDate: trip.departure_date,
    });
  }

  revalidatePath(`/trips/${tripId}`);
}

async function removeTravelCompanion(formData: FormData) {
  "use server";
  const tripId = String(formData.get("trip_id") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");
  if (!memberId) throw new Error("Missing Travel Companion ID.");

  const { supabase } = await requireTripCircleManager(tripId);

  const { data: member } = await supabase
    .from("trip_members" as any)
    .select("id, role")
    .eq("id", memberId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!member || member.role === "owner") return;

  const { error: updateError } = await supabase
    .from("trip_members" as any)
    .update({ invite_status: "removed", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("trip_id", tripId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/trips/${tripId}`);
}

async function attachClientUploadToTrip(formData: FormData) {
  "use server";

  const { clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const clientDocumentId = String(formData.get("client_document_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!clientDocumentId) throw new Error("Missing document ID.");

  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id, client_account_id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Trip not found.");
  }

  const isPrimaryClient = trip.client_account_id === clientAccount.id;
  if (!isPrimaryClient) {
    const { data: memberAccess, error: memberAccessError } = await findActiveTripMemberAccess({
      supabase: supabaseAdmin,
      tripId,
      clientAccountId: clientAccount.id,
      email: clientAccount.email,
      select: "id, can_view_trip, can_upload_own_documents, invite_status",
    });

    if (memberAccessError) throw new Error(memberAccessError.message);
    if (
      !memberAccess ||
      memberAccess.can_view_trip === false ||
      memberAccess.can_upload_own_documents !== true
    ) {
      throw new Error("You do not have permission to attach documents to this trip.");
    }
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("client_documents")
    .select("id, client_account_id, document_title")
    .eq("id", clientDocumentId)
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? "Document not found.");
  }

  if (document.client_account_id !== clientAccount.id) {
    throw new Error("You can only attach your own uploaded documents.");
  }

  const { error: attachError } = await supabaseAdmin
    .from("trip_client_documents")
    .upsert(
      {
        trip_id: tripId,
        client_document_id: clientDocumentId,
        visibility: "client",
        display_title: document.document_title,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,client_document_id" },
    );

  if (attachError) throw new Error(attachError.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/documents`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}/client-documents`);
}

async function requestTripDeletion(formData: FormData) {
  "use server";

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, deletion_requested_at")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");

  const { data: clientAccount } = await supabase
    .from("client_accounts")
    .select("id, email")
    .ilike("email", user.email?.trim().toLowerCase() ?? "")
    .maybeSingle();

  if (!clientAccount || trip.client_account_id !== clientAccount.id) {
    throw new Error("Only the primary traveler can request trip deletion.");
  }

  if (trip.deletion_requested_at) {
    const { error } = await supabase
      .from("trips")
      .update({ deletion_requested_at: null, deletion_requested_by: null })
      .eq("id", tripId);

    if (error) throw new Error(error.message);

    revalidatePath(`/trips/${tripId}`);
    redirect(`/trips/${tripId}?deletion=cancelled`);
  }

  const { error } = await supabase
    .from("trips")
    .update({
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: clientAccount.email ?? user.email ?? "client",
    })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?deletion=requested`);
}

async function recordInsuranceDecision(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const decision = String(formData.get("insurance_decision") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (decision !== "accepted" && decision !== "declined") {
    throw new Error("Choose yes or no for travel insurance.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, destinations, departure_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");

  if (trip.client_account_id !== clientAccount.id) {
    throw new Error("Only the primary traveler can answer the insurance question.");
  }

  const decisionAt = new Date().toISOString();
  const { error } = await supabase
    .from("trips")
    .update({
      insurance_decision: decision,
      insurance_decision_at: decisionAt,
      insurance_decision_by_client_account_id: clientAccount.id,
    })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  const decisionLabel =
    decision === "accepted"
      ? "accepted travel insurance coverage review"
      : "declined travel insurance coverage review";
  const clientName =
    `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim() ||
    clientAccount.email ||
    "Client";
  const waiverDocument = buildInsuranceWaiverDocument({
    clientName,
    clientEmail: clientAccount.email ?? null,
    tripName: trip.trip_name ?? "Trip",
    destinations: trip.destinations ?? null,
    departureDate: trip.departure_date ?? null,
    decision: decision as "accepted" | "declined",
    decisionLabel,
    recordedAt: decisionAt,
  });
  const waiverContent = waiverDocument.plainText;

  const supabaseAdmin = createSupabaseAdminClient();
  const waiverFileName = "travel-insurance-waiver.html";
  const waiverStoragePath = `${tripId}/generated/${waiverFileName}`;
  const waiverBytes = new TextEncoder().encode(waiverDocument.html);

  const { error: waiverUploadError } = await supabaseAdmin.storage
    .from("trip-documents")
    .upload(waiverStoragePath, waiverBytes, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

  if (waiverUploadError) throw new Error(waiverUploadError.message);

  const { data: existingWaiver, error: existingWaiverError } = await supabaseAdmin
    .from("trip_notes")
    .select("id")
    .eq("trip_id", tripId)
    .eq("note_type", "insurance_waiver")
    .maybeSingle();

  if (existingWaiverError) throw new Error(existingWaiverError.message);

  if (existingWaiver) {
    const { error: waiverUpdateError } = await supabaseAdmin
      .from("trip_notes")
      .update({
        title: "Travel Insurance Waiver",
        content: waiverContent,
        updated_at: decisionAt,
      })
      .eq("id", existingWaiver.id);

    if (waiverUpdateError) throw new Error(waiverUpdateError.message);
  } else {
    const { error: waiverInsertError } = await supabaseAdmin
      .from("trip_notes")
      .insert({
        trip_id: tripId,
        note_type: "insurance_waiver",
        title: "Travel Insurance Waiver",
        content: waiverContent,
      });

    if (waiverInsertError) throw new Error(waiverInsertError.message);
  }

  const { data: existingWaiverDocument, error: existingWaiverDocumentError } =
    await supabaseAdmin
      .from("trip_documents")
      .select("id")
      .eq("trip_id", tripId)
      .eq("storage_path", waiverStoragePath)
      .maybeSingle();

  if (existingWaiverDocumentError) throw new Error(existingWaiverDocumentError.message);

  const waiverDocumentPayload = {
    trip_id: tripId,
    file_name: waiverFileName,
    storage_path: waiverStoragePath,
    mime_type: "text/html; charset=utf-8",
    file_size_bytes: waiverBytes.byteLength,
    visibility: "client_travel_circle",
    component_id: null,
    component_type: "insurance",
    attach_to_commission: false,
  };

  if (existingWaiverDocument) {
    const { error: waiverDocumentUpdateError } = await supabaseAdmin
      .from("trip_documents")
      .update(waiverDocumentPayload)
      .eq("id", existingWaiverDocument.id);

    if (waiverDocumentUpdateError) throw new Error(waiverDocumentUpdateError.message);
  } else {
    const { error: waiverDocumentInsertError } = await supabaseAdmin
      .from("trip_documents")
      .insert(waiverDocumentPayload);

    if (waiverDocumentInsertError) throw new Error(waiverDocumentInsertError.message);
  }

  const { error: milestoneUpdateError } = await supabaseAdmin
    .from("trip_milestones" as any)
    .update({
      is_completed: true,
      completed_at: decisionAt,
      updated_at: decisionAt,
    })
    .eq("trip_id", tripId)
    .eq("title", insuranceAnsweredMilestoneTitle);

  if (milestoneUpdateError) throw new Error(milestoneUpdateError.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/trips/${tripId}/documents`);
  redirect(`/trips/${tripId}`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ deletion?: string }>;
}) {
  const { tripId } = await params;
  const { deletion } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const advisorEmail = "jeremyb@cozyadventurevacations.com";
  const agencyWebsite = "https://www.cozyadventurevacations.com";

  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Detail" subtitle="We could not load this trip.">
        <div className="card"><p>Trip not found or access denied.</p></div>
      </PageShell>
    );
  }

  // Block access to soft-deleted trips
  if (trip.deleted_at) {
    return (
      <PageShell title="Trip Not Available" subtitle="This trip has been removed.">
        <div className="card stack" style={{ border: "1px solid #e6f0f2" }}>
          <p style={{ margin: 0 }}>This trip is no longer available. If you believe this is an error, please contact your advisor.</p>
        </div>
      </PageShell>
    );
  }

  const isPrimaryClient = trip.client_account_id === clientAccount.id;
  let canManageTravelCircle = isPrimaryClient;
  let canViewSharedDocuments = isPrimaryClient;
  let canAttachClientDocuments = isPrimaryClient;

  if (!isPrimaryClient) {
    const { data: memberAccess } = await findActiveTripMemberAccess({
      supabase: supabaseAdmin,
      tripId,
      clientAccountId: clientAccount.id,
      email: clientAccount.email,
      select: "id, can_view_trip, can_view_shared_documents, can_upload_own_documents, can_manage_companions, invite_status",
    });

    if (!memberAccess || memberAccess.can_view_trip === false) {
      return (
        <PageShell title="Trip Detail" subtitle="We could not load this trip.">
          <div className="card"><p>Trip not found or access denied.</p></div>
        </PageShell>
      );
    }

    canManageTravelCircle = memberAccess.can_manage_companions === true;
    canViewSharedDocuments = memberAccess.can_view_shared_documents === true;
    canAttachClientDocuments = memberAccess.can_upload_own_documents === true;
  }

  const allowedDocumentVisibility = isPrimaryClient
    ? ["client", "client_travel_circle"]
    : canViewSharedDocuments
      ? ["travel_circle", "client_travel_circle"]
      : [];

  const [
    proposalResult,
    clientNoteResult,
    clientReminderResult,
    tripMembersResult,
    tripDocumentsResult,
    airResult,
    hotelResult,
    cruiseResult,
    transferResult,
    rentalCarResult,
    activityResult,
    insuranceResult,
    insuranceOfferedMilestoneResult,
  ] = await Promise.all([
    supabaseAdmin.from("trip_proposals").select("*").eq("trip_id", tripId).maybeSingle(),
    supabaseAdmin.from("trip_notes").select("*").eq("trip_id", tripId).eq("note_type", "client").maybeSingle(),
    supabaseAdmin.from("trip_notes").select("*").eq("trip_id", tripId).eq("note_type", "client_reminder").maybeSingle(),
    supabase.from("trip_members" as any).select(`id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, can_view_trip, can_view_shared_documents, can_join_group_messages, can_upload_own_documents, can_manage_companions, created_at, client_accounts!trip_members_client_account_id_fkey(id, first_name, last_name, email)`).eq("trip_id", tripId).neq("invite_status", "removed").order("created_at", { ascending: true }),
    allowedDocumentVisibility.length > 0
      ? supabaseAdmin.from("trip_documents").select("*").eq("trip_id", tripId).in("visibility", allowedDocumentVisibility).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "air").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "hotel").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "cruise").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "transfer").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "rental_car").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "activity").maybeSingle(),
    supabaseAdmin.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "insurance").maybeSingle(),
    supabaseAdmin
      .from("trip_milestones" as any)
      .select("id, is_completed")
      .eq("trip_id", tripId)
      .eq("title", insuranceOfferedMilestoneTitle)
      .maybeSingle(),
  ]);

  const [airDetails, hotelDetails, cruiseDetails, transferDetails, rentalCarDetails, activityDetails, insuranceDetails] = await Promise.all([
    airResult.data ? supabaseAdmin.from("air_components").select("*").eq("component_id", airResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    hotelResult.data ? supabaseAdmin.from("hotel_components").select("*").eq("component_id", hotelResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    cruiseResult.data ? supabaseAdmin.from("cruise_components").select("*").eq("component_id", cruiseResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    transferResult.data ? supabaseAdmin.from("transfer_components").select("*").eq("component_id", transferResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    rentalCarResult.data ? supabaseAdmin.from("rental_car_components").select("*").eq("component_id", rentalCarResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    activityResult.data ? supabaseAdmin.from("activity_components").select("*").eq("component_id", activityResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    insuranceResult.data ? supabaseAdmin.from("insurance_components").select("*").eq("component_id", insuranceResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  let outboundSegment: any = null;
  let returnSegment: any = null;
  if (airResult.data) {
    const { data: segments } = await supabaseAdmin
      .from("flight_segments")
      .select("*")
      .eq("air_component_id", airResult.data.id)
      .order("segment_order", { ascending: true });
    outboundSegment = segments?.find((s: any) => s.direction === "outbound") ?? null;
    returnSegment = segments?.find((s: any) => s.direction === "return") ?? null;
  }

  const [clientDocumentsResult, linkedClientDocumentsResult] = await Promise.all([
    supabaseAdmin
      .from("client_documents")
      .select("id, document_type, document_title, file_name, storage_path, notes, created_at")
      .eq("client_account_id", clientAccount.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("trip_client_documents")
      .select("id, client_document_id, visibility, display_title, notes")
      .eq("trip_id", tripId),
  ]);

  if (clientDocumentsResult.error) throw new Error(clientDocumentsResult.error.message);
  if (linkedClientDocumentsResult.error) throw new Error(linkedClientDocumentsResult.error.message);

  const tripDocs = (tripDocumentsResult.data ?? []) as any[];
  const documentsWithUrls = await Promise.all(
    tripDocs.map(async (doc: any) => {
      const { data, error } = await supabaseAdmin.storage.from("trip-documents").createSignedUrl(doc.storage_path, 3600);
      return { ...doc, signedUrl: error ? null : data?.signedUrl ?? null };
    }),
  );

  const linkedClientDocumentsById = new Map(
    ((linkedClientDocumentsResult.data ?? []) as any[]).map((linkedDocument) => [
      linkedDocument.client_document_id,
      linkedDocument,
    ]),
  );

  const clientDocs = ((clientDocumentsResult.data ?? []) as any[])
    .map((clientDocument: any) => {
      const linkedDocument = linkedClientDocumentsById.get(clientDocument.id);
      return {
        id: clientDocument.id,
        document_type: clientDocument.document_type ?? null,
        title: linkedDocument?.display_title || clientDocument.document_title || null,
        file_name: clientDocument.file_name ?? null,
        uploaded_at: clientDocument.created_at ?? null,
        notes: linkedDocument?.notes ?? clientDocument.notes ?? null,
        storage_path: clientDocument.storage_path ?? null,
        isAttachedToTrip: Boolean(linkedDocument),
        linkedVisibility: linkedDocument?.visibility ?? null,
      };
    })
    .filter(Boolean);
  const clientDocsWithUrls = await Promise.all(
    clientDocs.map(async (doc: any) => {
      if (!doc.storage_path) return { ...doc, signedUrl: null };
      const { data, error } = await supabaseAdmin.storage.from("client-documents").createSignedUrl(doc.storage_path, 3600);
      return { ...doc, signedUrl: error ? null : data?.signedUrl ?? null };
    }),
  );

  type TimelineEvent = { dateValue: string; icon: string; title: string; details: string };
  const rawEvents: (TimelineEvent | null)[] = [
    hotelDetails.data?.check_in_date ? { dateValue: hotelDetails.data.check_in_date, icon: "🏨", title: "Hotel Check-in", details: hotelDetails.data.hotel_name ?? "Hotel stay begins" } : null,
    hotelDetails.data?.check_out_date ? { dateValue: hotelDetails.data.check_out_date, icon: "🧳", title: "Hotel Check-out", details: hotelDetails.data.hotel_name ?? "Hotel stay ends" } : null,
    outboundSegment?.departure_datetime ? { dateValue: outboundSegment.departure_datetime, icon: "✈️", title: "Outbound Flight", details: `${outboundSegment.departure_airport_code ?? "?"} → ${outboundSegment.destination_airport_code ?? "?"}` } : null,
    returnSegment?.departure_datetime ? { dateValue: returnSegment.departure_datetime, icon: "🛬", title: "Return Flight", details: `${returnSegment.departure_airport_code ?? "?"} → ${returnSegment.destination_airport_code ?? "?"}` } : null,
    transferDetails.data?.pickup_datetime ? { dateValue: transferDetails.data.pickup_datetime, icon: "🚗", title: "Transfer Pickup", details: `${transferDetails.data.pickup_location ?? "Pickup"} → ${transferDetails.data.dropoff_location ?? "Dropoff"}` } : null,
    activityDetails.data?.activity_datetime ? { dateValue: activityDetails.data.activity_datetime, icon: "🎟️", title: activityDetails.data.activity_name ?? "Activity", details: activityDetails.data.location ?? "Scheduled activity" } : null,
    cruiseDetails.data?.sailing_date ? { dateValue: cruiseDetails.data.sailing_date, icon: "🚢", title: "Cruise Sailing", details: `${cruiseDetails.data.ship_name ?? "Cruise"}${cruiseDetails.data.departure_port ? ` from ${cruiseDetails.data.departure_port}` : ""}` } : null,
    cruiseDetails.data?.return_date ? { dateValue: cruiseDetails.data.return_date, icon: "⚓", title: "Cruise Return", details: cruiseDetails.data.arrival_port ?? "Cruise return" } : null,
  ];

  const sortedEvents = rawEvents
    .filter((e): e is TimelineEvent => Boolean(e?.dateValue))
    .sort((a, b) => new Date(a.dateValue).getTime() - new Date(b.dateValue).getTime());

  const timelineGroups = sortedEvents.reduce((groups: any[], event) => {
    const dateKey = getTimelineDateKey(event.dateValue);
    const dateLabel = fmtDate(dateKey) ?? dateKey;
    const time = event.dateValue.includes("T") ? fmtDateTime(event.dateValue) ?? undefined : undefined;
    const existing = groups.find((g) => g.dateKey === dateKey);
    if (existing) {
      existing.events.push({ icon: event.icon, title: event.title, details: event.details, time });
    } else {
      groups.push({ dateKey, dateLabel, events: [{ icon: event.icon, title: event.title, details: event.details, time }] });
    }
    return groups;
  }, []);

  const rawMembers = (tripMembersResult.data ?? []) as any[];
  const tripMembers = rawMembers
    .filter((m) => m.invite_status === "active")
    .map((m) => {
      const account = Array.isArray(m.client_accounts) ? m.client_accounts[0] : m.client_accounts;
      const name = account
        ? `${account.first_name ?? ""} ${account.last_name ?? ""}`.trim() || account.email
        : m.invite_name || m.invite_email || "Invited Companion";
      return {
        id: m.id, invite_email: m.invite_email, invite_name: m.invite_name,
        role: m.role, invite_status: m.invite_status, display_name: name,
        email: account?.email ?? m.invite_email ?? null,
      };
    });

  const hotel = hotelResult.data && hotelDetails.data ? {
    name: hotelDetails.data.hotel_name ?? null, address: hotelDetails.data.hotel_address ?? null,
    stars: hotelDetails.data.hotel_star_rating ?? null, checkIn: hotelDetails.data.check_in_date ?? null,
    checkOut: hotelDetails.data.check_out_date ?? null, roomCategory: hotelDetails.data.room_category ?? null,
    roomDescription: hotelDetails.data.room_description ?? null, hotelDescription: hotelDetails.data.hotel_description ?? null,
    confirmationNumber: hotelResult.data.confirmation_number ?? null, nightlyRate: hotelDetails.data.nightly_rate ?? null,
    totalPrice: hotelResult.data.total_price ?? null, bookingStatus: hotelResult.data.booking_status ?? null,
    supplier: hotelResult.data.supplier_name ?? null,
  } : null;

  const flight = airResult.data && airDetails.data ? {
    flightType: airDetails.data.flight_type ?? null,
    supplier: airResult.data.supplier_name ?? outboundSegment?.carrier ?? null,
    travelerCount: airDetails.data.traveler_count ?? null, rateClass: airDetails.data.rate_class ?? null,
    airlineLocator: airDetails.data.airline_locator ?? null, confirmationNumber: airResult.data.confirmation_number ?? null,
    totalPrice: airResult.data.total_price ?? null, bookingStatus: airResult.data.booking_status ?? null,
    outbound: outboundSegment ? {
      route: `${outboundSegment.departure_airport_code ?? "?"} → ${outboundSegment.destination_airport_code ?? "?"}`,
      flight: `${outboundSegment.carrier ?? ""} ${outboundSegment.flight_number ?? ""}`.trim() || "Not provided",
      departure: fmtDateTime(outboundSegment.departure_datetime) ?? "Not provided",
      arrival: fmtDateTime(outboundSegment.arrival_datetime) ?? "Not provided",
      cabinClass: outboundSegment.cabin_class ?? null, seat: outboundSegment.seat_assignment ?? null,
    } : null,
    returnFlight: returnSegment ? {
      route: `${returnSegment.departure_airport_code ?? "?"} → ${returnSegment.destination_airport_code ?? "?"}`,
      flight: `${returnSegment.carrier ?? ""} ${returnSegment.flight_number ?? ""}`.trim() || "Not provided",
      departure: fmtDateTime(returnSegment.departure_datetime) ?? "Not provided",
      arrival: fmtDateTime(returnSegment.arrival_datetime) ?? "Not provided",
      cabinClass: returnSegment.cabin_class ?? null, seat: returnSegment.seat_assignment ?? null,
    } : null,
  } : null;

  const cruise = cruiseResult.data && cruiseDetails.data ? {
    cruiseLine: cruiseDetails.data.cruise_line ?? null, shipName: cruiseDetails.data.ship_name ?? null,
    sailingDate: cruiseDetails.data.sailing_date ?? null, returnDate: cruiseDetails.data.return_date ?? null,
    departurePort: cruiseDetails.data.departure_port ?? null, arrivalPort: cruiseDetails.data.arrival_port ?? null,
    cabinCategory: cruiseDetails.data.cabin_category ?? null, cabinNumber: cruiseDetails.data.cabin_number ?? null,
    diningSeating: cruiseDetails.data.dining_seating ?? null, description: cruiseDetails.data.cruise_description ?? null,
    confirmationNumber: cruiseResult.data.confirmation_number ?? null, totalPrice: cruiseResult.data.total_price ?? null,
    bookingStatus: cruiseResult.data.booking_status ?? null, supplier: cruiseResult.data.supplier_name ?? null,
  } : null;

  const transfer = transferResult.data && transferDetails.data ? {
    supplier: transferResult.data.supplier_name ?? transferDetails.data.supplier_name ?? null,
    pickupDatetime: transferDetails.data.pickup_datetime ?? null,
    passengerCount: transferDetails.data.passenger_count ?? null,
    pickupLocation: transferDetails.data.pickup_location ?? null,
    dropoffLocation: transferDetails.data.dropoff_location ?? null,
    vehicleType: transferDetails.data.vehicle_type ?? null,
    notes: transferDetails.data.transfer_notes ?? null,
    confirmationNumber: transferResult.data.confirmation_number ?? null,
    totalPrice: transferResult.data.total_price ?? null,
    bookingStatus: transferResult.data.booking_status ?? null,
  } : null;

  const rentalCar = rentalCarResult.data && rentalCarDetails.data ? {
    supplier: rentalCarResult.data.supplier_name ?? null,
    company: rentalCarDetails.data.rental_company ?? null,
    pickupDatetime: rentalCarDetails.data.pickup_datetime ?? null,
    returnDatetime: rentalCarDetails.data.return_datetime ?? null,
    pickupLocation: rentalCarDetails.data.pickup_location ?? null,
    returnLocation: rentalCarDetails.data.return_location ?? null,
    vehicleClass: rentalCarDetails.data.vehicle_class ?? null,
    driverCount: rentalCarDetails.data.driver_count ?? null,
    notes: rentalCarDetails.data.rental_notes ?? null,
    confirmationNumber: rentalCarResult.data.confirmation_number ?? null,
    totalPrice: rentalCarResult.data.total_price ?? null,
    bookingStatus: rentalCarResult.data.booking_status ?? null,
  } : null;

  const activity = activityResult.data && activityDetails.data ? {
    name: activityDetails.data.activity_name ?? null, supplier: activityResult.data.supplier_name ?? null,
    datetime: activityDetails.data.activity_datetime ?? null, location: activityDetails.data.location ?? null,
    participantCount: activityDetails.data.participant_count ?? null, notes: activityDetails.data.activity_notes ?? null,
    confirmationNumber: activityResult.data.confirmation_number ?? null,
    totalPrice: activityResult.data.total_price ?? null, bookingStatus: activityResult.data.booking_status ?? null,
  } : null;

  const insurance = insuranceResult.data && insuranceDetails.data ? {
    provider: insuranceDetails.data.provider_name ?? null, planName: insuranceDetails.data.plan_name ?? null,
    coverageStart: insuranceDetails.data.coverage_start_date ?? null,
    coverageEnd: insuranceDetails.data.coverage_end_date ?? null,
    travelersCount: insuranceDetails.data.insured_traveler_count ?? null,
    claimPhone: insuranceDetails.data.claim_phone ?? null,
    notes: insuranceDetails.data.insurance_notes ?? null,
    policyNumber: insuranceResult.data.confirmation_number ?? null,
    totalPrice: insuranceResult.data.total_price ?? null,
    bookingStatus: insuranceResult.data.booking_status ?? null,
  } : null;

  const componentPriceTotal = [
    hotelResult.data?.total_price,
    airResult.data?.total_price,
    cruiseResult.data?.total_price,
    transferResult.data?.total_price,
    rentalCarResult.data?.total_price,
    activityResult.data?.total_price,
    insuranceResult.data?.total_price,
  ].reduce((sum, value) => sum + Number(value ?? 0), 0);
  const calculatedTripTotal = roundMoney(
    componentPriceTotal + Number(proposalResult.data?.planning_fee ?? 0),
  );
  const proposalForClient = proposalResult.data
    ? {
        ...proposalResult.data,
        total_price: calculatedTripTotal,
      }
    : null;

  let coverImageUrl: string | null = null;
  if (trip.cover_image_path) {
    const { data: coverData } = await supabaseAdmin.storage
      .from("trip-documents")
      .createSignedUrl(trip.cover_image_path, 3600);
    coverImageUrl = coverData?.signedUrl ?? null;
  }

  const tripForClient = {
    ...trip,
    cover_image_url: coverImageUrl,
  };

  const deletionRequested = Boolean(trip.deletion_requested_at);
  const hasInsuranceBeenOffered =
    insuranceOfferedMilestoneResult.data?.is_completed === true;
  const shouldAskInsurance =
    isPrimaryClient &&
    hasInsuranceBeenOffered &&
    !hasInsuranceDecisionBeenAnswered(trip.insurance_decision, trip.insurance_decision_at);

  return (
    <PageShell
      title={trip.trip_name ?? "Trip Detail"}
      subtitle="Your travel details, all in one place."
    >
      {shouldAskInsurance && (
        <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900 }}>Travel Insurance Waiver</p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
              Your advisor has offered travel insurance coverage review for this trip.
              Please choose whether you would like coverage reviewed. If you decline,
              you are confirming that you do not want your advisor to review travel
              insurance options for this trip at this time.
            </p>
          </div>
          <form action={recordInsuranceDecision} className="row">
            <input type="hidden" name="trip_id" value={trip.id} />
            <button
              type="submit"
              name="insurance_decision"
              value="accepted"
              className="btn btn-primary"
            >
              Yes, review coverage
            </button>
            <button
              type="submit"
              name="insurance_decision"
              value="declined"
              className="btn btn-outline"
              style={{ borderColor: "#fed7aa", color: "#9a3412" }}
            >
              I decline coverage review
            </button>
          </form>
        </div>
      )}

      <TripDetailClient
        trip={tripForClient}
        proposal={proposalForClient}
        clientNote={clientNoteResult.data ?? null}
        clientReminder={clientReminderResult.data ?? null}
        tripMembers={tripMembers}
        isPrimaryClient={isPrimaryClient}
        canManageTravelCircle={canManageTravelCircle}
        documents={documentsWithUrls}
        clientDocuments={clientDocsWithUrls}
        canAttachClientDocuments={canAttachClientDocuments}
        timelineGroups={timelineGroups}
        hotel={hotel}
        flight={flight}
        cruise={cruise}
        transfer={transfer}
        rentalCar={rentalCar}
        activity={activity}
        insurance={insurance}
        advisorEmail={advisorEmail}
        agencyWebsite={agencyWebsite}
        onInviteCompanion={inviteTravelCompanion}
        onRemoveCompanion={removeTravelCompanion}
        onAttachClientDocument={attachClientUploadToTrip}
      />

      {isPrimaryClient && (
        <div className="card" style={{ border: deletionRequested ? "1px solid #fed7aa" : "1px solid #e6f0f2", background: deletionRequested ? "#fff7ed" : "#f7fbfc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: deletionRequested ? "#9a3412" : "#667085" }}>
                {deletionRequested ? "Deletion request pending" : "Trip options"}
              </p>
              {deletion === "requested" ? (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#027a48", lineHeight: 1.5 }}>
                  Deletion request sent.
                </p>
              ) : null}
              {deletion === "cancelled" ? (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                  Deletion request cancelled.
                </p>
              ) : null}
            </div>
            <form action={requestTripDeletion}>
              <input type="hidden" name="trip_id" value={trip.id} />
              <button
                type="submit"
                className="btn btn-outline"
                style={{
                  fontSize: 13,
                  padding: "8px 14px",
                  color: deletionRequested ? "#9a3412" : "#667085",
                  borderColor: deletionRequested ? "#fed7aa" : "#e6f0f2",
                }}
              >
                {deletionRequested ? "Cancel Deletion Request" : "Request Trip Deletion"}
              </button>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
