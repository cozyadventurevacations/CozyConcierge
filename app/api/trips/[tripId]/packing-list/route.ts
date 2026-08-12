import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPackingListFileName,
  renderPackingListPdf,
} from "@/lib/pdf/packing-list";
import { loadTripPackingListPdfData } from "@/lib/trips/packing-list";
import { findActiveTripMemberAccess } from "@/lib/travel-circle-access";

export const runtime = "nodejs";

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, clientAccount: null };
  }

  const userEmail = user.email?.trim().toLowerCase();

  if (userEmail) {
    const { data: clientAccountByEmail, error: clientEmailError } = await supabase
      .from("client_accounts")
      .select("id, email")
      .ilike("email", userEmail)
      .maybeSingle();

    if (clientEmailError) throw new Error(clientEmailError.message);
    if (clientAccountByEmail) {
      return { supabase, clientAccount: clientAccountByEmail };
    }
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!userProfile) return { supabase, clientAccount: null };

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) throw new Error(clientProfileError.message);

  return { supabase, clientAccount: clientAccountByProfile };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase, clientAccount } = await getCurrentClientAccount();

    if (!clientAccount) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: ownedTrip, error: ownedTripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("client_account_id", clientAccount.id)
      .maybeSingle();

    if (ownedTripError) throw new Error(ownedTripError.message);

    if (!ownedTrip) {
      const { data: memberAccess, error: memberAccessError } =
        await findActiveTripMemberAccess({
          supabase,
          tripId,
          clientAccountId: clientAccount.id,
          email: clientAccount.email,
          select: "id, can_view_trip",
        });

      if (memberAccessError) throw new Error(memberAccessError.message);

      if (!memberAccess || memberAccess.can_view_trip === false) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { trip, note } = await loadTripPackingListPdfData({
      supabase: supabaseAdmin,
      tripId,
    });
    const pdf = await renderPackingListPdf({ trip, note });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildPackingListFileName(trip.trip_name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate packing list PDF.",
      },
      { status: 500 },
    );
  }
}
