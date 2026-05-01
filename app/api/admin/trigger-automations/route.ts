import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST() {
  await requireAdmin();

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured." },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cozy-concierge.vercel.app";

  const res = await fetch(`${baseUrl}/api/automations/send-emails`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Automation route failed: ${text}` },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}