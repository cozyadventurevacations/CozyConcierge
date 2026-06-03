import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const normalizedQuery = q.toLowerCase();

    if (normalizedQuery.length < 5 || !normalizedQuery.includes("@") || normalizedQuery.startsWith("@")) {
      return NextResponse.json({ clients: [] });
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const safeEmailPrefix = normalizedQuery.replace(/[%_]/g, "");

    // Only search by email prefix. This keeps Travel Circle invite autofill useful
    // without exposing a broad searchable client directory to every signed-in client.
    const { data: clients, error } = await supabase
      .from("client_accounts")
      .select("id, first_name, last_name, email")
      .ilike("email", `${safeEmailPrefix}%`)
      .limit(6);

    if (error) {
      return NextResponse.json({ clients: [] });
    }

    return NextResponse.json({ clients: clients ?? [] });
  } catch {
    return NextResponse.json({ clients: [] });
  }
}
