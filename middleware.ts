import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback", "/logout", "/privacy-policy", "/terms-and-conditions"];
const PUBLIC_ASSETS = ["/worldvia-supplier-extractor.js","/travel-library/life-onboard-cruise-rhythm.pdf","/travel-library/join-your-cruise-facebook-group.pdf","/travel-library/30-day-cruise-countdown-checklist.pdf","/legal/cozy-adventure-vacations-terms-and-conditions.pdf","/legal/cozy-adventure-vacations-terms-and-conditions.docx","/insurance/allianz/allianz-latitude-plan.pdf","/insurance/allianz/allianz-journey-plan.pdf","/insurance/allianz/allianz-classic-cancel-anytime-plan.pdf"];
const PUBLIC_API_PATHS = ["/api/register-client", "/api/auth/password-reset", "/api/automations/send-emails",
  "/api/admin/check-cruise-prices", "/api/admin/purge-deleted-trips", "/api/admin/check-booking-windows"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_ASSETS.includes(pathname) || pathname === "/groups" || pathname.startsWith("/groups/") || PUBLIC_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const finish = (result: NextResponse) => {
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return finish(pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url)));
  }
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  if (isAdminPath) {
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("auth_user_id", user.id).maybeSingle();
    if (!["admin", "owner", "administrator"].includes(String(profile?.role).trim().toLowerCase())) {
      return finish(pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden." }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      const target = new URL("/auth/mfa", request.url);
      target.searchParams.set("next", pathname + request.nextUrl.search);
      return finish(pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Verify your authenticator to continue.", code: "mfa_required" }, { status: 403 })
        : NextResponse.redirect(target));
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|cozy-logo.png|jeremy.jpg|robots.txt|sitemap.xml).*)"],
};
