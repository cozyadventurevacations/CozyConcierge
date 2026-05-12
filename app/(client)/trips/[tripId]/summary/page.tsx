/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function fmtDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "Not provided";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
  if (byEmail) return { supabase, clientAccount: byEmail };

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

  return { supabase, clientAccount: byProfile };
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return <div style={{ border: "1px solid #dbeaf0", borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: 800 }}>{label}</div><div style={{ marginTop: 4, fontWeight: 800, color: "#123f5b" }}>{value}</div></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ borderTop: "2px solid #dbeaf0", paddingTop: 18, marginTop: 22 }}><h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#123f5b" }}>{title}</h2>{children}</section>;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0, 1fr)", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef4f6" }}><strong style={{ color: "#64748b" }}>{label}</strong><span>{value || "Not provided"}</span></div>;
}

export default async function TripPrintSummaryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: trip, error: tripError } = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (tripError || !trip) redirect("/trips");

  if (trip.client_account_id !== clientAccount.id) {
    const { data: memberAccess, error: memberError } = await supabase
      .from("trip_members" as any)
      .select("id, can_view_trip, invite_status")
      .eq("trip_id", tripId)
      .eq("client_account_id", clientAccount.id)
      .eq("invite_status", "active")
      .maybeSingle();

    if (memberError || !memberAccess?.can_view_trip) redirect("/trips");
  }

  const [tripDocsResult, hotelResult, cruiseResult, airResult, transferResult, activityResult] = await Promise.all([
    supabase.from("trip_documents").select("id, title, file_name, document_type, created_at").eq("trip_id", tripId).eq("visibility", "client").order("created_at", { ascending: false }),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "hotel").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "cruise").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "air").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "transfer").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "activity").maybeSingle(),
  ]);

  const [hotelDetails, cruiseDetails, transferDetails, activityDetails] = await Promise.all([
    hotelResult.data ? supabase.from("hotel_components").select("*").eq("component_id", hotelResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    cruiseResult.data ? supabase.from("cruise_components").select("*").eq("component_id", cruiseResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    transferResult.data ? supabase.from("transfer_components").select("*").eq("component_id", transferResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
    activityResult.data ? supabase.from("activity_components").select("*").eq("component_id", activityResult.data.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  let flightSegments: any[] = [];
  if (airResult.data) {
    const { data: segments } = await supabase.from("flight_segments").select("*").eq("air_component_id", airResult.data.id).order("segment_order", { ascending: true });
    flightSegments = segments ?? [];
  }

  let coverImageUrl: string | null = null;
  if (trip.cover_image_path) {
    const { data } = await supabaseAdmin.storage.from("trip-documents").createSignedUrl(trip.cover_image_path, 3600);
    coverImageUrl = data?.signedUrl ?? null;
  }

  const events = [
    hotelDetails.data?.check_in_date ? { date: hotelDetails.data.check_in_date, title: "Hotel Check-in", detail: hotelDetails.data.hotel_name ?? "Hotel stay begins" } : null,
    hotelDetails.data?.check_out_date ? { date: hotelDetails.data.check_out_date, title: "Hotel Check-out", detail: hotelDetails.data.hotel_name ?? "Hotel stay ends" } : null,
    ...flightSegments.map((segment) => segment.departure_datetime ? { date: segment.departure_datetime, title: `${segment.carrier ?? "Flight"} ${segment.flight_number ?? ""}`.trim(), detail: `${segment.departure_airport_code ?? "?"} to ${segment.destination_airport_code ?? "?"}` } : null),
    transferDetails.data?.pickup_datetime ? { date: transferDetails.data.pickup_datetime, title: "Transfer Pickup", detail: `${transferDetails.data.pickup_location ?? "Pickup"} to ${transferDetails.data.dropoff_location ?? "Dropoff"}` } : null,
    activityDetails.data?.activity_datetime ? { date: activityDetails.data.activity_datetime, title: activityDetails.data.activity_name ?? "Activity", detail: activityDetails.data.location ?? "Scheduled activity" } : null,
    cruiseDetails.data?.sailing_date ? { date: cruiseDetails.data.sailing_date, title: "Cruise Sailing", detail: `${cruiseDetails.data.ship_name ?? "Cruise"}${cruiseDetails.data.departure_port ? ` from ${cruiseDetails.data.departure_port}` : ""}` } : null,
    cruiseDetails.data?.return_date ? { date: cruiseDetails.data.return_date, title: "Cruise Return", detail: cruiseDetails.data.arrival_port ?? "Cruise return" } : null,
  ].filter((event): event is { date: string; title: string; detail: string } => Boolean(event?.date)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <main style={{ minHeight: "100vh", background: "#f7fafb", color: "#123f5b", padding: 24 }}>
      <div style={{ maxWidth: 920, margin: "0 auto", background: "#ffffff", border: "1px solid #dbeaf0", borderRadius: 16, padding: 28 }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <Link href={`/trips/${tripId}`} style={{ fontWeight: 800, color: "#123f5b", textDecoration: "none" }}>Back to Trip</Link>
          <button type="button" className="print-button">Print / Save PDF</button>
        </div>
        <script dangerouslySetInnerHTML={{ __html: "document.addEventListener('click',function(e){if(e.target&&e.target.className==='print-button'){window.print();}});" }} />

        <header style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={150} height={75} priority />
            <div style={{ textAlign: "right", color: "#64748b", fontSize: 13 }}><strong style={{ color: "#123f5b" }}>Cozy Concierge Trip Summary</strong><br />Generated {fmtDate(new Date().toISOString())}</div>
          </div>
          {coverImageUrl ? <img src={coverImageUrl} alt="Trip cover" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 14, border: "1px solid #dbeaf0" }} /> : null}
          <div><p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", fontWeight: 900 }}>Travel Itinerary</p><h1 style={{ margin: "6px 0 0", fontSize: 34 }}>{trip.trip_name ?? "Your Trip"}</h1><p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5 }}>{trip.destinations ?? "Destination details will appear here as your trip is finalized."}</p></div>
        </header>

        <Section title="Trip Snapshot"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}><InfoBox label="Departure" value={fmtDate(trip.departure_date)} /><InfoBox label="Return" value={fmtDate(trip.return_date)} /><InfoBox label="Status" value={trip.trip_status ?? "Not provided"} /><InfoBox label="Balance Due" value={fmtMoney(trip.balance_due)} /></div></Section>
        {events.length > 0 ? <Section title="Itinerary Timeline"><div style={{ display: "grid", gap: 10 }}>{events.map((event, index) => <div key={`${event.date}-${index}`} style={{ display: "grid", gridTemplateColumns: "170px minmax(0, 1fr)", gap: 12, padding: "10px 0", borderBottom: "1px solid #eef4f6" }}><strong>{fmtDateTime(event.date)}</strong><div><strong>{event.title}</strong><div style={{ color: "#64748b", marginTop: 3 }}>{event.detail}</div></div></div>)}</div></Section> : null}
        {hotelDetails.data || cruiseDetails.data || flightSegments.length > 0 ? <Section title="Travel Details">{hotelDetails.data ? <><DetailRow label="Hotel" value={hotelDetails.data.hotel_name} /><DetailRow label="Check-in" value={fmtDate(hotelDetails.data.check_in_date)} /><DetailRow label="Check-out" value={fmtDate(hotelDetails.data.check_out_date)} /><DetailRow label="Confirmation" value={hotelResult.data?.confirmation_number} /></> : null}{cruiseDetails.data ? <><DetailRow label="Cruise" value={`${cruiseDetails.data.cruise_line ?? ""} ${cruiseDetails.data.ship_name ?? ""}`.trim()} /><DetailRow label="Sailing" value={fmtDate(cruiseDetails.data.sailing_date)} /><DetailRow label="Return" value={fmtDate(cruiseDetails.data.return_date)} /><DetailRow label="Cabin" value={cruiseDetails.data.cabin_number || cruiseDetails.data.cabin_category} /></> : null}{flightSegments.map((segment, index) => <DetailRow key={segment.id ?? index} label={`Flight ${index + 1}`} value={`${segment.carrier ?? ""} ${segment.flight_number ?? ""} - ${segment.departure_airport_code ?? "?"} to ${segment.destination_airport_code ?? "?"} - ${fmtDateTime(segment.departure_datetime)}`} />)}</Section> : null}
        <Section title="Payments"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}><InfoBox label="Deposit" value={fmtMoney(trip.deposit_amount)} /><InfoBox label="Deposit Due" value={fmtDate(trip.deposit_due_date)} /><InfoBox label="Final Payment Due" value={fmtDate(trip.final_payment_due_date)} /><InfoBox label="Total Paid" value={fmtMoney(trip.total_paid)} /></div></Section>
        <Section title="Documents Shared By Your Advisor">{(tripDocsResult.data ?? []).length > 0 ? <div style={{ display: "grid", gap: 8 }}>{(tripDocsResult.data ?? []).map((doc: any) => <DetailRow key={doc.id} label={doc.document_type ?? "Document"} value={doc.title ?? doc.file_name ?? "Shared document"} />)}</div> : <p style={{ margin: 0, color: "#64748b" }}>No shared documents are listed yet.</p>}</Section>
        <footer style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #dbeaf0", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>Please confirm names, dates, documents, payment details, and travel components with your advisor before departure.</footer>
      </div>
      <style>{`.print-button { border: 0; border-radius: 12px; padding: 10px 14px; background: #123f5b; color: white; font-weight: 800; cursor: pointer; } @media print { body { background: white !important; } main { padding: 0 !important; background: white !important; } .no-print { display: none !important; } main > div { border: 0 !important; border-radius: 0 !important; padding: 0 !important; } }`}</style>
    </main>
  );
}