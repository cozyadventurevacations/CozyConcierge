import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_primary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  preferred_airport: string | null;
};

type SafeTripContext = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
};

type AskCozyThread = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  title: string;
  status: string;
  retention_until: string | null;
};

const allowedContactMethods = ["email", "text", "phone"];
const allowedTravelTypes = [
  "tour",
  "cruise",
  "air",
  "hotel",
  "transfer",
  "theme_park",
  "rental_car",
  "rail",
  "vacation_package",
  "insurance",
  "activity",
];

type TravelRequestDraft = {
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  preferred_contact_method?: string | null;
  client_address_line_1?: string | null;
  client_address_line_2?: string | null;
  client_city?: string | null;
  client_state?: string | null;
  client_postal_code?: string | null;
  client_date_of_birth?: string | null;
  client_preferred_airport?: string | null;
  air_preferred_airline?: string | null;
  air_departure_airport?: string | null;
  cruise_line_preference?: string | null;
  theme_park_preference?: string | null;
  departure_date?: string | null;
  return_date?: string | null;
  optional_travel_dates?: string | null;
  number_of_travelers?: number | string | null;
  traveler_ages?: string[] | string | null;
  travel_types_requested?: string[] | string | null;
  destinations?: string | null;
  budget?: string | null;
  trip_vision_notes?: string | null;
  zoom_call_availability?: string | null;
};

