import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type SafeTripOption = {
  id: string;
  label: string;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  access_type: "primary" | "shared";
};

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
    return "Unknown error.";
  }
}

function getTripLabel({
  tripName,
  destinations,
}: {
  tripName: string | null;
  destinations: string | null;
}) {
  return tripName || destinations || "Trip";
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

export async function GET() {
  try {
    const { supabase, clientAccount } = await getCurrentClientAccount();

    const { data: ownedTrips, error: ownedTripsError } = await supabase
      .from("client_trip_summaries")
      .select("trip_id, trip_name, destinations, departure_date, return_date, trip_status")
      .eq("client_account_id", clientAccount.id)
      .order("departure_date", { ascending: true });

    if (ownedTripsError) {
      throw new Error(ownedTripsError.message);
    }

    const ownedTripRows = ownedTrips ?? [];
    const ownedTripIds = new Set(ownedTripRows.map((trip) => trip.trip_id));

    const { data: sharedMemberships, error: sharedMembershipsError } = await supabase
      .from("trip_members" as any)
      .select("trip_id")
      .eq("client_account_id", clientAccount.id)
      .eq("invite_status", "active")
      .eq("can_view_trip", true);

    if (sharedMembershipsError) {
      throw new Error(sharedMembershipsError.message);
    }

    const sharedTripIds = Array.from(
      new Set(
        (sharedMemberships ?? [])
          .map((membership: { trip_id?: string | null }) => membership.trip_id)
          .filter((tripId: string | null | undefined): tripId is string => {
            if (!tripId) return false;
            return !ownedTripIds.has(tripId);
          }),
      ),
    );

    let sharedTrips: Array<{
      id: string;
      trip_name: string | null;
      destinations: string | null;
      departure_date: string | null;
      return_date: string | null;
      trip_status: string | null;
    }> = [];

    if (sharedTripIds.length > 0) {
      const { data: loadedSharedTrips, error: sharedTripsError } = await supabase
        .from("trips")
        .select("id, trip_name, destinations, departure_date, return_date, trip_status")
        .in("id", sharedTripIds)
        .order("departure_date", { ascending: true });

      if (sharedTripsError) {
        throw new Error(sharedTripsError.message);
      }

      sharedTrips = loadedSharedTrips ?? [];
    }

    const tripOptions: SafeTripOption[] = [
      ...ownedTripRows.map((trip) => ({
        id: trip.trip_id,
        label: getTripLabel({
          tripName: trip.trip_name,
          destinations: trip.destinations,
        }),
        destinations: trip.destinations,
        departure_date: trip.departure_date,
        return_date: trip.return_date,
        trip_status: trip.trip_status,
        access_type: "primary" as const,
      })),
      ...sharedTrips.map((trip) => ({
        id: trip.id,
        label: getTripLabel({
          tripName: trip.trip_name,
          destinations: trip.destinations,
        }),
        destinations: trip.destinations,
        departure_date: trip.departure_date,
        return_date: trip.return_date,
        trip_status: trip.trip_status,
        access_type: "shared" as const,
      })),
    ];

    return NextResponse.json({
      trips: tripOptions,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Ask Cozy trips API error:", message);

    return NextResponse.json(
      {
        error: `Ask Cozy trips API error: ${message}`,
      },
      { status: 500 },
    );
  }
}