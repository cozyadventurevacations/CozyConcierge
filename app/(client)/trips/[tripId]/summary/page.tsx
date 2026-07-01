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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function InfoBox({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "neutral" | "good" | "warning" }) {
  const colors = {
    neutral: { border: "#dbeaf0", background: "#ffffff", label: "#64748b" },
    good: { border: "#bbf7d0", background: "#f0fdf4", label: "#166534" },
    warning: { border: "#fed7aa", background: "#fff7ed", label: "#92400e" },
  }[tone];

  return (
    <div style={{ border: `1px solid ${colors.border}`, background: colors.background, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.label, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 5, fontWeight: 900, color: "#123f5b", lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="print-section" style={{ borderTop: "2px solid #dbeaf0", paddingTop: 20, marginTop: 26 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 21, color: "#123f5b" }}>{title}</h2>
        {subtitle ? <p style={{ margin: "5px 0 0", color: "#64748b", lineHeight: 1.45 }}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0, 1fr)", gap: 10, padding: "9px 0", borderBottom: "1px solid #eef4f6" }}>
      <strong style={{ color: "#64748b" }}>{label}</strong>
      <span className="preserve-formatting" style={{ lineHeight: 1.45 }}>{value || "Not provided"}</span>
    </div>
  );
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

  const [tripDocsResult, hotelResult, cruiseResult, airResult, transferResult, activityResult, insuranceResult, proposalResult] = await Promise.all([
    supabase.from("trip_documents").select("id, file_name, component_type, created_at").eq("trip_id", tripId).eq("visibility", "client").order("created_at", { ascending: false }),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "hotel").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "cruise").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "air").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "transfer").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "activity").maybeSingle(),
    supabase.from("trip_components").select("*").eq("trip_id", tripId).eq("component_type", "insurance").maybeSingle(),
    supabase.from("trip_proposals").select("planning_fee").eq("trip_id", tripId).maybeSingle(),
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

  const sharedDocs = tripDocsResult.data ?? [];
  const hasBalance = typeof trip.balance_due === "number" && trip.balance_due > 0;
  const generatedDate = fmtDate(new Date().toISOString());
  const componentPriceTotal = [
    hotelResult.data?.total_price,
    cruiseResult.data?.total_price,
    airResult.data?.total_price,
    transferResult.data?.total_price,
    activityResult.data?.total_price,
    insuranceResult.data?.total_price,
  ].reduce((sum, value) => sum + Number(value ?? 0), 0);
  const calculatedTripTotal = roundMoney(componentPriceTotal + Number(proposalResult.data?.planning_fee ?? 0));

  return (
    <main style={{ minHeight: "100vh", background: "#f7fafb", color: "#123f5b", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto", background: "#ffffff", border: "1px solid #dbeaf0", borderRadius: 18, padding: 30, boxShadow: "0 18px 50px rgba(18, 63, 91, 0.08)" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
          <Link href={`/trips/${tripId}`} style={{ fontWeight: 900, color: "#123f5b", textDecoration: "none" }}>Back to Trip</Link>
          <button type="button" className="print-button">Print / Save PDF</button>
        </div>
        <script dangerouslySetInnerHTML={{ __html: "document.addEventListener('click',function(e){if(e.target&&e.target.className==='print-button'){window.print();}});" }} />

        <header style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={150} height={75} priority />
            <div style={{ textAlign: "right", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
              <strong style={{ color: "#123f5b" }}>Cozy Concierge Trip Summary</strong><br />
              Generated {generatedDate}<br />
              cozyadventurevacations.com
            </div>
          </div>

          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid #dbeaf0", minHeight: coverImageUrl ? 280 : 220, background: "linear-gradient(135deg, #eef7fb 0%, #ffffff 70%)" }}>
            {coverImageUrl ? <img src={coverImageUrl} alt="Trip cover" style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} /> : <div style={{ minHeight: 220, display: "grid", placeItems: "center", padding: 24 }}><Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={220} height={110} /></div>}
            <div style={{ position: "absolute", inset: 0, background: coverImageUrl ? "linear-gradient(180deg, rgba(18,63,91,0.05) 0%, rgba(18,63,91,0.75) 100%)" : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(240,247,248,0.82) 100%)" }} />
            <div style={{ position: "absolute", left: 24, right: 24, bottom: 22, color: coverImageUrl ? "#ffffff" : "#123f5b" }}>
              <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 900 }}>Travel Packet</p>
              <h1 style={{ margin: "6px 0 0", fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.05 }}>{trip.trip_name ?? "Your Trip"}</h1>
              <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{trip.destinations ?? "Destination details will appear here as your trip is finalized."}</p>
            </div>
          </div>
        </header>

        <Section title="Trip Snapshot" subtitle="The essential trip details at a glance.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <InfoBox label="Departure" value={fmtDate(trip.departure_date)} />
            <InfoBox label="Return" value={fmtDate(trip.return_date)} />
            <InfoBox label="Status" value={trip.trip_status ?? "Not provided"} />
            <InfoBox label="Balance Due" value={fmtMoney(trip.balance_due)} tone={hasBalance ? "warning" : "good"} />
          </div>
        </Section>

        {events.length > 0 ? (
          <Section title="Itinerary Timeline" subtitle="A chronological view of the major scheduled moments.">
            <div style={{ display: "grid", gap: 0 }}>
              {events.map((event, index) => (
                <div key={`${event.date}-${index}`} style={{ display: "grid", gridTemplateColumns: "175px minmax(0, 1fr)", gap: 12, padding: "12px 0", borderBottom: "1px solid #eef4f6" }}>
                  <strong>{fmtDateTime(event.date)}</strong>
                  <div><strong>{event.title}</strong><div style={{ color: "#64748b", marginTop: 3, lineHeight: 1.45 }}>{event.detail}</div></div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {hotelDetails.data || cruiseDetails.data || flightSegments.length > 0 || transferDetails.data || activityDetails.data ? (
          <Section title="Travel Details" subtitle="Supplier and component details shared for review.">
            {hotelDetails.data ? <><DetailRow label="Hotel" value={hotelDetails.data.hotel_name} /><DetailRow label="Check-in" value={fmtDate(hotelDetails.data.check_in_date)} /><DetailRow label="Check-out" value={fmtDate(hotelDetails.data.check_out_date)} /><DetailRow label="Confirmation" value={hotelResult.data?.confirmation_number} /></> : null}
            {cruiseDetails.data ? <><DetailRow label="Cruise" value={`${cruiseDetails.data.cruise_line ?? ""} ${cruiseDetails.data.ship_name ?? ""}`.trim()} /><DetailRow label="Sailing" value={fmtDate(cruiseDetails.data.sailing_date)} /><DetailRow label="Return" value={fmtDate(cruiseDetails.data.return_date)} /><DetailRow label="Cabin" value={cruiseDetails.data.cabin_number || cruiseDetails.data.cabin_category} /></> : null}
            {flightSegments.map((segment, index) => <DetailRow key={segment.id ?? index} label={`Flight ${index + 1}`} value={`${segment.carrier ?? ""} ${segment.flight_number ?? ""} - ${segment.departure_airport_code ?? "?"} to ${segment.destination_airport_code ?? "?"} - ${fmtDateTime(segment.departure_datetime)}`} />)}
            {transferDetails.data ? <DetailRow label="Transfer" value={`${transferDetails.data.pickup_location ?? "Pickup"} to ${transferDetails.data.dropoff_location ?? "Dropoff"} - ${fmtDateTime(transferDetails.data.pickup_datetime)}`} /> : null}
            {activityDetails.data ? <DetailRow label="Activity" value={`${activityDetails.data.activity_name ?? "Activity"} - ${fmtDateTime(activityDetails.data.activity_datetime)}`} /> : null}
          </Section>
        ) : null}

        <Section title="Payments" subtitle="Payment details shown in this summary are for quick reference.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <InfoBox label="Deposit" value={fmtMoney(trip.deposit_amount)} />
            <InfoBox label="Deposit Due" value={fmtDate(trip.deposit_due_date)} />
            <InfoBox label="Final Payment Due" value={fmtDate(trip.final_payment_due_date)} />
            <InfoBox label="Calculated Trip Total" value={fmtMoney(calculatedTripTotal)} />
            <InfoBox label="Total Paid" value={fmtMoney(trip.total_paid)} />
          </div>
        </Section>

        <Section title="Documents Shared By Your Advisor" subtitle="Files listed here are available in your Cozy Concierge trip documents area.">
          {sharedDocs.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {sharedDocs.map((doc: any) => <DetailRow key={doc.id} label={doc.component_type ?? "Document"} value={doc.file_name ?? "Shared document"} />)}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#64748b" }}>No shared documents are listed yet.</p>
          )}
        </Section>

        <Section title="Advisor" subtitle="Your advisor is here if anything needs clarification.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <InfoBox label="Advisor" value="Jeremy Brown" />
            <InfoBox label="Email" value="jeremyb@cozyadventurevacations.com" />
            <InfoBox label="Agency" value="Cozy Adventure Vacations" />
          </div>
        </Section>

        <footer style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #dbeaf0", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
          Please confirm names, dates, documents, payment details, and travel components with your advisor before departure. This printable summary is a convenient reference, not a replacement for supplier confirmations or official travel documents.
        </footer>
      </div>
      <style>{`.print-button { border: 0; border-radius: 12px; padding: 10px 14px; background: #123f5b; color: white; font-weight: 900; cursor: pointer; } @media print { body { background: white !important; } main { padding: 0 !important; background: white !important; } .no-print { display: none !important; } main > div { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; } .print-section { break-inside: avoid; page-break-inside: avoid; } a { color: inherit !important; text-decoration: none !important; } }`}</style>
    </main>
  );
}