const ASK_COZY_SYSTEM_PROMPT = `
You are Ask Cozy, the client-facing AI assistant for Cozy Concierge, powered by Cozy Adventure Vacations.

Brand:
- Cozy Adventure Vacations tagline: "Memories Await!"
- Brand voice: playful, knowledgeable, respectful, warm, professional, and semi-formal.
- Desired feeling: comfort, inspiration, adventure, gratitude, and joy.
- Keep responses clear, reassuring, and easy for travelers to understand.

Primary role:
- Help clients with general travel planning questions.
- Assemble sample itinerary ideas clients can consider while planning, using destination and dates when provided.
- Create practical packing lists customized to the selected trip context when available.
- Research and organize destination ideas, activities, excursions, day-trip options, and experience priorities using the safe trip context when available.
- Deep dive common travel supplier categories and recognizable supplier examples clients may want to discuss with their advisor, such as cruise lines, resorts, tour operators, transfer providers, theme park vendors, and excursion providers.
- Help clients prepare for upcoming travel.
- Explain travel concepts in plain language.
- Suggest what clients should ask their travel advisor.
- Help clients think through packing, documents, accessibility needs, family travel, group travel, cruises, theme parks, resorts, destination planning, and trip-readiness checklists.
- Help clients build a complete travel request by gathering the same practical details as the Travel Request form: destination, dates, flexible windows, travelers, ages, travel type, budget, trip vision, client address, date of birth, preferred airport, and call availability.
- Travel request submissions require the client's address, date of birth, and preferred airport. Use profile details already provided by the system when available; otherwise ask the client for the missing items before submission.
- If the client says they are ready to submit a travel request, gather any missing required details first, then submit it only when enough details are available.
- Encourage clients to use Concierge Messages for booking-specific, account-specific, document-specific, payment-specific, passport-specific, or urgent advisor questions.

Safe trip context:
- You may use provided trip name, destination, departure date, return date, and trip status to make answers more helpful.
- Treat trip context as high-level planning context only.
- Do not imply that you can see the full booking, supplier confirmations, payment records, passport uploads, traveler numbers, private documents, or exact itinerary details.

Sample itinerary behavior:
- When asked for an itinerary, frame it as a sample idea, not a confirmed booking or final schedule.
- If dates are provided, estimate the number of trip days and organize ideas by day when useful.
- Include pacing notes such as relaxed, balanced, or active when helpful.
- Include reminders to confirm opening hours, transportation time, seasonal closures, ticket requirements, and accessibility needs with official sources or the advisor.
- For trip ideas without a selected trip, ask for destination, dates or trip length, traveler style, budget comfort, and must-do interests if those details are missing.

Packing list behavior:
- When asked for a packing list, group items by carry-on, clothing, toiletries, documents, tech, health/comfort, and destination-specific extras when useful.
- Customize to the destination, dates, season, trip length, cruise/resort/theme park/group context, and family/accessibility needs when available.
- Remind clients not to pack passport scans, payment details, or sensitive identity information in chat, and to use the secure portal for uploads.
- Mention that airline baggage rules, prohibited items, and destination entry requirements should be verified before departure.

Destination deep-dive behavior:
- When asked to research or deep dive a destination, organize suggestions by neighborhood/area, activity type, excursion style, pacing, weather or season notes, and traveler fit when useful.
- Include a shortlist of "ask your advisor about" items, such as tickets, guided tours, transfers, accessibility, travel time, cancellation windows, and whether an excursion fits the confirmed itinerary.
- Do not claim live browsing, live rankings, current prices, current hours, or current availability. Say clients or the advisor should verify time-sensitive details with official sources.

Supplier idea behavior:
- When asked about suppliers, explain common supplier categories that might fit the destination and trip style, then provide examples only as possibilities to discuss with the advisor.
- Do not imply Cozy Adventure Vacations endorses, has booked, has preferred status with, or has verified a supplier unless the client explicitly provides that context.
- Encourage the client to ask Jeremy which suppliers are available, vetted, commissionable, accessible, family-friendly, reliable, or best matched to the trip budget and style.

Travel request behavior:
- When the client wants help starting a travel request, act like a friendly intake assistant and ask for one to three missing details at a time.
- Required details for submission are destination, departure date, return date or flexible date window, number of travelers, travel type, client name, email, phone number, address, date of birth, and preferred airport.
- Helpful optional details include traveler ages, budget, preferred contact method, Zoom availability, must-dos, must-avoids, accessibility needs, pace, supplier preferences, room/cabin style, and celebration notes.
- For air requests, capture preferred airline and preferred departure airport when the client provides them.
- For cruise requests, capture cruise line preference. Carnival should not be offered because Cozy Adventure Vacations does not sell Carnival cruises; "Any" is acceptable.
- For theme park requests, capture the preferred park when the client provides it, including Walt Disney World Florida, Disneyland California, Universal Studios Orlando, Universal Studios California, SeaWorld Orlando, Busch Gardens Tampa Bay, LEGOLAND Florida, Dollywood, Cedar Point, Six Flags Magic Mountain, or another park the client names.
- When the client says they are ready to submit, do not claim it is submitted unless the system confirms the request was created.

Important limitations:
- You cannot see payment records, passport uploads, traveler numbers, or private documents.
- You cannot guarantee live prices, availability, supplier rules, entry requirements, airline rules, passport rules, visa rules, or cancellation policies.
- You cannot collect full credit card numbers, Social Security numbers, full passport numbers, passwords, or highly sensitive identity details.
- You cannot provide medical, legal, tax, or immigration advice.

Safety and escalation:
- For payment questions, tell the client to request a payment link or message their advisor through Concierge Messages.
- For passport, visa, entry, immigration, or legal questions, give general guidance only and tell the client to verify with official government sources or their advisor.
- For emergencies while traveling, tell the client to contact local emergency services, the supplier, airline, cruise line, hotel, travel insurance emergency assistance, or their advisor as appropriate.
- If the question is account-specific, booking-specific, payment-specific, document-specific, or urgent, direct the client to Concierge Messages.

Response style:
- Start with a warm, brief opening.
- Keep most answers concise.
- Use bullets when helpful.
- Avoid giant walls of text.
- Do not overpromise.
- Do not pretend to browse live information.
- If something may change, say that it should be verified.
- End with one helpful next step when appropriate.

Your goal:
Help the traveler feel prepared, supported, and confident while reminding them that Cozy Adventure Vacations is there for personalized advisor support.
`;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown API error.";
  }
}

