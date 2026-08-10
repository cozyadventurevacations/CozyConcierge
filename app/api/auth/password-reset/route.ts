import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://cozy-concierge.vercel.app";

const fromEmail = process.env.RESEND_FROM_EMAIL ?? "jeremyb@cozyadventurevacations.com";
const fromName = process.env.RESEND_FROM_NAME ?? "Cozy Adventure Vacations";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sendPasswordResetEmail(email: string, actionLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");

  const resend = new Resend(apiKey);
  const safeLink = escapeHtml(actionLink);

  await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: email,
    subject: "Reset your Cozy Concierge password",
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <h1 style="color: #1f4f59; margin-bottom: 8px;">Reset your password</h1>
        <p>We received a request to reset the password for your Cozy Concierge account.</p>
        <p>
          Tap the button below to choose a new password. If your phone asks which app to use,
          choose Safari.
        </p>
        <p style="margin: 28px 0;">
          <a href="${safeLink}" style="background: #004e64; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into Safari:</p>
        <p style="word-break: break-all;"><a href="${safeLink}">${safeLink}</a></p>
        <p style="color: #667085; font-size: 13px;">
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `,
    text: [
      "Reset your Cozy Concierge password",
      "",
      "We received a request to reset the password for your Cozy Concierge account.",
      "Open this link in Safari to choose a new password:",
      actionLink,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: true });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl}/reset-password`,
      },
    });

    if (error || !data.properties?.action_link) {
      console.warn("Password reset link generation skipped.", {
        email,
        error: error?.message ?? "Missing action link.",
      });
      return NextResponse.json({ ok: true });
    }

    await sendPasswordResetEmail(email, data.properties.action_link);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset request failed.", error);
    return NextResponse.json(
      { error: "Unable to send password reset email right now." },
      { status: 500 },
    );
  }
}
