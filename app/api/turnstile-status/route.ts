import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    siteKeyConfigured: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    secretKeyConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY),
  });
}