function formatSafeTripContext(trip: SafeTripContext | null) {
  if (!trip) {
    return "No trip context was selected.";
  }

  return [
    "Safe selected trip context:",
    `Trip name: ${trip.trip_name ?? "Not provided"}`,
    `Destination(s): ${trip.destinations ?? "Not provided"}`,
    `Departure date: ${trip.departure_date ?? "Not provided"}`,
    `Return date: ${trip.return_date ?? "Not provided"}`,
    `Trip status: ${trip.trip_status ?? "Not provided"}`,
    "",
    "Important: This is the only trip context available. Do not claim access to payment records, passport details, traveler numbers, private documents, confirmation numbers, or supplier booking records.",
  ].join("\n");
}

function createThreadTitle(message: string) {
  const cleanMessage = message.replace(/\s+/g, " ").trim();

  if (!cleanMessage) {
    return "Ask Cozy Conversation";
  }

  if (cleanMessage.length <= 70) {
    return cleanMessage;
  }

  return `${cleanMessage.slice(0, 67)}...`;
}

function addDaysToDate(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRetentionUntil(trip: SafeTripContext | null) {
  if (!trip?.return_date) {
    return null;
  }

  return addDaysToDate(trip.return_date, 31);
}

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not signed in.");
  }

  const userEmail = user.email?.trim().toLowerCase();

  if (!userEmail) {
    throw new Error("Your login account does not have an email address.");
  }

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, phone_primary, address_line_1, address_line_2, city, state, postal_code, date_of_birth, preferred_airport")
    .ilike("email", userEmail)
    .maybeSingle();

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientAccountByEmail) {
    return {
      supabase,
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
    .select("id, first_name, last_name, email, phone_primary, address_line_1, address_line_2, city, state, postal_code, date_of_birth, preferred_airport")
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
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

async function loadSafeTripContext({
  tripId,
  supabase,
  clientAccountId,
}: {
  tripId: string | null;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
}) {
  if (!tripId) {
    return null;
  }

  const { data: ownedTrip, error: ownedTripError } = await supabase
    .from("client_trip_summaries")
    .select("trip_id, trip_name, destinations, departure_date, return_date, trip_status")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .maybeSingle();

  if (ownedTripError) {
    throw new Error(ownedTripError.message);
  }

  if (ownedTrip) {
    return {
      id: ownedTrip.trip_id,
      trip_name: ownedTrip.trip_name,
      destinations: ownedTrip.destinations,
      departure_date: ownedTrip.departure_date,
      return_date: ownedTrip.return_date,
      trip_status: ownedTrip.trip_status,
    } satisfies SafeTripContext;
  }

  const { data: memberAccess, error: memberAccessError } = await supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccountId)
    .eq("invite_status", "active")
    .eq("can_view_trip", true)
    .maybeSingle();

  if (memberAccessError) {
    throw new Error(memberAccessError.message);
  }

  if (!memberAccess) {
    throw new Error("Trip not found or access denied.");
  }

  const { data: sharedTrip, error: sharedTripError } = await supabase
    .from("trips")
    .select("id, trip_name, destinations, departure_date, return_date, trip_status")
    .eq("id", tripId)
    .maybeSingle();

  if (sharedTripError) {
    throw new Error(sharedTripError.message);
  }

  if (!sharedTrip) {
    throw new Error("Trip not found or access denied.");
  }

  return {
    id: sharedTrip.id,
    trip_name: sharedTrip.trip_name,
    destinations: sharedTrip.destinations,
    departure_date: sharedTrip.departure_date,
    return_date: sharedTrip.return_date,
    trip_status: sharedTrip.trip_status,
  } satisfies SafeTripContext;
}

async function loadThread({
  threadId,
  supabase,
  clientAccountId,
}: {
  threadId: string | null;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
}) {
  if (!threadId) {
    return null;
  }

  const { data: thread, error } = await supabase
    .from("ask_cozy_threads")
    .select("id, client_account_id, trip_id, title, status, retention_until")
    .eq("id", threadId)
    .eq("client_account_id", clientAccountId)
    .neq("status", "deleted")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread) {
    throw new Error("Ask Cozy conversation not found.");
  }

  return thread as AskCozyThread;
}

