import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedContactMethods = ["email", "text", "phone"];

const travelTypes = [
  { value: "tour", label: "Tour" },
  { value: "cruise", label: "Cruise" },
  { value: "air", label: "Air" },
  { value: "hotel", label: "Hotel" },
  { value: "transfer", label: "Transfer" },
  { value: "theme_park", label: "Theme Park" },
  { value: "rental_car", label: "Rental Car" },
  { value: "rail", label: "Rail" },
  { value: "vacation_package", label: "Vacation Package" },
  { value: "insurance", label: "Insurance" },
  { value: "activity", label: "Activity / Excursion" },
];

const allowedTravelTypes = travelTypes.map((type) => type.value);
const askCozyTravelRequestPrompt =
  "Help me build a complete travel request. Ask me for the destination, dates, travelers, travel type, budget, trip vision, and anything Jeremy needs. When I say I am ready, submit the travel request for Jeremy to review.";

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) throw new Error("Your login account does not have an email address.");

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, phone_primary")
    .ilike("email", userEmail)
    .maybeSingle();

  if (clientEmailError) throw new Error(clientEmailError.message);
  if (clientAccountByEmail) return { supabase, user, clientAccount: clientAccountByEmail };

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!userProfile) throw new Error("User profile not found.");

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, phone_primary")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) throw new Error(clientProfileError.message);
  if (!clientAccountByProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: clientAccountByProfile };
}

