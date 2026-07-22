import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Rate limiting: max 20 client-search requests per user per minute.
// This endpoint is reachable by any logged-in client (not just admins), so
// without a limit it can be scripted to enumerate the entire customer list
// (names + masked emails) by brute-forcing short query prefixes.
//
// NOTE: this in-memory limiter resets per server instance, so on serverless
// platforms (e.g. Vercel) it is a best-effort speed bump rather than a hard
// guarantee. For a durable limit, back this with a Supabase table or a
// service like Upstash Redis.
const rateLimitMap = new Map<string, { count: number; firstRequest: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, firstRequest: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count++;
  return false;
}

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

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: "Too many searches. Please wait a minute and try again.", clients: [] },
        { status: 429 },
      );
    }

    const safeQuery = normalizedQuery.replace(/[%_]/g, "");

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
    return NextResponse.json({ clients: [] });
  }
}