async function createThread({
  supabase,
  clientAccountId,
  tripId,
  tripContext,
  firstMessage,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
  tripId: string | null;
  tripContext: SafeTripContext | null;
  firstMessage: string;
}) {
  const { data: thread, error } = await supabase
    .from("ask_cozy_threads")
    .insert({
      client_account_id: clientAccountId,
      trip_id: tripId,
      title: createThreadTitle(firstMessage),
      status: "active",
      retention_until: getRetentionUntil(tripContext),
    })
    .select("id, client_account_id, trip_id, title, status, retention_until")
    .single();

  if (error || !thread) {
    throw new Error(error?.message ?? "Could not create Ask Cozy conversation.");
  }

  return thread as AskCozyThread;
}

async function saveMessage({
  supabase,
  clientAccountId,
  threadId,
  role,
  content,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  clientAccountId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
}) {
  const { error } = await supabase.from("ask_cozy_messages").insert({
    thread_id: threadId,
    client_account_id: clientAccountId,
    role,
    content,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function getClientDisplayName(clientAccount: ClientAccount) {
  return `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim();
}

function shouldSubmitTravelRequest(message: string) {
  return /\b(submit|send|create|make|turn this into|ready)\b[\s\S]{0,80}\b(travel request|trip request|quote request|planning request)\b/i.test(message);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeTravelerAges(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((age) => String(age).trim()).filter(Boolean);
  }

  const text = normalizeText(value);
  return text ? text.split(",").map((age) => age.trim()).filter(Boolean) : [];
}

function normalizeTravelTypes(value: unknown) {
  const rawTypes = Array.isArray(value)
    ? value
    : normalizeText(value)
      ? normalizeText(value).split(",")
      : [];

  return rawTypes
    .map((type) => String(type).trim().toLowerCase())
    .map((type) => {
      const normalized = type.replace(/[\s-]+/g, "_").replace(/[^a-z_]/g, "");
      if (normalized === "themepark") return "theme_park";
      if (normalized === "rentalcar") return "rental_car";
      if (normalized === "package") return "vacation_package";
      if (normalized === "excursion") return "activity";
      return normalized;
    })
    .filter((type, index, types) => allowedTravelTypes.includes(type) && types.indexOf(type) === index);
}

function normalizeCruiseLinePreference(value: unknown) {
  const preference = normalizeText(value);

  if (!preference) {
    return null;
  }

  if (/carnival/i.test(preference)) {
    return "Any";
  }

  return preference;
}

function buildTravelRequestSummary({
  draft,
  transcript,
  tripContext,
}: {
  draft: Required<Pick<TravelRequestDraft, "destinations">> & TravelRequestDraft;
  transcript: string;
  tripContext: SafeTripContext | null;
}) {
  return [
    "This travel request was prepared with Ask Cozy.",
    tripContext ? `Selected trip context: ${tripContext.trip_name ?? "Trip"}${tripContext.destinations ? ` - ${tripContext.destinations}` : ""}` : "",
    "",
    "Ask Cozy request summary:",
    draft.trip_vision_notes ?? "",
    "",
    "Ask Cozy intake conversation:",
    transcript,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function extractTravelRequestDraft({
  client,
  conversation,
  tripContext,
  clientAccount,
}: {
  client: OpenAI;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  tripContext: SafeTripContext | null;
  clientAccount: ClientAccount;
}) {
  const clientDefaults = [
    `Client name from account: ${getClientDisplayName(clientAccount) || "Not provided"}`,
    `Client email from account: ${clientAccount.email ?? "Not provided"}`,
    `Client phone from account: ${clientAccount.phone_primary ?? "Not provided"}`,
    `Client address from account: ${[clientAccount.address_line_1, clientAccount.address_line_2, clientAccount.city, clientAccount.state, clientAccount.postal_code].filter(Boolean).join(", ") || "Not provided"}`,
    `Client date of birth from account: ${clientAccount.date_of_birth ?? "Not provided"}`,
    `Client preferred airport from account: ${clientAccount.preferred_airport ?? "Not provided"}`,
  ].join("\n");

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "Extract a Cozy Concierge travel request draft from the conversation.",
          "Return only JSON with these keys:",
          "full_name, email, phone_number, preferred_contact_method, client_address_line_1, client_address_line_2, client_city, client_state, client_postal_code, client_date_of_birth, client_preferred_airport, air_preferred_airline, air_departure_airport, cruise_line_preference, theme_park_preference, departure_date, return_date, optional_travel_dates, number_of_travelers, traveler_ages, travel_types_requested, destinations, budget, trip_vision_notes, zoom_call_availability.",
          "Use YYYY-MM-DD dates only when explicit. If dates are flexible or not exact, put that in optional_travel_dates and leave exact date fields null.",
          "Use YYYY-MM-DD for client_date_of_birth only when explicit.",
          "travel_types_requested must use only: tour, cruise, air, hotel, transfer, theme_park, rental_car, rail, vacation_package, insurance, activity.",
          "For cruise_line_preference, never use Carnival. Use Any if the client has no cruise line preference.",
          "Use client account defaults for name, email, phone, address, date of birth, and preferred airport when the conversation does not override them.",
          "Do not invent destination, dates, traveler count, budget, or travel type.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          clientDefaults,
          "",
          formatSafeTripContext(tripContext),
          "",
          "Conversation:",
          ...conversation.map((message) => `${message.role === "assistant" ? "Ask Cozy" : "Client"}: ${message.content}`),
        ].join("\n"),
      },
    ],
  });

  const text = response.output_text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Ask Cozy could not prepare a structured travel request yet.");
  }

  return JSON.parse(jsonMatch[0]) as TravelRequestDraft;
}

function normalizeTravelRequestDraft({
  draft,
  clientAccount,
}: {
  draft: TravelRequestDraft;
  clientAccount: ClientAccount;
}) {
  const numberOfTravelers = Number(draft.number_of_travelers ?? 0);

  return {
    full_name: normalizeText(draft.full_name) || getClientDisplayName(clientAccount),
    email: normalizeText(draft.email).toLowerCase() || clientAccount.email,
    phone_number: normalizeText(draft.phone_number) || clientAccount.phone_primary,
    preferred_contact_method: allowedContactMethods.includes(normalizeText(draft.preferred_contact_method))
      ? normalizeText(draft.preferred_contact_method)
      : "email",
    client_address_line_1: normalizeText(draft.client_address_line_1) || clientAccount.address_line_1,
    client_address_line_2: normalizeText(draft.client_address_line_2) || clientAccount.address_line_2,
    client_city: normalizeText(draft.client_city) || clientAccount.city,
    client_state: normalizeText(draft.client_state) || clientAccount.state,
    client_postal_code: normalizeText(draft.client_postal_code) || clientAccount.postal_code,
    client_date_of_birth: normalizeDate(draft.client_date_of_birth) || clientAccount.date_of_birth,
    client_preferred_airport: normalizeText(draft.client_preferred_airport) || clientAccount.preferred_airport,
    air_preferred_airline: normalizeText(draft.air_preferred_airline) || null,
    air_departure_airport: normalizeText(draft.air_departure_airport) || normalizeText(draft.client_preferred_airport) || clientAccount.preferred_airport,
    cruise_line_preference: normalizeCruiseLinePreference(draft.cruise_line_preference),
    theme_park_preference: normalizeText(draft.theme_park_preference) || null,
    departure_date: normalizeDate(draft.departure_date),
    return_date: normalizeDate(draft.return_date),
    optional_travel_dates: normalizeText(draft.optional_travel_dates) || null,
    number_of_travelers: Number.isFinite(numberOfTravelers) && numberOfTravelers >= 1 ? numberOfTravelers : 0,
    traveler_ages: normalizeTravelerAges(draft.traveler_ages),
    travel_types_requested: normalizeTravelTypes(draft.travel_types_requested),
    destinations: normalizeText(draft.destinations),
    budget: normalizeText(draft.budget) || null,
    trip_vision_notes: normalizeText(draft.trip_vision_notes),
    zoom_call_availability: normalizeText(draft.zoom_call_availability) || null,
  };
}

function getMissingTravelRequestFields(draft: ReturnType<typeof normalizeTravelRequestDraft>) {
  const missing: string[] = [];

  if (!draft.full_name) missing.push("your name");
  if (!draft.email) missing.push("your email");
  if (!draft.phone_number) missing.push("your phone number");
  if (!draft.client_address_line_1 || !draft.client_city || !draft.client_state || !draft.client_postal_code) missing.push("your address");
  if (!draft.client_date_of_birth) missing.push("your date of birth");
  if (!draft.client_preferred_airport) missing.push("your preferred airport");
  if (!draft.destinations) missing.push("destination");
  if (!draft.departure_date) missing.push("departure date");
  if (!draft.return_date) missing.push("return date");
  if (!draft.number_of_travelers) missing.push("number of travelers");
  if (!draft.travel_types_requested.length) missing.push("type of travel");

  return missing;
}

async function loadRecentMessages({
  supabase,
  threadId,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  threadId: string;
}) {
  const { data, error } = await supabase
    .from("ask_cozy_messages")
    .select("role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .reverse()
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(message.content ?? ""),
    }))
    .filter((message) => message.content.trim().length > 0);
}

async function touchThread({
  supabase,
  threadId,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  threadId: string;
}) {
  const { error } = await supabase
    .from("ask_cozy_threads")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Ask Cozy is not configured yet. Missing OPENAI_API_KEY in the environment variables.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const message = String(body.message ?? "").trim();
    const selectedTripId = String(body.tripId ?? "").trim() || null;
    const requestedThreadId = String(body.threadId ?? "").trim() || null;

    if (!message) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 },
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Please shorten your question and try again." },
        { status: 400 },
      );
    }

    const { supabase, clientAccount } = await getCurrentClientAccount();

    const existingThread = await loadThread({
      threadId: requestedThreadId,
      supabase,
      clientAccountId: clientAccount.id,
    });

    const tripIdForContext = existingThread?.trip_id ?? selectedTripId;

    const tripContext = await loadSafeTripContext({
      tripId: tripIdForContext,
      supabase,
      clientAccountId: clientAccount.id,
    });

    const thread =
      existingThread ??
      (await createThread({
        supabase,
        clientAccountId: clientAccount.id,
        tripId: tripContext?.id ?? null,
        tripContext,
        firstMessage: message,
      }));

    const recentMessages = await loadRecentMessages({
      supabase,
      threadId: thread.id,
    });

    await saveMessage({
      supabase,
      clientAccountId: clientAccount.id,
      threadId: thread.id,
      role: "user",
      content: message,
    });

    const client = new OpenAI({
      apiKey,
    });

    if (shouldSubmitTravelRequest(message)) {
      const conversationForRequest = [
        ...recentMessages,
        {
          role: "user" as const,
          content: message,
        },
      ];
      const transcript = conversationForRequest
        .map((conversationMessage) => `${conversationMessage.role === "assistant" ? "Ask Cozy" : "Client"}: ${conversationMessage.content}`)
        .join("\n\n");
      const extractedDraft = await extractTravelRequestDraft({
        client,
        conversation: conversationForRequest,
        tripContext,
        clientAccount,
      });
      const normalizedDraft = normalizeTravelRequestDraft({
        draft: extractedDraft,
        clientAccount,
      });
      const missingFields = getMissingTravelRequestFields(normalizedDraft);

      if (missingFields.length > 0) {
        const answer = [
          "I can help submit that travel request, but I need a little more information first.",
          "",
          `Please send: ${missingFields.join(", ")}.`,
          "",
          "Once you share that, tell me you are ready to submit the travel request and I will prepare it for Jeremy.",
        ].join("\n");

        await saveMessage({
          supabase,
          clientAccountId: clientAccount.id,
          threadId: thread.id,
          role: "assistant",
          content: answer,
        });

        await touchThread({
          supabase,
          threadId: thread.id,
        });

        return NextResponse.json({
          answer,
          threadId: thread.id,
          title: thread.title,
          retentionUntil: thread.retention_until,
          travelRequestSubmitted: false,
          missingTravelRequestFields: missingFields,
        });
      }

      const { error: insertError } = await supabase.from("quote_requests").insert({
        client_account_id: clientAccount.id,
        full_name: normalizedDraft.full_name,
        email: normalizedDraft.email,
        phone_number: normalizedDraft.phone_number,
        preferred_contact_method: normalizedDraft.preferred_contact_method,
        client_address_line_1: normalizedDraft.client_address_line_1,
        client_address_line_2: normalizedDraft.client_address_line_2 || null,
        client_city: normalizedDraft.client_city,
        client_state: normalizedDraft.client_state,
        client_postal_code: normalizedDraft.client_postal_code,
        client_date_of_birth: normalizedDraft.client_date_of_birth,
        client_preferred_airport: normalizedDraft.client_preferred_airport,
        air_preferred_airline: normalizedDraft.travel_types_requested.includes("air") ? normalizedDraft.air_preferred_airline : null,
        air_departure_airport: normalizedDraft.travel_types_requested.includes("air") ? normalizedDraft.air_departure_airport : null,
        cruise_line_preference: normalizedDraft.travel_types_requested.includes("cruise") ? normalizedDraft.cruise_line_preference || "Any" : null,
        theme_park_preference: normalizedDraft.travel_types_requested.includes("theme_park") ? normalizedDraft.theme_park_preference : null,
        departure_date: normalizedDraft.departure_date,
        return_date: normalizedDraft.return_date,
        optional_travel_dates: normalizedDraft.optional_travel_dates,
        number_of_travelers: normalizedDraft.number_of_travelers,
        traveler_ages: normalizedDraft.traveler_ages.length > 0 ? normalizedDraft.traveler_ages : null,
        travel_types_requested: normalizedDraft.travel_types_requested,
        destinations: normalizedDraft.destinations,
        budget: normalizedDraft.budget,
        trip_vision_notes: buildTravelRequestSummary({
          draft: {
            ...extractedDraft,
            destinations: normalizedDraft.destinations,
            trip_vision_notes: normalizedDraft.trip_vision_notes,
          },
          transcript,
          tripContext,
        }),
        zoom_call_availability: normalizedDraft.zoom_call_availability,
        status: "new",
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      const answer = [
        "Done — I submitted your travel request to Jeremy for review.",
        "",
        "I included the details we gathered here, plus the Ask Cozy planning conversation, so he has the context behind the request. You can keep refining ideas here, but the request itself is now in Cozy Concierge.",
      ].join("\n");

      await saveMessage({
        supabase,
        clientAccountId: clientAccount.id,
        threadId: thread.id,
        role: "assistant",
        content: answer,
      });

      await touchThread({
        supabase,
        threadId: thread.id,
      });

      return NextResponse.json({
        answer,
        threadId: thread.id,
        title: thread.title,
        retentionUntil: thread.retention_until,
        travelRequestSubmitted: true,
      });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: ASK_COZY_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: formatSafeTripContext(tripContext),
        },
        ...recentMessages,
        {
          role: "user",
          content: message,
        },
      ],
    });

    const answer =
      response.output_text ||
      "I’m sorry, I had trouble answering that. Please try again or message your advisor if this is time-sensitive.";

    await saveMessage({
      supabase,
      clientAccountId: clientAccount.id,
      threadId: thread.id,
      role: "assistant",
      content: answer,
    });

    await touchThread({
      supabase,
      threadId: thread.id,
    });

    return NextResponse.json({
      answer,
      threadId: thread.id,
      title: thread.title,
      retentionUntil: thread.retention_until,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Ask Cozy API error:", message);

    return NextResponse.json(
      {
        error: `Ask Cozy API error: ${message}`,
      },
      { status: 500 },
    );
  }
}
