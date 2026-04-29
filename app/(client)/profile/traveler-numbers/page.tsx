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

type TravelerProfile = {
  id: string;
  client_account_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  known_traveler_number: string | null;
  redress_number: string | null;
  global_entry_passid: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiration_date: string | null;
  notes: string | null;
  created_at: string | null;
};

type LoyaltyNumber = {
  id: string;
  traveler_profile_id: string;
  client_account_id: string;
  loyalty_type: string;
  company_name: string;
  program_name: string | null;
  loyalty_number: string;
  traveler_name_snapshot: string | null;
  notes: string | null;
  created_at: string | null;
};

const VALID_LOYALTY_TYPES = [
  "airline",
  "hotel",
  "cruise",
  "rental_car",
  "rail",
  "theme_park",
  "credit_card",
  "tour",
  "vacation_package",
  "other",
];

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function buildTravelerNotes(formData: FormData) {
  const otherTravelerNumbers = cleanText(formData, "other_traveler_numbers");
  const notes = cleanText(formData, "notes");

  const parts: string[] = [];

  if (otherTravelerNumbers) {
    parts.push(`Other Traveler Numbers / IDs: ${otherTravelerNumbers}`);
  }

  if (notes) {
    parts.push(notes);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function formatDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTravelerName(traveler: TravelerProfile | null | undefined) {
  if (!traveler) return "Unnamed Traveler";

  return `${traveler.first_name ?? ""} ${traveler.middle_name ?? ""} ${
    traveler.last_name ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim() || "Unnamed Traveler";
}

function getClientName(client: ClientAccount | null | undefined) {
  if (!client) return "Unknown Client";

  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed Client";
}

function getLoyaltyTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "airline":
      return "Airline";
    case "hotel":
      return "Hotel";
    case "cruise":
      return "Cruise";
    case "rental_car":
      return "Rental Car";
    case "rail":
      return "Rail";
    case "theme_park":
      return "Theme Park";
    case "credit_card":
      return "Credit Card Travel Program";
    case "tour":
      return "Tour / Activity";
    case "vacation_package":
      return "Vacation Package / Supplier";
    default:
      return "Other";
  }
}

function LoyaltyTypeBadge({ type }: { type: string | null | undefined }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: "#f0f7f8",
        color: "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {getLoyaltyTypeLabel(type)}
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

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientAccountByEmail) {
    return {
      supabase,
      user,
      clientAccount: clientAccountByEmail as ClientAccount,
    };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) {
    throw new Error(clientProfileError.message);
  }

  if (!clientAccountByProfile) {
    throw new Error("Client account not found.");
  }

  return {
    supabase,
    user,
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

async function addTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const firstName = cleanText(formData, "first_name");
  const lastName = cleanText(formData, "last_name");

  if (!firstName && !lastName) {
    throw new Error("Please enter at least a first or last name.");
  }

  const payload = {
    client_account_id: clientAccount.id,
    first_name: firstName,
    middle_name: cleanText(formData, "middle_name"),
    last_name: lastName,
    date_of_birth: cleanText(formData, "date_of_birth"),
    known_traveler_number: cleanText(formData, "known_traveler_number"),
    redress_number: cleanText(formData, "redress_number"),
    global_entry_passid: cleanText(formData, "global_entry_passid"),
    passport_number: cleanText(formData, "passport_number"),
    passport_country: cleanText(formData, "passport_country"),
    passport_expiration_date: cleanText(formData, "passport_expiration_date"),
    notes: buildTravelerNotes(formData),
  };

  const { error } = await supabase.from("traveler_profiles").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function updateTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  const payload = {
    first_name: cleanText(formData, "first_name"),
    middle_name: cleanText(formData, "middle_name"),
    last_name: cleanText(formData, "last_name"),
    date_of_birth: cleanText(formData, "date_of_birth"),
    known_traveler_number: cleanText(formData, "known_traveler_number"),
    redress_number: cleanText(formData, "redress_number"),
    global_entry_passid: cleanText(formData, "global_entry_passid"),
    passport_number: cleanText(formData, "passport_number"),
    passport_country: cleanText(formData, "passport_country"),
    passport_expiration_date: cleanText(formData, "passport_expiration_date"),
    notes: buildTravelerNotes(formData),
  };

  const { error } = await supabase
    .from("traveler_profiles")
    .update(payload)
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function deleteTravelerProfile(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_id") ?? "").trim();

  if (!travelerId) {
    throw new Error("Missing traveler ID.");
  }

  const { error } = await supabase
    .from("traveler_profiles")
    .delete()
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function addLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const travelerId = String(formData.get("traveler_profile_id") ?? "").trim();
  const loyaltyType = String(formData.get("loyalty_type") ?? "airline").trim();
  const companyName = cleanText(formData, "company_name");
  const loyaltyNumber = cleanText(formData, "loyalty_number");

  if (!travelerId) {
    throw new Error("Please choose a traveler.");
  }

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  if (!loyaltyNumber) {
    throw new Error("Loyalty number is required.");
  }

  if (!VALID_LOYALTY_TYPES.includes(loyaltyType)) {
    throw new Error("Invalid loyalty type.");
  }

  const { data: traveler, error: travelerError } = await supabase
    .from("traveler_profiles")
    .select("id, first_name, middle_name, last_name")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  const travelerName = `${traveler.first_name ?? ""} ${traveler.middle_name ?? ""} ${
    traveler.last_name ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim();

  const { error } = await supabase.from("traveler_loyalty_numbers").insert({
    traveler_profile_id: travelerId,
    client_account_id: clientAccount.id,
    loyalty_type: loyaltyType,
    company_name: companyName,
    program_name: cleanText(formData, "program_name"),
    loyalty_number: loyaltyNumber,
    traveler_name_snapshot: travelerName || null,
    notes: cleanText(formData, "notes"),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function updateLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const loyaltyId = String(formData.get("loyalty_id") ?? "").trim();
  const travelerId = String(formData.get("traveler_profile_id") ?? "").trim();
  const loyaltyType = String(formData.get("loyalty_type") ?? "airline").trim();
  const companyName = cleanText(formData, "company_name");
  const loyaltyNumber = cleanText(formData, "loyalty_number");

  if (!loyaltyId) {
    throw new Error("Missing loyalty ID.");
  }

  if (!travelerId) {
    throw new Error("Please choose a traveler.");
  }

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  if (!loyaltyNumber) {
    throw new Error("Loyalty number is required.");
  }

  if (!VALID_LOYALTY_TYPES.includes(loyaltyType)) {
    throw new Error("Invalid loyalty type.");
  }

  const { data: traveler, error: travelerError } = await supabase
    .from("traveler_profiles")
    .select("id, first_name, middle_name, last_name")
    .eq("id", travelerId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (travelerError || !traveler) {
    throw new Error(travelerError?.message ?? "Traveler not found.");
  }

  const travelerName = `${traveler.first_name ?? ""} ${traveler.middle_name ?? ""} ${
    traveler.last_name ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim();

  const { error } = await supabase
    .from("traveler_loyalty_numbers")
    .update({
      traveler_profile_id: travelerId,
      loyalty_type: loyaltyType,
      company_name: companyName,
      program_name: cleanText(formData, "program_name"),
      loyalty_number: loyaltyNumber,
      traveler_name_snapshot: travelerName || null,
      notes: cleanText(formData, "notes"),
    })
    .eq("id", loyaltyId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

async function deleteLoyaltyNumber(formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const loyaltyId = String(formData.get("loyalty_id") ?? "").trim();

  if (!loyaltyId) {
    throw new Error("Missing loyalty ID.");
  }

  const { error } = await supabase
    .from("traveler_loyalty_numbers")
    .delete()
    .eq("id", loyaltyId)
    .eq("client_account_id", clientAccount.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile/traveler-numbers");
}

export default async function TravelerNumbersPage() {
  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: travelers, error: travelersError } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .order("created_at", { ascending: true });

  const travelerRows = (travelers ?? []) as TravelerProfile[];

  const { data: loyaltyNumbers, error: loyaltyError } = await supabase
    .from("traveler_loyalty_numbers")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .order("created_at", { ascending: false });

  const loyaltyRows = (loyaltyNumbers ?? []) as LoyaltyNumber[];

  return (
    <PageShell
      title="Traveler Numbers"
      subtitle="Store trusted traveler numbers, redress numbers, passport reference details, and rewards memberships for your travel profile."
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

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          Traveler Numbers & Rewards Memberships
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Add Known Traveler Numbers, Redress Numbers, Global Entry PASSIDs,
          passport reference details, frequent flyer numbers, hotel loyalty numbers,
          cruise loyalty numbers, rental car numbers, theme park rewards, credit card
          travel programs, rail memberships, tour memberships, and other travel-related
          account numbers.
        </p>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Profile owner: <strong>{getClientName(clientAccount)}</strong>
          {clientAccount.email ? ` — ${clientAccount.email}` : ""}
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile" className="btn btn-outline">
            Back to Profile
          </Link>

          <Link href="/dashboard" className="btn btn-outline">
            Dashboard
          </Link>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          border: "1px solid #fed7aa",
          background: "#fff7ed",
        }}
      >
        <h2 style={{ margin: 0 }}>Sensitive Information Notice</h2>

        <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
          Trusted traveler numbers, passport details, and rewards membership numbers
          may be sensitive. Only add information you want stored in your secure Cozy
          Concierge profile for travel planning and reservation support. Do not store
          passwords here.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Add Traveler</h2>

        <form action={addTravelerProfile} className="stack">
          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">First Name</span>
              <input className="input" name="first_name" />
            </label>

            <label className="stack-sm">
              <span className="label">Middle Name</span>
              <input className="input" name="middle_name" />
            </label>

            <label className="stack-sm">
              <span className="label">Last Name</span>
              <input className="input" name="last_name" />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Date of Birth</span>
              <input className="input" type="date" name="date_of_birth" />
            </label>

            <label className="stack-sm">
              <span className="label">Known Traveler Number / KTN</span>
              <input className="input" name="known_traveler_number" />
            </label>

            <label className="stack-sm">
              <span className="label">Redress Number</span>
              <input className="input" name="redress_number" />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Global Entry PASSID</span>
              <input className="input" name="global_entry_passid" />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Number</span>
              <input className="input" name="passport_number" />
            </label>

            <label className="stack-sm">
              <span className="label">Passport Country</span>
              <input className="input" name="passport_country" placeholder="Example: US" />
            </label>
          </div>

          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Passport Expiration Date</span>
              <input className="input" type="date" name="passport_expiration_date" />
            </label>

            <label className="stack-sm">
              <span className="label">Other Traveler Numbers / IDs</span>
              <input
                className="input"
                name="other_traveler_numbers"
                placeholder="Example: NEXUS, SENTRI, military ID, agency ID, etc."
              />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Notes</span>
            <textarea
              className="input"
              name="notes"
              placeholder="Optional traveler notes"
              rows={3}
            />
          </label>

          <button type="submit" className="btn btn-primary">
            Add Traveler
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Add New Rewards Membership</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Add airline, hotel, cruise, rental car, theme park, rail, credit card travel
          program, tour, vacation package, or other rewards membership numbers here.
        </p>

        {travelerRows.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Add a traveler profile first, then you can add rewards memberships.
          </p>
        ) : (
          <form action={addLoyaltyNumber} className="stack">
            <div className="grid grid-3">
              <label className="stack-sm">
                <span className="label">Traveler</span>
                <select className="select" name="traveler_profile_id" required>
                  <option value="">Choose traveler</option>
                  {travelerRows.map((traveler) => (
                    <option key={traveler.id} value={traveler.id}>
                      {getTravelerName(traveler)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack-sm">
                <span className="label">Rewards Type</span>
                <select className="select" name="loyalty_type" defaultValue="airline">
                  <option value="airline">Airline</option>
                  <option value="hotel">Hotel</option>
                  <option value="cruise">Cruise Line</option>
                  <option value="rental_car">Rental Car</option>
                  <option value="rail">Rail</option>
                  <option value="theme_park">Theme Park</option>
                  <option value="credit_card">Credit Card Travel Program</option>
                  <option value="tour">Tour / Activity</option>
                  <option value="vacation_package">Vacation Package / Supplier</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="stack-sm">
                <span className="label">Company Name</span>
                <input
                  className="input"
                  name="company_name"
                  placeholder="Example: American Airlines, Hilton, Disney, Royal Caribbean"
                  required
                />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="stack-sm">
                <span className="label">Program Name</span>
                <input
                  className="input"
                  name="program_name"
                  placeholder="Example: AAdvantage, Hilton Honors, Castaway Club"
                />
              </label>

              <label className="stack-sm">
                <span className="label">Rewards / Membership Number</span>
                <input className="input" name="loyalty_number" required />
              </label>

              <label className="stack-sm">
                <span className="label">Notes</span>
                <input
                  className="input"
                  name="notes"
                  placeholder="Optional notes. Do not store passwords."
                />
              </label>
            </div>

            <button type="submit" className="btn btn-primary">
              Add Rewards Membership
            </button>
          </form>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Traveler Profiles & Existing Rewards Memberships</h2>

        {travelersError ? (
          <div>
            <p>
              <strong>Error loading travelers:</strong>
            </p>
            <pre>{JSON.stringify(travelersError, null, 2)}</pre>
          </div>
        ) : loyaltyError ? (
          <div>
            <p>
              <strong>Error loading loyalty numbers:</strong>
            </p>
            <pre>{JSON.stringify(loyaltyError, null, 2)}</pre>
          </div>
        ) : travelerRows.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No traveler profiles have been added yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {travelerRows.map((traveler) => {
              const travelerLoyaltyRows = loyaltyRows.filter(
                (loyalty) => loyalty.traveler_profile_id === traveler.id,
              );

              return (
                <div
                  key={traveler.id}
                  className="card stack"
                  style={{ background: "#fbfdfe" }}
                >
                  <form action={updateTravelerProfile} className="stack">
                    <input type="hidden" name="traveler_id" value={traveler.id} />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0 }}>{getTravelerName(traveler)}</h3>
                        <p style={{ margin: "4px 0 0", color: "#667085" }}>
                          Added {formatDateTime(traveler.created_at)}
                        </p>
                      </div>

                      <p style={{ margin: 0, color: "#667085" }}>
                        Rewards Memberships:{" "}
                        <strong>{travelerLoyaltyRows.length}</strong>
                      </p>
                    </div>

                    <div className="grid grid-3">
                      <label className="stack-sm">
                        <span className="label">First Name</span>
                        <input
                          className="input"
                          name="first_name"
                          defaultValue={traveler.first_name ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Middle Name</span>
                        <input
                          className="input"
                          name="middle_name"
                          defaultValue={traveler.middle_name ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Last Name</span>
                        <input
                          className="input"
                          name="last_name"
                          defaultValue={traveler.last_name ?? ""}
                        />
                      </label>
                    </div>

                    <div className="grid grid-3">
                      <label className="stack-sm">
                        <span className="label">Date of Birth</span>
                        <input
                          className="input"
                          type="date"
                          name="date_of_birth"
                          defaultValue={traveler.date_of_birth ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Known Traveler Number / KTN</span>
                        <input
                          className="input"
                          name="known_traveler_number"
                          defaultValue={traveler.known_traveler_number ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Redress Number</span>
                        <input
                          className="input"
                          name="redress_number"
                          defaultValue={traveler.redress_number ?? ""}
                        />
                      </label>
                    </div>

                    <div className="grid grid-3">
                      <label className="stack-sm">
                        <span className="label">Global Entry PASSID</span>
                        <input
                          className="input"
                          name="global_entry_passid"
                          defaultValue={traveler.global_entry_passid ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Passport Number</span>
                        <input
                          className="input"
                          name="passport_number"
                          defaultValue={traveler.passport_number ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Passport Country</span>
                        <input
                          className="input"
                          name="passport_country"
                          defaultValue={traveler.passport_country ?? ""}
                        />
                      </label>
                    </div>

                    <div className="grid grid-2">
                      <label className="stack-sm">
                        <span className="label">Passport Expiration Date</span>
                        <input
                          className="input"
                          type="date"
                          name="passport_expiration_date"
                          defaultValue={traveler.passport_expiration_date ?? ""}
                        />
                      </label>

                      <label className="stack-sm">
                        <span className="label">Other Traveler Numbers / IDs</span>
                        <input
                          className="input"
                          name="other_traveler_numbers"
                          placeholder="Example: NEXUS, SENTRI, military ID, agency ID, etc."
                        />
                      </label>
                    </div>

                    <label className="stack-sm">
                      <span className="label">Notes</span>
                      <textarea
                        className="input"
                        name="notes"
                        defaultValue={traveler.notes ?? ""}
                        rows={3}
                      />
                    </label>

                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <button type="submit" className="btn btn-primary">
                        Save Traveler
                      </button>
                    </div>
                  </form>

                  <form action={deleteTravelerProfile}>
                    <input type="hidden" name="traveler_id" value={traveler.id} />
                    <button type="submit" className="btn btn-outline">
                      Delete Traveler
                    </button>
                  </form>

                  <div className="card stack" style={{ background: "#ffffff" }}>
                    <h4 style={{ margin: 0 }}>
                      Existing Rewards Memberships for This Traveler
                    </h4>

                    {travelerLoyaltyRows.length === 0 ? (
                      <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                        No rewards memberships added for this traveler yet.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {travelerLoyaltyRows.map((loyalty) => (
                          <div
                            key={loyalty.id}
                            className="card stack"
                            style={{
                              background: "#fbfdfe",
                              border: "1px solid #e6f0f2",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <LoyaltyTypeBadge type={loyalty.loyalty_type} />
                                <h5 style={{ margin: "8px 0 0", fontSize: 17 }}>
                                  {loyalty.company_name}
                                </h5>
                                <p style={{ margin: "4px 0 0", color: "#667085" }}>
                                  Added {formatDateTime(loyalty.created_at)}
                                </p>
                              </div>
                            </div>

                            <form action={updateLoyaltyNumber} className="stack">
                              <input
                                type="hidden"
                                name="loyalty_id"
                                value={loyalty.id}
                              />

                              <div className="grid grid-3">
                                <label className="stack-sm">
                                  <span className="label">Traveler</span>
                                  <select
                                    className="select"
                                    name="traveler_profile_id"
                                    defaultValue={loyalty.traveler_profile_id}
                                    required
                                  >
                                    {travelerRows.map((travelerOption) => (
                                      <option
                                        key={travelerOption.id}
                                        value={travelerOption.id}
                                      >
                                        {getTravelerName(travelerOption)}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Rewards Type</span>
                                  <select
                                    className="select"
                                    name="loyalty_type"
                                    defaultValue={loyalty.loyalty_type}
                                  >
                                    <option value="airline">Airline</option>
                                    <option value="hotel">Hotel</option>
                                    <option value="cruise">Cruise Line</option>
                                    <option value="rental_car">Rental Car</option>
                                    <option value="rail">Rail</option>
                                    <option value="theme_park">Theme Park</option>
                                    <option value="credit_card">
                                      Credit Card Travel Program
                                    </option>
                                    <option value="tour">Tour / Activity</option>
                                    <option value="vacation_package">
                                      Vacation Package / Supplier
                                    </option>
                                    <option value="other">Other</option>
                                  </select>
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Company Name</span>
                                  <input
                                    className="input"
                                    name="company_name"
                                    defaultValue={loyalty.company_name}
                                    required
                                  />
                                </label>
                              </div>

                              <div className="grid grid-3">
                                <label className="stack-sm">
                                  <span className="label">Program Name</span>
                                  <input
                                    className="input"
                                    name="program_name"
                                    defaultValue={loyalty.program_name ?? ""}
                                  />
                                </label>

                                <label className="stack-sm">
                                  <span className="label">
                                    Rewards / Membership Number
                                  </span>
                                  <input
                                    className="input"
                                    name="loyalty_number"
                                    defaultValue={loyalty.loyalty_number}
                                    required
                                  />
                                </label>

                                <label className="stack-sm">
                                  <span className="label">Notes</span>
                                  <input
                                    className="input"
                                    name="notes"
                                    defaultValue={loyalty.notes ?? ""}
                                    placeholder="Optional notes. Do not store passwords."
                                  />
                                </label>
                              </div>

                              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                                <button type="submit" className="btn btn-primary">
                                  Save Rewards Membership
                                </button>
                              </div>
                            </form>

                            <form action={deleteLoyaltyNumber}>
                              <input
                                type="hidden"
                                name="loyalty_id"
                                value={loyalty.id}
                              />
                              <button type="submit" className="btn btn-outline">
                                Remove Rewards Membership
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
