import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";
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
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, destinations, departure_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found or access denied.");

  if (trip.client_account_id === clientAccount.id) {
    return { supabase, clientAccount, trip };
  }

  const { data: managerAccess, error: managerAccessError } = await supabase
    .from("trip_members" as any)
    .select("id, can_manage_companions, invite_status")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccount.id)
    .eq("invite_status", "active")
    .maybeSingle();

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
    .select("id, client_account_id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");

  if (trip.client_account_id !== clientAccount.id) {
    throw new Error("Only the primary traveler can answer the insurance question.");
  }

  const { error } = await supabase
    .from("trips")
    .update({
      insurance_decision: decision,
      insurance_decision_at: new Date().toISOString(),
      insurance_decision_by_client_account_id: clientAccount.id,
    })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?insurance=${decision}`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ deletion?: string; insurance?: string }>;
}) {
  const { tripId } = await params;
  const { deletion, insurance: insuranceNotice } = await searchParams;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const advisorEmail = "jeremyb@cozyadventurevacations.com";
  const agencyWebsite = "https://www.cozyadventurevacations.com";

  const { data: trip, error: tripError } = await supabase
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

  if (!isPrimaryClient) {
    const { data: memberAccess } = await supabase
      .from("trip_members" as any)
      .select("id, can_view_trip, can_manage_companions, invite_status")
      .eq("trip_id", tripId)
      .eq("client_account_id", clientAccount.id)
      .eq("invite_status", "active")
      .maybeSingle();

    if (!memberAccess || memberAccess.can_view_trip === false) {
      return (
        <PageShell title="Trip Detail" subtitle="We could not load this trip.">
          <div className="card"><p>Trip not found or access denied.</p></div>
        </PageShell>
      );
    }

    canManageTravelCircle = memberAccess.can_manage_companions === true;
  }

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
    activityResult,
    insuranceResult,
  ] = await Promise.all([
    supabase.from("trip_proposals").select("*").eq("trip_id", tripId).maybeSingle(),
    supabase.from("trip_notes").select("*").eq("trip_id", tripId).eq("note_type", "client").maybeSingle(),
    supabase.from("trip_notes").select("*").eq("trip_id", tripId).eq("note_type", "client_reminder").maybeSingle(),
    supabase.from("trip_members" as any).select(`id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, can_view_trip, can_view_shared_documents, can_join_group_messages, can_upload_own_documents, can_manage_companions, created_at, client_accounts!trip_members_client_account_id_fkey(id, first_name, last_name, email)`).eq("trip_id", tripId).neq("invite_status", "removed").order("created_at", { ascending: true }),
    supabase.from("trip_documents").select("*").eq("trip_id", tripId).eq("visibility", "client").order("created_at", { ascending: false }),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "air").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "hotel").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "cruise").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "transfer").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "activity").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "insurance").maybeSingle(),
  ]);

  const [airDetails, hotelDetails, cruiseDetails, transferDetails, activityDetails, insuranceDetails] = await Promise.all([
    airResult.data ? supabase.from("air_components").select("*").eq("component_id", airResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    hotelResult.data ? supabase.from("hotel_components").select("*").eq("component_id", hotelResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    cruiseResult.data ? supabase.from("cruise_components").select("*").eq("component_id", cruiseResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    transferResult.data ? supabase.from("transfer_components").select("*").eq("component_id", transferResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    activityResult.data ? supabase.from("activity_components").select("*").eq("component_id", activityResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    insuranceResult.data ? supabase.from("insurance_components").select("*").eq("component_id", insuranceResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  let outboundSegment: any = null;
  let returnSegment: any = null;
  if (airResult.data) {
    const { data: segments } = await supabase
      .from("flight_segments")
      .select("*")
      .eq("air_component_id", airResult.data.id)
      .order("segment_order", { ascending: true });
    outboundSegment = segments?.find((s: any) => s.direction === "outbound") ?? null;
    returnSegment = segments?.find((s: any) => s.direction === "return") ?? null;
  }

  const clientDocumentsResult = await supabase
    .from("client_documents")
    .select("id, document_type, title, file_name, uploaded_at, notes, storage_path")
    .eq("client_account_id", clientAccount.id)
    .order("uploaded_at", { ascending: false });

  const tripDocs = (tripDocumentsResult.data ?? []) as any[];
  const documentsWithUrls = await Promise.all(
    tripDocs.map(async (doc: any) => {
      const { data, error } = await supabaseAdmin.storage.from("trip-documents").createSignedUrl(doc.storage_path, 3600);
      return { ...doc, signedUrl: error ? null : data?.signedUrl ?? null };
    }),
  );

  const clientDocs = (clientDocumentsResult.data ?? []) as any[];
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
    .filter((m) => m.invite_status === "active" || m.invite_status === "invited")
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
  const bookedTripStatuses = new Set([
    "reserved",
    "confirmed",
    "pending_final_payment",
    "paid_in_full",
  ]);
  const insuranceDecision = String(trip.insurance_decision ?? "");
  const shouldAskInsurance =
    isPrimaryClient &&
    bookedTripStatuses.has(String(trip.trip_status ?? "")) &&
    insuranceDecision !== "accepted" &&
    insuranceDecision !== "declined";

  return (
    <PageShell
      title={trip.trip_name ?? "Trip Detail"}
      subtitle="Your travel details, all in one place."
    >
      {deletion === "requested" && (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Deletion request sent.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            Your advisor will review this request before anything is removed.
          </p>
        </div>
      )}

      {deletion === "cancelled" && (
        <div className="card" style={{ border: "1px solid #e6f0f2", background: "#f7fbfc", color: "#475569" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Deletion request cancelled.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            This trip will remain active in your portal.
          </p>
        </div>
      )}
      {/* Deletion request status banner — primary client only */}
      {(insuranceNotice === "accepted" || insuranceNotice === "declined") && (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Insurance preference saved.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            Your advisor can now see that you {insuranceNotice === "accepted" ? "want travel insurance coverage reviewed" : "declined travel insurance coverage"}.
          </p>
        </div>
      )}

      {shouldAskInsurance && (
        <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900 }}>Travel Insurance Coverage</p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
              Please let your advisor know whether you would like travel insurance coverage reviewed for this booked trip.
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
              No, I decline
            </button>
          </form>
        </div>
      )}

      {isPrimaryClient && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, border: deletionRequested ? "1px solid #fed7aa" : "1px solid #e6f0f2", background: deletionRequested ? "#fff7ed" : "#f7fbfc" }}>
          <div>
            {deletionRequested ? (
              <>
                <p style={{ margin: 0, fontWeight: 800, color: "#9a3412" }}>⏳ Deletion Request Pending</p>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "#9a3412", lineHeight: 1.5 }}>
                  Your advisor has been notified. You can cancel this request if you change your mind.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontWeight: 700, color: "#667085", fontSize: 13 }}>Need to remove this trip?</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
                  Submitting a request will notify your advisor who will review and confirm the deletion.
                </p>
              </>
            )}
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
        timelineGroups={timelineGroups}
        hotel={hotel}
        flight={flight}
        cruise={cruise}
        transfer={transfer}
        activity={activity}
        insurance={insurance}
        advisorEmail={advisorEmail}
        agencyWebsite={agencyWebsite}
        onInviteCompanion={inviteTravelCompanion}
        onRemoveCompanion={removeTravelCompanion}
      />
    </PageShell>
  );
}
