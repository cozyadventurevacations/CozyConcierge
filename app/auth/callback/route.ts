import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  const errorUrl = new URL("/login", requestUrl.origin);
  errorUrl.searchParams.set(
    "message",
    "That sign-in link is invalid or has expired. Please request a new link and try again.",
  );

  return NextResponse.redirect(errorUrl);
}
