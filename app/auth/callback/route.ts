import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/security/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const allowedTypes = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
  if (code || (tokenHash && type && allowedTypes.includes(type))) {
    const supabase = await createServerSupabaseClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as EmailOtpType });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) {
        const { error: profileError } = await createSupabaseAdminClient()
          .rpc("complete_client_registration", { p_auth_user_id: user.id });
        if (!profileError) {
          const fallback = type === "recovery" ? "/reset-password" : "/dashboard";
          const response = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next"), fallback), url.origin));
          response.headers.set("Cache-Control", "no-store");
          response.headers.set("Referrer-Policy", "no-referrer");
          return response;
        }
      }
    }
  }
  const login = new URL("/login", url.origin);
  login.searchParams.set("message", "That confirmation link could not be completed. Please request a new link or contact your advisor.");
  return NextResponse.redirect(login);
}
