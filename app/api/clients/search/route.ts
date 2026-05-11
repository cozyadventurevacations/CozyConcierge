import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json({ clients: [] });
    }

    const supabase = await createServerSupabaseClient();

    // Verify the requester is a logged-in client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Search by email or name — only return id, name, email (no sensitive data)
    const { data: clients, error } = await supabase
      .from("client_accounts")
      .select("id, first_name, last_name, email")
      .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(6);

    if (error) {
      return NextResponse.json({ clients: [] });
    }

    return NextResponse.json({ clients: clients ?? [] });
  } catch {
    return NextResponse.json({ clients: [] });
  }
}