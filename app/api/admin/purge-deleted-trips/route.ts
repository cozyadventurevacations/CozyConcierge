import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route is called by an external cron job (e.g. cron-job.org) once per day.
// It permanently deletes any soft-deleted trips older than 1 year
// that are not flagged with retain_data = true.
//
// Setup: create a free cron job at https://cron-job.org pointing to:
// https://your-vercel-url.vercel.app/api/admin/purge-deleted-trips
// with the header: x-purge-secret: [your PURGE_SECRET env var]
// Schedule: once daily at 3:00 AM

export async function POST(request: NextRequest) {
  try {
    // Verify secret header to prevent unauthorized calls
    const secret = request.headers.get("x-purge-secret");
    const expectedSecret = process.env.PURGE_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "PURGE_SECRET not configured" }, { status: 500 });
    }

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Find trips eligible for permanent deletion
    const { data: eligible, error: fetchError } = await supabase
      .from("trips")
      .select("id, trip_name, deleted_at")
      .not("deleted_at", "is", null)
      .eq("retain_data", false)
      .lt("deleted_at", oneYearAgo.toISOString());

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const eligibleTrips = eligible ?? [];

    if (eligibleTrips.length === 0) {
      return NextResponse.json({ purged: 0, message: "No trips eligible for permanent deletion." });
    }

    const tripIds = eligibleTrips.map((t) => t.id);

    const { error: deleteError } = await supabase
      .from("trips")
      .delete()
      .in("id", tripIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      purged: eligibleTrips.length,
      trips: eligibleTrips.map((t) => ({ id: t.id, trip_name: t.trip_name, deleted_at: t.deleted_at })),
      message: `Permanently deleted ${eligibleTrips.length} trip${eligibleTrips.length === 1 ? "" : "s"}.`,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}