import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
}

export async function consumeLimit(scope: string, actor: string, limit: number, seconds: number) {
  const key = createHash("sha256").update(actor).digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc("consume_security_rate_limit", {
    p_scope: scope, p_key: key, p_limit: limit, p_window_seconds: seconds,
  });
  if (error || !data || typeof data.allowed !== "boolean") throw new Error("Request protection unavailable.");
  return data as { allowed: boolean; retry_after: number };
}

export function limitResponse(retryAfter: number) {
  return NextResponse.json({ error: "Too many requests. Please try again later." }, {
    status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)), "Cache-Control": "no-store" },
  });
}

export async function protectPublicRequest(request: Request, scope: string, email?: string) {
  try {
    for (const [kind, actor, limit, seconds] of [
      ["ip", requestIp(request), 5, 900],
      ...(email ? [["email", email.trim().toLowerCase(), 3, 3600]] : []),
    ] as [string, string, number, number][]) {
      const result = await consumeLimit(scope + ":" + kind, actor, limit, seconds);
      if (!result.allowed) return limitResponse(result.retry_after);
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Please try again shortly." }, { status: 503 });
  }
}

export async function protectPaidEndpoint(_request: Request, scope: string, perMinute = 60, perDay = 1000) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("user_profiles")
      .select("role").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (["admin", "owner", "administrator"].includes(String(profile.role).toLowerCase())) {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") {
        return NextResponse.json({ error: "Verify your authenticator to continue.", code: "mfa_required" }, { status: 403 });
      }
    }
    for (const [suffix, actor, limit, seconds] of [
      ["minute", user.id, perMinute, 60], ["day", user.id, perDay, 86400],
      ["global-day", "all", perDay * 10, 86400],
    ] as [string, string, number, number][]) {
      const result = await consumeLimit(scope + ":" + suffix, actor, limit, seconds);
      if (!result.allowed) return limitResponse(result.retry_after);
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
}
