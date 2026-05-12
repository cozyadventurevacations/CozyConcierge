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

function StepBadge({ step, title }: { step: string; title: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ width: 30, height: 30, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-dark)", color: "#ffffff", fontWeight: 900, fontSize: 13 }}>{step}</span>
      <h2 style={{ margin: 0 }}>{title}</h2>
    </div>
  );
}

export default async function TravelRequestPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

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

  return (
    <PageShell title="Request Travel Planning" subtitle="Tell us what you have in mind, and we will turn it into a planning conversation.">
      <form action={submitTravelRequest} className="stack" style={{ maxWidth: 1120 }}>
        <div className="card stack" style={{ background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)", border: "1px solid #d9ecf2" }}>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Cozy Concierge Intake</p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(260px, 0.7fr)", gap: 18, alignItems: "start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 30 }}>Let us know where you would love to go.</h2>
              <p style={{ margin: "10px 0 0", color: "#667085", lineHeight: 1.6 }}>
                Share the essentials now. Your advisor can refine dates, budget, details, and options with you afterward.
              </p>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {["Trip basics", "Travel style", "Budget and vision"].map((item) => (
                <div key={item} style={{ padding: "10px 12px", borderRadius: 12, background: "#ffffff", border: "1px solid #e6f0f2", fontWeight: 800, color: "var(--accent-dark)" }}>{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="card stack">
          <StepBadge step="1" title="Contact Information" />
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Name</span><input className="input" name="full_name" defaultValue={defaultName} required /></label>
            <label className="stack-sm"><span className="label">Email</span><input className="input" type="email" name="email" defaultValue={clientAccount.email ?? ""} required /></label>
            <label className="stack-sm"><span className="label">Phone Number</span><input className="input" name="phone_number" defaultValue={clientAccount.phone_primary ?? ""} required /></label>
            <label className="stack-sm"><span className="label">Preferred Contact Method</span><select className="select" name="preferred_contact_method" defaultValue="email" required><option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option></select></label>
          </div>
        </div>

        <div className="card stack">
          <StepBadge step="2" title="Trip Basics" />
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Departure Date</span><input className="input" type="date" name="departure_date" required /></label>
            <label className="stack-sm"><span className="label">Return Date</span><input className="input" type="date" name="return_date" required /></label>
            <label className="stack-sm"><span className="label">Number of Travelers</span><input className="input" type="number" name="number_of_travelers" min="1" defaultValue="1" required /></label>
            <label className="stack-sm"><span className="label">Traveler Ages</span><input className="input" name="traveler_ages" placeholder="45, 43, 12" /></label>
          </div>
          <label className="stack-sm"><span className="label">Optional Travel Dates</span><textarea className="textarea" name="optional_travel_dates" rows={3} placeholder="Flexible dates or alternate travel windows" /></label>
        </div>

        <div className="card stack">
          <StepBadge step="3" title="Type of Travel" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {travelTypes.map((type) => (
              <label key={type.value} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid #e6f0f2", borderRadius: 12, background: "#ffffff", cursor: "pointer", lineHeight: 1.35, fontWeight: 700 }}>
                <input type="checkbox" name="travel_types_requested" value={type.value} />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card stack">
          <StepBadge step="4" title="Destination, Budget & Vision" />
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Destination(s)</span><input className="input" name="destinations" placeholder="Alaska cruise, Walt Disney World, Italy" required /></label>
            <label className="stack-sm"><span className="label">Budget</span><select className="select" name="budget" defaultValue=""><option value="">Select a budget range</option><option value="Under $2,500">Under $2,500</option><option value="$2,500-$5,000">$2,500-$5,000</option><option value="$5,000-$10,000">$5,000-$10,000</option><option value="$10,000+">$10,000+</option><option value="Prefer to discuss">Prefer to discuss</option></select></label>
          </div>
          <label className="stack-sm"><span className="label">Tell Us About Your Trip</span><textarea className="textarea" name="trip_vision_notes" rows={5} placeholder="Must-dos, must-avoids, celebrations, accessibility needs, or travel preferences" /></label>
          <label className="stack-sm"><span className="label">Zoom Call Availability</span><textarea className="textarea" name="zoom_call_availability" rows={3} placeholder="Weeknights after 6pm, Tuesday mornings, weekends only" /></label>
        </div>

        <div className="card" style={{ background: "#f7fbfc", border: "1px solid #d9ecf2", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Ready to send?</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>Your advisor will review this and follow up with next steps.</p>
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
