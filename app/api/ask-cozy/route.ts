import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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
- Help clients prepare for upcoming travel.
- Explain travel concepts in plain language.
- Suggest what clients should ask their travel advisor.
- Help clients think through packing, documents, accessibility needs, family travel, group travel, cruises, theme parks, resorts, destination planning, and trip-readiness checklists.
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
    .select("id, first_name, last_name, email")
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
