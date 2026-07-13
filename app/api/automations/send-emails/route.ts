import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { labelForEmailAutomationType } from "@/lib/email-automations/config";

const FROM_EMAIL = "jeremyb@cozyadventurevacations.com";
const FROM_NAME = "Jeremy | Cozy Adventure Vacations";
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cozyadventurevacations.com";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  return new Resend(apiKey);
}

function preferredName(client: { preferred_name?: string | null; first_name?: string | null }) {
  return client.preferred_name?.trim() || client.first_name?.trim() || "Traveler";
}

type EmailPreferenceClient = {
  notify_payment_reminders?: boolean | null;
  notify_trip_updates?: boolean | null;
};

type AutomationSetting = {
  email_type: string;
  enabled: boolean | null;
  subject_override: string | null;
  custom_note: string | null;
};

function wantsPaymentReminders(client: EmailPreferenceClient | null | undefined) {
  return client?.notify_payment_reminders !== false;
}

function wantsTripUpdates(client: EmailPreferenceClient | null | undefined) {
  return client?.notify_trip_updates !== false;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "your upcoming travel date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function emailWrapper(content: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.7;">
      ${content}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
        <p style="margin: 0;">This is an automated reminder from Cozy Adventure Vacations. If you have questions, simply reply to this email.</p>
        <p style="margin: 4px 0 0;">Please do not reply with credit card numbers, passport scans, passwords, or other sensitive information. Use your <a href="${PORTAL_URL}" style="color: #2c5f8a;">secure client portal</a> for document uploads.</p>
      </div>
    </div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyAutomationSetting(
  message: { subject: string; html: string },
  setting: AutomationSetting | null | undefined,
) {
  const subjectOverride = setting?.subject_override?.trim();
  const customNote = setting?.custom_note?.trim();

  let html = message.html;

  if (customNote) {
    const noteHtml = `
      <div style="margin: 18px 0; padding: 14px; border-radius: 10px; background: #f7fbfc; border: 1px solid #dbeafe; color: #123f5b;">
        ${escapeHtml(customNote).replace(/\n/g, "<br/>")}
      </div>`;

    html = html.replace(
      '<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">',
      `${noteHtml}<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">`,
    );
  }

  return {
    subject: subjectOverride || message.subject,
    html,
  };
}

function settingFor(settings: Map<string, AutomationSetting>, emailType: string) {
  return settings.get(emailType) ?? null;
}

function isAutomationEnabled(settings: Map<string, AutomationSetting>, emailType: string) {
  return settingFor(settings, emailType)?.enabled !== false;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function passportExpiryEmail(client: { preferred_name?: string | null; first_name?: string | null }, expiryDate: string) {
  const name = preferredName(client);
  return {
    subject: "Heads Up — Your Passport Expiry Is Coming Up",
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name},</h2>
      <p>I wanted to give you a friendly early heads-up — your passport is due to expire on <strong>${formatDate(expiryDate)}</strong>, which is about 6 months away.</p>
      <p>Many countries require your passport to be valid for at least 6 months beyond your travel dates, and passport renewals can take 6–8 weeks, so now is a great time to get started if you have any travel on the horizon.</p>
      <p><strong>Please verify your passport expiry date and check renewal requirements</strong> through your country's official passport agency. Requirements can change, so it's always best to confirm directly with the official source.</p>
      <p>If you're thinking about your next adventure, I'd love to help you plan it! Just reply to this email or log into your <a href="${PORTAL_URL}" style="color: #2c5f8a;">client portal</a> anytime.</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function preTravelEmail30(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string,
  departureDate: string
) {
  const name = preferredName(client);
  return {
    subject: `30 Days Until Your Adventure — ${tripName}`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name} — your adventure is almost here!</h2>
      <p>Memories Await! You're just <strong>30 days away</strong> from <strong>${tripName}</strong>, departing on <strong>${formatDate(departureDate)}</strong>. I'm so excited for you!</p>
      <p>Here's a preparation checklist to help you feel confident and ready:</p>
      <ul>
        <li>Verify that all travelers' passports are valid for at least 6 months beyond your return date</li>
        <li>Confirm your travel insurance is in place and covers your destination</li>
        <li>Review your travel documents in your <a href="${PORTAL_URL}/trips" style="color: #2c5f8a;">client portal</a></li>
        <li>Check visa and entry requirements for your destination — requirements can change, so please verify with official sources</li>
        <li>Notify your bank and credit card providers of your travel dates</li>
        <li>Begin thinking about what to pack!</li>
      </ul>
      <p><strong>Please note:</strong> Travelers are responsible for carrying and presenting all required original documents at border crossings, airports, and accommodations. Uploaded documents in your portal help us stay organized, but originals are your responsibility to carry.</p>
      <p>Reach out anytime if you have questions — I'm here to help make this trip everything you've been dreaming of!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function preTravelEmail7(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string,
  departureDate: string
) {
  const name = preferredName(client);
  return {
    subject: `Only 7 Days to Go — ${tripName}!`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name} — the countdown is on!</h2>
      <p>Just <strong>7 days</strong> until you depart for <strong>${tripName}</strong> on <strong>${formatDate(departureDate)}</strong>. The excitement is real!</p>
      <p>A few final reminders as you get ready:</p>
      <ul>
        <li>Download your travel documents to your phone from your <a href="${PORTAL_URL}/trips" style="color: #2c5f8a;">client portal</a> in case you're offline</li>
        <li>Check in for your flight online when it opens (typically 24 hours before departure)</li>
        <li>Confirm hotel and accommodation reservation numbers</li>
        <li>Verify your phone plan includes international data or roaming, if needed</li>
        <li>Pack medications and essentials in your carry-on, not checked luggage</li>
        <li>Do a final check that all travelers have their original required documents</li>
      </ul>
      <p><strong>Please verify all entry requirements directly with official sources before travel</strong> — supplier policies and government requirements can change without notice.</p>
      <p>Have the most incredible trip — you absolutely deserve it! Don't hesitate to reach out if anything comes up before you leave.</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function postTravelEmail7(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string
) {
  const name = preferredName(client);
  return {
    subject: `Welcome Home, ${name}! We'd Love to Hear About Your Trip`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Welcome home, ${name}!</h2>
      <p>I hope <strong>${tripName}</strong> was everything you dreamed of and more. It's always a little bittersweet coming home after a great adventure — but now you have memories to last a lifetime!</p>
      <p>I'd genuinely love to hear how your trip went. Your experience means so much to me, and your feedback helps me make every future trip even better. Here are a few ways to share:</p>
      <ul>
        <li><strong>Photos</strong> — I'd love to see your favorites from the trip!</li>
        <li><strong>Your favorite memory</strong> — what was the highlight?</li>
        <li><strong>Google review</strong> — if you'd be willing to share your experience, a Google review helps other travelers find Cozy Adventure Vacations</li>
        <li><strong>Testimonial</strong> — I'd be honored to feature your story on my website (with your permission)</li>
      </ul>
      <p>Just reply to this email with anything you'd like to share — no pressure, but it truly means the world!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function postTravelEmail60(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string
) {
  const name = preferredName(client);
  return {
    subject: `Ready for Your Next Adventure, ${name}?`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name}!</h2>
      <p>It's been about two months since you returned from <strong>${tripName}</strong> — I hope the memories are still making you smile every time you think about it!</p>
      <p>Whenever the travel bug starts whispering again, I'm here and ready to help you start dreaming about your next adventure. Whether it's something similar to your last trip or something completely different, I'd love to help make it happen.</p>
      <p>No pressure at all — but if a destination has been calling your name, now is a great time to start planning. Popular destinations and dates can fill up quickly, and early planning gives us the best options!</p>
      <p>Simply reply to this email or visit your <a href="${PORTAL_URL}/travel-request" style="color: #2c5f8a;">client portal</a> to submit a new travel request whenever you're ready.</p>
      <p>Until then — keep dreaming big. The world is full of memories waiting to be made!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function birthdayEmail(client: { preferred_name?: string | null; first_name?: string | null }) {
  const name = preferredName(client);
  return {
    subject: `Happy Birthday, ${name}!`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Happy Birthday, ${name}!</h2>
      <p>Wishing you a wonderful birthday filled with joy, laughter, good food, and maybe just a little wanderlust!</p>
      <p>Birthdays are the perfect reminder that life is meant to be celebrated — and sometimes the best celebration is a new adventure. If you've been dreaming of a special trip, I'd be honored to help make it happen.</p>
      <p>Here's to another amazing year ahead. Have a beautiful day — you deserve every bit of it!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function anniversaryEmail(client: { preferred_name?: string | null; first_name?: string | null }) {
  const name = preferredName(client);
  return {
    subject: `Happy Anniversary, ${name}!`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Happy Anniversary, ${name}!</h2>
      <p>Wishing you a beautiful anniversary filled with love and wonderful memories!</p>
      <p>Anniversaries are one of the most special occasions to celebrate with travel — whether it's a romantic getaway, a once-in-a-lifetime destination, or simply a relaxing escape together. I'd love to help you plan something truly memorable.</p>
      <p>If an anniversary trip is on your mind, just reply to this email or visit your <a href="${PORTAL_URL}/travel-request" style="color: #2c5f8a;">client portal</a> and let's start dreaming!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

function finalPaymentEmail(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string,
  paymentDueDate: string,
  balanceDue: number | null
) {
  const name = preferredName(client);
  const balanceText = balanceDue
    ? `<p>Your current balance due is <strong>$${balanceDue.toLocaleString()}</strong>.</p>`
    : "";
  return {
    subject: `Action Required — Final Payment Due for ${tripName}`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name},</h2>
      <p>This is a friendly reminder that the final payment for <strong>${tripName}</strong> is due on <strong>${formatDate(paymentDueDate)}</strong>.</p>
      ${balanceText}
      <p><strong>Please review your balance and complete your payment before the due date</strong> to avoid cancellation or supplier penalties. Payment is the traveler's responsibility, and Cozy Adventure Vacations cannot guarantee booking security if payment is not received by the supplier deadline.</p>
      <p>To make your payment, please log into your <a href="${PORTAL_URL}/trips" style="color: #2c5f8a;">secure client portal</a> where you can review your payment details and use your payment link.</p>
      <p>Please do not reply to this email with credit card numbers or financial information. All payments are handled securely through your client portal.</p>
      <p>If you have questions about your balance or payment options, please reach out and I'll be happy to help!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

// ─── Duplicate Prevention ─────────────────────────────────────────────────────

function depositDueEmail(
  client: { preferred_name?: string | null; first_name?: string | null },
  tripName: string,
  depositDueDate: string,
  depositAmount: number | null
) {
  const name = preferredName(client);
  const depositText = depositAmount
    ? `<p>Your deposit amount is <strong>$${depositAmount.toLocaleString()}</strong>.</p>`
    : "";

  return {
    subject: `Action Required - Deposit Due for ${tripName}`,
    html: emailWrapper(`
      <h2 style="color: #2c5f8a; margin: 0 0 12px;">Hi ${name},</h2>
      <p>This is a friendly reminder that the deposit for <strong>${tripName}</strong> is due on <strong>${formatDate(depositDueDate)}</strong>.</p>
      ${depositText}
      <p><strong>Please complete your deposit before the due date</strong> so your booking stays protected with the supplier.</p>
      <p>To make your payment, please log into your <a href="${PORTAL_URL}/trips" style="color: #2c5f8a;">secure client portal</a> where you can review your payment details and use your payment link.</p>
      <p>Please do not reply to this email with credit card numbers or financial information. All payments are handled securely through your client portal.</p>
      <p>If you have questions about your deposit or payment options, please reach out and I&apos;ll be happy to help!</p>
      <p style="margin-top: 20px;">Warm regards,<br/><strong>Jeremy</strong><br/>Cozy Adventure Vacations<br/><em>Memories Await!</em></p>
    `),
  };
}

async function alreadySent(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clientAccountId: string,
  tripId: string | null,
  emailType: string,
  scheduledDate: string
) {
  const query = supabase
    .from("email_automation_log")
    .select("id")
    .eq("email_type", emailType)
    .eq("scheduled_send_date", scheduledDate)
    .eq("status", "sent");

  if (clientAccountId) query.eq("client_account_id", clientAccountId);
  if (tripId) query.eq("trip_id", tripId);

  const { data } = await query.maybeSingle();
  return !!data;
}

async function logEmail(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clientAccountId: string,
  tripId: string | null,
  emailType: string,
  scheduledDate: string,
  status: "sent" | "failed",
  errorMessage?: string
) {
  await supabase.from("email_automation_log").insert({
    client_account_id: clientAccountId,
    trip_id: tripId ?? null,
    email_type: emailType,
    scheduled_send_date: scheduledDate,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    status,
    error_message: errorMessage ?? null,
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}` && cronSecretHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const resend = getResendClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const sent: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const { data: automationSettingsData } = await supabase
    .from("email_automation_settings")
    .select("email_type, enabled, subject_override, custom_note");

  const automationSettings = new Map(
    ((automationSettingsData ?? []) as AutomationSetting[]).map((setting) => [
      setting.email_type,
      setting,
    ]),
  );

  async function sendEmail(
    to: string,
    subject: string,
    html: string,
    tag: string,
    clientAccountId: string,
    tripId: string | null,
    emailType: string
  ) {
    if (!isAutomationEnabled(automationSettings, emailType)) {
      skipped.push(`${labelForEmailAutomationType(emailType)} (${tag}) paused`);
      return;
    }

    const duplicate = await alreadySent(supabase, clientAccountId, tripId, emailType, todayStr);
    if (duplicate) {
      skipped.push(`${tag} (duplicate)`);
      return;
    }

    const adjustedMessage = applyAutomationSetting(
      { subject, html },
      settingFor(automationSettings, emailType),
    );

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject: adjustedMessage.subject,
        html: adjustedMessage.html,
      });
      await logEmail(supabase, clientAccountId, tripId, emailType, todayStr, "sent");
      sent.push(tag);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await logEmail(supabase, clientAccountId, tripId, emailType, todayStr, "failed", msg);
      errors.push(`${tag}: ${msg}`);
    }
  }

  // ── 1. Passport expiry — 6 months out ──────────────────────────────────────
  const sixMonthsOut = new Date(today);
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
  const sixMonthsOutStr = sixMonthsOut.toISOString().split("T")[0];
  const sixMonthsOutNext = new Date(sixMonthsOut.getTime() + 86400000).toISOString().split("T")[0];

  const { data: passportDocs } = await supabase
    .from("client_documents")
    .select("id, expiry_date, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_trip_updates)")
    .eq("document_type", "passport")
    .gte("expiry_date", sixMonthsOutStr)
    .lte("expiry_date", sixMonthsOutNext);

  for (const doc of passportDocs ?? []) {
    const client = Array.isArray(doc.client_accounts) ? doc.client_accounts[0] : doc.client_accounts;
    if (!client?.email || !doc.expiry_date) continue;
    if (!wantsTripUpdates(client)) {
      skipped.push(`passport-expiry:${client.id} (trip updates disabled)`);
      continue;
    }
    const { subject, html } = passportExpiryEmail(client, doc.expiry_date);
    await sendEmail(client.email, subject, html, `passport-expiry:${client.id}`, client.id, null, "passport_expiry_6mo");
  }

  // ── 2. Pre-travel — 30 days ─────────────────────────────────────────────────
  const thirtyOut = new Date(today);
  thirtyOut.setDate(thirtyOut.getDate() + 30);
  const thirtyOutStr = thirtyOut.toISOString().split("T")[0];

  const { data: trips30 } = await supabase
    .from("trips")
    .select("id, trip_name, departure_date, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_trip_updates)")
    .eq("departure_date", thirtyOutStr)
    .neq("trip_status", "cancelled");

  for (const trip of trips30 ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email) continue;
    if (!wantsTripUpdates(client)) {
      skipped.push(`pre-travel-30:${trip.id} (trip updates disabled)`);
      continue;
    }
    const { subject, html } = preTravelEmail30(client, trip.trip_name ?? "Your Trip", trip.departure_date);
    await sendEmail(client.email, subject, html, `pre-travel-30:${trip.id}`, client.id, trip.id, "pre_travel_30_day");
  }

  // ── 3. Pre-travel — 7 days ──────────────────────────────────────────────────
  const sevenOut = new Date(today);
  sevenOut.setDate(sevenOut.getDate() + 7);
  const sevenOutStr = sevenOut.toISOString().split("T")[0];

  const { data: trips7 } = await supabase
    .from("trips")
    .select("id, trip_name, departure_date, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_trip_updates)")
    .eq("departure_date", sevenOutStr)
    .neq("trip_status", "cancelled");

  for (const trip of trips7 ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email) continue;
    if (!wantsTripUpdates(client)) {
      skipped.push(`pre-travel-7:${trip.id} (trip updates disabled)`);
      continue;
    }
    const { subject, html } = preTravelEmail7(client, trip.trip_name ?? "Your Trip", trip.departure_date);
    await sendEmail(client.email, subject, html, `pre-travel-7:${trip.id}`, client.id, trip.id, "pre_travel_7_day");
  }

  // ── 4. Post-travel — 7 days ─────────────────────────────────────────────────
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const sevenAgoStr = sevenAgo.toISOString().split("T")[0];

  const { data: tripsPost7 } = await supabase
    .from("trips")
    .select("id, trip_name, return_date, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_trip_updates)")
    .eq("return_date", sevenAgoStr)
    .neq("trip_status", "cancelled");

  for (const trip of tripsPost7 ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email) continue;
    if (!wantsTripUpdates(client)) {
      skipped.push(`post-travel-7:${trip.id} (trip updates disabled)`);
      continue;
    }
    const { subject, html } = postTravelEmail7(client, trip.trip_name ?? "Your Trip");
    await sendEmail(client.email, subject, html, `post-travel-7:${trip.id}`, client.id, trip.id, "post_travel_7_day");
  }

  // ── 5. Post-travel — 60 days ────────────────────────────────────────────────
  const sixtyAgo = new Date(today);
  sixtyAgo.setDate(sixtyAgo.getDate() - 60);
  const sixtyAgoStr = sixtyAgo.toISOString().split("T")[0];

  const { data: tripsPost60 } = await supabase
    .from("trips")
    .select("id, trip_name, return_date, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_trip_updates)")
    .eq("return_date", sixtyAgoStr)
    .neq("trip_status", "cancelled");

  for (const trip of tripsPost60 ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email) continue;
    if (!wantsTripUpdates(client)) {
      skipped.push(`post-travel-60:${trip.id} (trip updates disabled)`);
      continue;
    }
    const { subject, html } = postTravelEmail60(client, trip.trip_name ?? "Your Trip");
    await sendEmail(client.email, subject, html, `post-travel-60:${trip.id}`, client.id, trip.id, "post_travel_60_day");
  }

  // ── 6. Birthday ──────────────────────────────────────────────────────────────
  const todayMonth = (today.getMonth() + 1).toString().padStart(2, "0");
  const todayDay = today.getDate().toString().padStart(2, "0");

  const { data: allClients } = await supabase
    .from("client_accounts")
    .select("id, first_name, preferred_name, email, date_of_birth, anniversary_date")
    .not("email", "is", null);

  for (const client of allClients ?? []) {
    if (!client.email) continue;

    if (client.date_of_birth) {
      const dob = new Date(client.date_of_birth);
      const dobMonth = (dob.getMonth() + 1).toString().padStart(2, "0");
      const dobDay = dob.getDate().toString().padStart(2, "0");
      if (dobMonth === todayMonth && dobDay === todayDay) {
        const { subject, html } = birthdayEmail(client);
        await sendEmail(client.email, subject, html, `birthday:${client.id}`, client.id, null, "birthday");
      }
    }

    // ── 7. Anniversary ────────────────────────────────────────────────────────
    if (client.anniversary_date) {
      const ann = new Date(client.anniversary_date);
      const annMonth = (ann.getMonth() + 1).toString().padStart(2, "0");
      const annDay = ann.getDate().toString().padStart(2, "0");
      if (annMonth === todayMonth && annDay === todayDay) {
        const { subject, html } = anniversaryEmail(client);
        await sendEmail(client.email, subject, html, `anniversary:${client.id}`, client.id, null, "anniversary");
      }
    }
  }

  // ── 8. Final payment reminders ───────────────────────────────────────────────
  const tenDaysOut = new Date(today);
  tenDaysOut.setDate(tenDaysOut.getDate() + 10);
  const tenDaysOutStr = tenDaysOut.toISOString().split("T")[0];

  const { data: depositTrips } = await supabase
    .from("trips")
    .select("id, trip_name, deposit_due_date, deposit_amount, deposit_paid, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_payment_reminders)")
    .eq("deposit_due_date", tenDaysOutStr)
    .or("deposit_paid.is.null,deposit_paid.eq.false")
    .neq("trip_status", "cancelled");

  for (const trip of depositTrips ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email || !trip.deposit_due_date) continue;
    if (!wantsPaymentReminders(client)) {
      skipped.push(`deposit-due:${trip.id} (payment reminders disabled)`);
      continue;
    }
    const { subject, html } = depositDueEmail(client, trip.trip_name ?? "Your Trip", trip.deposit_due_date, trip.deposit_amount ?? null);
    await sendEmail(client.email, subject, html, `deposit-due:${trip.id}`, client.id, trip.id, "deposit_due_10_day");
  }

  const { data: paymentTrips } = await supabase
    .from("trips")
    .select("id, trip_name, final_payment_due_date, balance_due, client_account_id, client_accounts(id, first_name, preferred_name, email, notify_payment_reminders)")
    .eq("final_payment_due_date", tenDaysOutStr)
    .neq("trip_status", "cancelled");

  for (const trip of paymentTrips ?? []) {
    const client = Array.isArray(trip.client_accounts) ? trip.client_accounts[0] : trip.client_accounts;
    if (!client?.email || !trip.final_payment_due_date) continue;
    if (!wantsPaymentReminders(client)) {
      skipped.push(`final-payment:${trip.id} (payment reminders disabled)`);
      continue;
    }
    const { subject, html } = finalPaymentEmail(client, trip.trip_name ?? "Your Trip", trip.final_payment_due_date, trip.balance_due ?? null);
    await sendEmail(client.email, subject, html, `final-payment:${trip.id}`, client.id, trip.id, "final_payment_10_day");
  }

  return NextResponse.json({
    success: true,
    date: todayStr,
    sent,
    skipped,
    errors,
    sentCount: sent.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
  });
}
