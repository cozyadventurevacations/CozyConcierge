import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  buildPackingListFileName,
  renderPackingListPdf,
} from "@/lib/pdf/packing-list";
import { loadTripPackingListPdfData } from "@/lib/trips/packing-list";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { supabase } = await requireAdmin();

  try {
    const { trip, note } = await loadTripPackingListPdfData({ supabase, tripId });
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
