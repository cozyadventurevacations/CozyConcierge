import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/logout",
  "/groups",
];

const PUBLIC_API_PATHS = [
  "/api/register-client",
  "/api/automations/send-emails",
];

// These admin-namespaced routes are called by external cron jobs (not a
// logged-in browser session) and authenticate themselves internally via a
// CRON_SECRET / x-purge-secret header check. They must be exact matches
// only — do NOT widen this to a prefix match on "/api/admin", since that
// would bypass the admin-role check below for every other admin API route.
const PUBLIC_CRON_API_EXACT_PATHS = [
  "/api/admin/check-cruise-prices",
  "/api/admin/purge-deleted-trips",
];

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "owner" ||
    normalizedRole === "administrator"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (PUBLIC_CRON_API_EXACT_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const userEmail = user.email?.trim().toLowerCase() ?? "";

    const { data: profileByAuthId } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    let role = profileByAuthId?.role ?? null;

    if (!isAdminRole(role) && userEmail) {
      const { data: profileByEmail } = await supabase
        .from("user_profiles")
        .select("role")
        .ilike("email", userEmail)
        .maybeSingle();

      role = profileByEmail?.role ?? role;
    }

    if (!isAdminRole(role)) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }

      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
