import { Resend } from "resend";

type TravelCircleInviteEmailInput = {
  to: string;
  inviteName?: string | null;
  role: string;
  tripName: string;
  destinations?: string | null;
  departureDate?: string | null;
};

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

function getRoleLabel(role: string) {
  switch (role) {
    case "contributor":
      return "Contributor";
    case "viewer":
      return "Viewer";
    default:
      return "Travel Companion";
  }
}

export async function sendTravelCircleInviteEmail({
  to,
  inviteName,
  role,
  tripName,
  destinations,
  departureDate,
}: TravelCircleInviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("Travel Circle invite email skipped: RESEND_API_KEY is not configured.");
    return;
  }

  const resend = new Resend(apiKey);

  const greetingName = inviteName?.trim() || "Traveler";
  const roleLabel = getRoleLabel(role);
  const formattedDeparture = formatDate(departureDate);

  const safeTripName = escapeHtml(tripName);
  const safeGreetingName = escapeHtml(greetingName);
  const safeDestinations = destinations ? escapeHtml(destinations) : null;
  const safeDeparture = formattedDeparture ? escapeHtml(formattedDeparture) : null;

  const invitesUrl = `${appUrl}/invites`;
  const registerUrl = `${appUrl}/register`;
  const loginUrl = `${appUrl}/login`;

  const subject = `You're invited to join ${tripName} in Cozy Concierge`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <h1 style="color: #1f4f59; margin-bottom: 8px;">You're invited to a Travel Circle</h1>

      <p>Hi ${safeGreetingName},</p>

      <p>
        You've been invited to join the Travel Circle for
        <strong>${safeTripName}</strong> in Cozy Concierge.
      </p>

      ${
        safeDestinations || safeDeparture
          ? `<div style="background: #f7fbfc; border: 1px solid #e6f0f2; border-radius: 12px; padding: 14px; margin: 18px 0;">
              ${
                safeDestinations
                  ? `<p style="margin: 0 0 6px;"><strong>Destination:</strong> ${safeDestinations}</p>`
                  : ""
              }
              ${
                safeDeparture
                  ? `<p style="margin: 0;"><strong>Departure:</strong> ${safeDeparture}</p>`
                  : ""
              }
              <p style="margin: 6px 0 0;"><strong>Access level:</strong> ${roleLabel}</p>
            </div>`
          : `<p><strong>Access level:</strong> ${roleLabel}</p>`
      }

      <p>
        To accept the invitation, log in or create your Cozy Concierge account using
        this same email address: <strong>${escapeHtml(to)}</strong>.
      </p>

      <p style="margin: 22px 0;">
        <a href="${invitesUrl}" style="display: inline-block; background: #1f4f59; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Review Travel Invitation
        </a>
      </p>

      <p style="font-size: 14px; color: #667085;">
        New to Cozy Concierge? Create your account here:
        <a href="${registerUrl}" style="color: #1f4f59;">${registerUrl}</a>
      </p>

      <p style="font-size: 14px; color: #667085;">
        Already have an account? Sign in here:
        <a href="${loginUrl}" style="color: #1f4f59;">${loginUrl}</a>
      </p>

      <p>
        Once accepted, you'll be able to view shared trip details, approved Travel Circle documents,
        and group messages based on your access level.
      </p>

      <p style="color: #667085; font-size: 14px;">
        Privacy note: personal traveler details, passport uploads, and private advisor messages
        remain protected unless separately shared.
      </p>

      <p>Memories Await,<br />Cozy Adventure Vacations</p>
    </div>
  `;

  const text = `Hi ${greetingName},

You've been invited to join the Travel Circle for ${tripName} in Cozy Concierge.

${destinations ? `Destination: ${destinations}\n` : ""}${formattedDeparture ? `Departure: ${formattedDeparture}\n` : ""}Access level: ${roleLabel}

To accept the invitation, log in or create your Cozy Concierge account using this same email address: ${to}

Review your invitation:
${invitesUrl}

New to Cozy Concierge? Create your account:
${registerUrl}

Already have an account? Sign in:
${loginUrl}

Once accepted, you'll be able to view shared trip details, approved Travel Circle documents, and group messages based on your access level.

Privacy note: personal traveler details, passport uploads, and private advisor messages remain protected unless separately shared.

Memories Await,
Cozy Adventure Vacations`;

  try {
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error("Travel Circle invite email failed:", error);
  }
}