async function submitTravelRequest(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();
  const numberOfTravelersRaw = String(formData.get("number_of_travelers") ?? "1").trim();
  const numberOfTravelers = Number(numberOfTravelersRaw);

  if (!numberOfTravelersRaw || Number.isNaN(numberOfTravelers) || numberOfTravelers < 1) throw new Error("Number of travelers must be at least 1.");

  const preferredContactMethod = String(formData.get("preferred_contact_method") ?? "email").trim();
  if (!allowedContactMethods.includes(preferredContactMethod)) throw new Error("Invalid preferred contact method.");

  const travelTypesRequested = formData.getAll("travel_types_requested").map(String).filter((type) => allowedTravelTypes.includes(type));
  const travelerAgesRaw = String(formData.get("traveler_ages") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim() || `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || clientAccount.email;
  const phoneNumber = String(formData.get("phone_number") ?? "").trim() || clientAccount.phone_primary;
  const departureDate = String(formData.get("departure_date") ?? "").trim();
  const returnDate = String(formData.get("return_date") ?? "").trim();
  const destinations = String(formData.get("destinations") ?? "").trim();

  if (!fullName) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (!phoneNumber) throw new Error("Phone number is required.");
  if (!departureDate) throw new Error("Departure date is required.");
  if (!returnDate) throw new Error("Return date is required.");
  if (!destinations) throw new Error("Destination is required.");
  if (!travelTypesRequested.length) throw new Error("At least one travel type is required.");

  const payload = {
    client_account_id: clientAccount.id,
    full_name: fullName,
    email,
    phone_number: phoneNumber,
    preferred_contact_method: preferredContactMethod,
    departure_date: departureDate,
    return_date: returnDate,
    optional_travel_dates: String(formData.get("optional_travel_dates") ?? "").trim() || null,
    number_of_travelers: numberOfTravelers,
    traveler_ages: travelerAgesRaw ? travelerAgesRaw.split(",").map((age) => age.trim()).filter(Boolean) : null,
    travel_types_requested: travelTypesRequested,
    destinations,
    budget: String(formData.get("budget") ?? "").trim() || null,
    trip_vision_notes: String(formData.get("trip_vision_notes") ?? "").trim() || null,
    zoom_call_availability: String(formData.get("zoom_call_availability") ?? "").trim() || null,
    status: "new",
  };

  const { error: insertError } = await supabase.from("quote_requests").insert(payload);
  if (insertError) throw new Error(insertError.message);
  redirect("/trips?travel_request=submitted");
}

function StepBadge({ step, title, helper }: { step: string; title: string; helper: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ width: 34, height: 34, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-dark)", color: "#ffffff", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{step}</span>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 14 }}>{helper}</p>
      </div>
    </div>
  );
}

function IntakeSection({ step, title, helper, children }: { step: string; title: string; helper: string; children: React.ReactNode }) {
  return (
    <section className="card stack" style={{ border: "1px solid #e6f0f2", boxShadow: "0 12px 30px rgba(18, 63, 91, 0.04)" }}>
      <StepBadge step={step} title={title} helper={helper} />
      {children}
    </section>
  );
}

function ExpectationCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "#ffffff", border: "1px solid #e6f0f2" }}>
      <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>{title}</p>
      <p style={{ margin: "5px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>{detail}</p>
    </div>
  );
}

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function TravelRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;
  const resolvedSearchParams = (await searchParams) ?? {};
  const prefillSource = getSearchValue(resolvedSearchParams, "source");
  const prefilledDestination = getSearchValue(resolvedSearchParams, "destinations");
  const prefilledDepartureDate = getSearchValue(resolvedSearchParams, "departure_date");
  const prefilledReturnDate = getSearchValue(resolvedSearchParams, "return_date");
  const prefilledTripVisionNotes = getSearchValue(resolvedSearchParams, "trip_vision_notes");

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell title="Request Travel Planning" subtitle="We could not load your client account.">
        <div className="card"><p><strong>Error:</strong></p><p>{error instanceof Error ? error.message : "Client account not found."}</p></div>
      </PageShell>
    );
  }

  const { clientAccount } = clientContext;
  const defaultName = `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim();
  const cameFromAskCozy = prefillSource === "ask-cozy";

  return (
    <PageShell title="Request Travel Planning" subtitle="Share the spark. We will help shape it into a trip worth looking forward to.">
      <form action={submitTravelRequest} className="stack" style={{ maxWidth: 1120 }}>
        {cameFromAskCozy ? (
          <section
            className="card"
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
            }}
          >
            <p style={{ margin: 0, fontWeight: 900 }}>Ask Cozy added a head start.</p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
              Review the prefilled destination, dates, and planning note below, then finish any missing details before sending this to Jeremy.
            </p>
          </section>
        ) : null}

        {!cameFromAskCozy ? (
          <section
            className="card"
            style={{
              border: "1px solid #bfdbfe",
              background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 72%)",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ maxWidth: 720 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>
                Want help shaping the idea?
              </p>
              <h2 style={{ margin: "4px 0 0" }}>Start planning with Ask Cozy</h2>
              <p style={{ margin: "6px 0 0", color: "#5e7e8f", lineHeight: 1.55 }}>
                Ask Cozy can gather the details in conversation, help refine the trip vision, and submit a travel request to Jeremy when you say you are ready.
              </p>
            </div>
            <Link
              href={`/ask-cozy?question=${encodeURIComponent(askCozyTravelRequestPrompt)}`}
              className="btn btn-primary"
              style={{ flexShrink: 0 }}
            >
              Plan With Ask Cozy
            </Link>
          </section>
        ) : null}

        <section className="card" style={{ background: "linear-gradient(135deg, #eef7fb 0%, #ffffff 64%, #f7fbfc 100%)", border: "1px solid #d9ecf2", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)", gap: 20, alignItems: "stretch" }}>
            <div className="stack" style={{ justifyContent: "center" }}>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Cozy Concierge Intake</p>
              <h2 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05 }}>Tell us what kind of getaway you have in mind.</h2>
              <p style={{ margin: 0, color: "#5e7e8f", lineHeight: 1.65, maxWidth: 680 }}>
                You do not need every answer yet. Dates, destination ideas, travel style, and a few preferences are enough for Jeremy to start shaping thoughtful options.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ borderRadius: 999, padding: "7px 11px", background: "#ffffff", border: "1px solid #dbeafe", color: "var(--accent-dark)", fontSize: 13, fontWeight: 800 }}>Personal planning</span>
                <span style={{ borderRadius: 999, padding: "7px 11px", background: "#ffffff", border: "1px solid #dbeafe", color: "var(--accent-dark)", fontSize: 13, fontWeight: 800 }}>No pressure</span>
                <span style={{ borderRadius: 999, padding: "7px 11px", background: "#ffffff", border: "1px solid #dbeafe", color: "var(--accent-dark)", fontSize: 13, fontWeight: 800 }}>Advisor reviewed</span>
              </div>
            </div>

            <aside className="stack" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid #e6f0f2", borderRadius: 18, padding: 16 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>What happens next</p>
              <ExpectationCard title="1. Jeremy reviews it" detail="Your request lands with your advisor, not a generic queue." />
              <ExpectationCard title="2. Details get refined" detail="Flexible dates, budget, pace, room type, and must-dos can all be adjusted together." />
              <ExpectationCard title="3. Options are prepared" detail="You will receive next steps or a planning conversation based on what you share here." />
            </aside>
          </div>
        </section>

        <IntakeSection step="1" title="Contact Information" helper="This lets your advisor follow up in the way you prefer.">
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Name</span><input className="input" name="full_name" defaultValue={defaultName} required /></label>
            <label className="stack-sm"><span className="label">Email</span><input className="input" type="email" name="email" defaultValue={clientAccount.email ?? ""} required /></label>
            <label className="stack-sm"><span className="label">Phone Number</span><input className="input" name="phone_number" defaultValue={clientAccount.phone_primary ?? ""} required /></label>
            <label className="stack-sm"><span className="label">Preferred Contact Method</span><select className="select" name="preferred_contact_method" defaultValue="email" required><option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option></select></label>
          </div>
        </IntakeSection>

        <IntakeSection step="2" title="Trip Basics" helper="Share the dates and travelers. Flexible windows are welcome.">
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Departure Date</span><input className="input" type="date" name="departure_date" defaultValue={prefilledDepartureDate} required /></label>
            <label className="stack-sm"><span className="label">Return Date</span><input className="input" type="date" name="return_date" defaultValue={prefilledReturnDate} required /></label>
            <label className="stack-sm"><span className="label">Number of Travelers</span><input className="input" type="number" name="number_of_travelers" min="1" defaultValue="1" required /></label>
            <label className="stack-sm"><span className="label">Traveler Ages</span><input className="input" name="traveler_ages" placeholder="45, 43, 12" /></label>
          </div>
          <label className="stack-sm"><span className="label">Optional Travel Dates</span><textarea className="textarea" name="optional_travel_dates" rows={3} placeholder="Flexible dates, alternate travel windows, school breaks, or dates to avoid" /></label>
        </IntakeSection>

        <IntakeSection step="3" title="Type of Travel" helper="Choose everything that might apply. Your advisor can narrow it down later.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {travelTypes.map((type) => (
              <label key={type.value} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 12px", border: "1px solid #e6f0f2", borderRadius: 12, background: "#ffffff", cursor: "pointer", lineHeight: 1.35, fontWeight: 800, color: "var(--accent-dark)" }}>
                <input type="checkbox" name="travel_types_requested" value={type.value} />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </IntakeSection>

        <IntakeSection step="4" title="Destination, Budget & Vision" helper="The more personality you add here, the better the first round of ideas can be.">
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Destination(s)</span><input className="input" name="destinations" defaultValue={prefilledDestination} placeholder="Alaska cruise, Walt Disney World, Italy" required /></label>
            <label className="stack-sm"><span className="label">Budget</span><select className="select" name="budget" defaultValue=""><option value="">Select a budget range</option><option value="Under $2,500">Under $2,500</option><option value="$2,500-$5,000">$2,500-$5,000</option><option value="$5,000-$10,000">$5,000-$10,000</option><option value="$10,000+">$10,000+</option><option value="Prefer to discuss">Prefer to discuss</option></select></label>
          </div>
          <label className="stack-sm"><span className="label">Tell Us About Your Trip</span><textarea className="textarea" name="trip_vision_notes" rows={6} defaultValue={prefilledTripVisionNotes} placeholder="Must-dos, must-avoids, celebrations, accessibility needs, resort style, dining preferences, pace, or anything you want Jeremy to know" /></label>
          <label className="stack-sm"><span className="label">Zoom Call Availability</span><textarea className="textarea" name="zoom_call_availability" rows={3} placeholder="Weeknights after 6pm, Tuesday mornings, weekends only" /></label>
        </IntakeSection>

        <div className="card" style={{ background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)", border: "1px solid #d9ecf2", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ maxWidth: 640 }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Ready for review</p>
            <h2 style={{ margin: "4px 0 0" }}>Send your planning request</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>Your advisor will review this and follow up with next steps. You can always refine details later.</p>
          </div>
          <div className="row">
            <button type="submit" className="btn btn-primary">Submit Travel Request</button>
            <Link href="/trips" className="btn btn-outline">Back to My Trips</Link>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
