import { Resend } from "resend";

type NewClientMessageNotificationInput = {
  threadId: string;
  threadType: "private" | "trip_group" | string;
  subject: string;
  senderName: string;
  senderEmail?: string | null;
  tripName?: string | null;
  destinations?: string | null;
  departureDate?: string | null;
  bodyPreview: string;
};

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://cozy-concierge.vercel.app";

const fromEmail = process.env.RESEND_FROM_EMAIL ?? "jeremyb@cozyadventurevacations.com";
const fromName = process.env.RESEND_FROM_NAME ?? "Cozy Adventure Vacations";
const notificationEmail =
  process.env.ADMIN_MESSAGE_NOTIFICATION_EMAIL ??
  process.env.RESEND_ADMIN_NOTIFICATION_EMAIL ??
  "jeremyb@cozyadventurevacations.com";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getThreadTypeLabel(threadType: string) {
  return threadType === "trip_group"
    ? "Travel Circle Group Message"
    : "Private Advisor Message";
}

function trimPreview(value: string, maxLength = 700) {
  const cleaned = value.trim();

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1)}…`;
}

export async function sendNewClientMessageNotification({
  threadId,
  threadType,
  subject,
  senderName,
  senderEmail,
  tripName,
  destinations,
  departureDate,
  bodyPreview,
}: NewClientMessageNotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("Message notification email skipped: RESEND_API_KEY is not configured.");
    return;
  }

  if (!notificationEmail) {
    console.warn("Message notification email skipped: notification recipient is not configured.");
    return;
  }

  const resend = new Resend(apiKey);

  const typeLabel = getThreadTypeLabel(threadType);
  const formattedDeparture = formatDate(departureDate);
  const adminThreadUrl = `${appUrl}/admin/messages?threadId=${encodeURIComponent(threadId)}`;
  const safeSubject = subject || "New Cozy Concierge message";
  const preview = trimPreview(bodyPreview);

  const detailsHtml = [
    `<p style="margin: 0 0 6px;"><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>`,
    `<p style="margin: 0 0 6px;"><strong>From:</strong> ${escapeHtml(senderName)}${
      senderEmail ? ` (${escapeHtml(senderEmail)})` : ""
    }</p>`,
    tripName
      ? `<p style="margin: 0 0 6px;"><strong>Trip:</strong> ${escapeHtml(tripName)}</p>`
      : "",
    destinations
      ? `<p style="margin: 0 0 6px;"><strong>Destination:</strong> ${escapeHtml(destinations)}</p>`
      : "",
    formattedDeparture
      ? `<p style="margin: 0;"><strong>Departure:</strong> ${escapeHtml(formattedDeparture)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 680px; margin: 0 auto;">
      <h1 style="color: #1f4f59; margin-bottom: 8px;">New Cozy Concierge Message</h1>

      <div style="background: #f7fbfc; border: 1px solid #e6f0f2; border-radius: 12px; padding: 14px; margin: 18px 0;">
        ${detailsHtml}
      </div>

      <p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>

      <div style="background: #ffffff; border: 1px solid #e6f0f2; border-radius: 12px; padding: 14px; margin: 18px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(preview)}</p>
      </div>

      <p style="margin: 22px 0;">
        <a href="${adminThreadUrl}" style="display: inline-block; background: #1f4f59; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Open Message Thread
        </a>
      </p>

      <p style="font-size: 14px; color: #667085;">
        This notification was generated automatically by Cozy Concierge.
      </p>
    </div>
  `;

  const text = `New Cozy Concierge Message

Type: ${typeLabel}
From: ${senderName}${senderEmail ? ` (${senderEmail})` : ""}
${tripName ? `Trip: ${tripName}\n` : ""}${destinations ? `Destination: ${destinations}\n` : ""}${formattedDeparture ? `Departure: ${formattedDeparture}\n` : ""}
Subject: ${safeSubject}

${preview}

Open message thread:
${adminThreadUrl}`;

  try {
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: notificationEmail,
      subject: `New Cozy Concierge message: ${safeSubject}`,
      html,
      text,
    });
  } catch (error) {
    console.error("New client message notification email failed:", error);
  }
}
