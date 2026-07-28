import { NextResponse } from "next/server";
import { runBookingWindowWatch } from "@/lib/booking-window-watch/checker";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (!cronSecret) return { ok: false, status: 500, error: "CRON_SECRET is not configured." };
  if (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret) {
    return { ok: true, status: 200, error: "" };
  }

  return { ok: false, status: 401, error: "Unauthorized." };
}

export async function GET(request: Request) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const watchId = url.searchParams.get("watchId")?.trim() || undefined;
  const result = await runBookingWindowWatch({ watchId });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
