import { consumeLimit, limitResponse } from "@/lib/security/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const normalizedQuery = q.toLowerCase();

    if (normalizedQuery.length < 2) {
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

    const limited = await consumeLimit("client-search", user.id, 20, 60);
    if (!limited.allowed) return limitResponse(limited.retry_after);

    const safeQuery = normalizedQuery.replace(/[^a-z0-9@. +\u00c0-\u024f-]/gi, "").slice(0, 100);

    const { data: clients, error } = await supabase
      .from("client_accounts")
      .select("id, first_name, last_name, email")
      .or(
        [
          `first_name.ilike.${safeQuery}%`,
          `last_name.ilike.${safeQuery}%`,
          `email.ilike.${safeQuery}%`,
        ].join(","),
      )
      .limit(6);

    if (error) {
      return NextResponse.json({ clients: [] });
    }

    const safeClients = (clients ?? []).map((client) => {
      const email = String(client.email ?? "");
      const [name, domain] = email.split("@");
      const emailHint = name && domain
        ? `${name.slice(0, 2)}***@${domain}`
        : null;

      return {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email_hint: emailHint,
      };
    });

    return NextResponse.json({ clients: safeClients });
  } catch {
    return NextResponse.json({ error: "Search is temporarily unavailable.", clients: [] }, { status: 503 });
  }
}
