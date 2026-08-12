type SupabaseLike = {
  from: (table: string) => any;
};

export async function loadTripPackingListPdfData({
  supabase,
  tripId,
}: {
  supabase: SupabaseLike;
  tripId: string;
}) {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_name, destinations, departure_date, return_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Trip not found.");
  }

  const { data: note, error: noteError } = await supabase
    .from("trip_notes")
    .select("id, title, content, updated_at")
    .eq("trip_id", tripId)
    .eq("note_type", "client")
    .maybeSingle();

  if (noteError) {
    throw new Error(noteError.message);
  }

  if (!note?.content) {
    throw new Error("Generate and save a packing list before downloading the PDF.");
  }

  return { trip, note };
}
