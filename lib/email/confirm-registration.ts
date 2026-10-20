import "server-only";
import { Resend } from "resend";

export async function sendRegistrationConfirmation(email: string, tokenHash: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const apiKey = process.env.RESEND_API_KEY;
  if (!base || !apiKey) throw new Error("Registration email is unavailable.");
  const link = new URL("/auth/callback", base);
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", "signup");
  link.searchParams.set("next", "/dashboard");
  const text = [
    "Confirm your Cozy Concierge email",
    "",
    "Open this link to verify your email and finish setting up your private travel hub:",
    link.toString(),
    "",
    "If you did not request this account, ignore this email.",
  ].join("\n");
  const { error } = await new Resend(apiKey).emails.send({
    from: `${process.env.RESEND_FROM_NAME || "Cozy Adventure Vacations"} <${process.env.RESEND_FROM_EMAIL || "jeremyb@cozyadventurevacations.com"}>`,
    to: email, subject: "Confirm your Cozy Concierge email", text,
  });
  if (error) throw new Error("Confirmation email could not be sent.");
}
