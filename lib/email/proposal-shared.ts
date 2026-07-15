import { Resend } from "resend";

type ProposalSharedEmailInput = {
  to: string;
  clientName?: string | null;
  tripId: string;
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

export async function sendProposalSharedEmail({
  to,
  clientName,
  tripId,
  tripName,
  destinations,
  departureDate,
}: ProposalSharedEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("Proposal shared email skipped: RESEND_API_KEY is not configured.");
    return;
  }

  const resend = new Resend(apiKey);
  const greetingName = clientName?.trim() || "Traveler";
  const formattedDeparture = formatDate(departureDate);
  const proposalUrl = `${appUrl}/trips/${tripId}`;

  const safeGreetingName = escapeHtml(greetingName);
  const safeTripName = escapeHtml(tripName);
  const safeDestinations = destinations ? escapeHtml(destinations) : null;
  const safeDeparture = formattedDeparture ? escapeHtml(formattedDeparture) : null;

  const subject = `Your ${tripName} proposal is ready`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <h1 style="color: #1f4f59; margin-bottom: 8px;">Your trip proposal is ready</h1>

      <p>Hi ${safeGreetingName},</p>

      <p>
        Cozy Adventure Vacations has shared a proposal for
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
            </div>`
          : ""
      }

      <p>
        Please review the proposal details, choose your travel insurance response if requested,
        and approve or request changes from your trip page.
      </p>

      <p style="margin: 22px 0;">
        <a href="${proposalUrl}" style="display: inline-block; background: #1f4f59; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Review Proposal
        </a>
      </p>

      <p>Memories Await,<br />Cozy Adventure Vacations</p>
    </div>
  `;

  const text = `Hi ${greetingName},

Cozy Adventure Vacations has shared a proposal for ${tripName} in Cozy Concierge.

${destinations ? `Destination: ${destinations}\n` : ""}${formattedDeparture ? `Departure: ${formattedDeparture}\n` : ""}
Please review the proposal details, choose your travel insurance response if requested, and approve or request changes from your trip page.

Review proposal:
${proposalUrl}

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
    console.error("Proposal shared email failed:", error);
  }
}
