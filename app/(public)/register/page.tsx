"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import { registrationSections, registrationNotificationFields, validateRegistrationProfile, type RegistrationField } from "@/lib/registration-profile";

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpired?: () => void;
    onTurnstileError?: () => void;
    turnstile?: {
      reset: () => void;
    };
  }
}

function RegistrationInput({ field }: { field: RegistrationField }) {
  const id = `registration-${field.name}`;
  return (
    <label className="stack-sm" htmlFor={id} style={field.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
      <span className="label">{field.label}{field.required ? " *" : " (optional)"}</span>
      {field.options ? (
        <select id={id} name={field.name} className="input" defaultValue="">
          <option value="">Choose if you like</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea id={id} name={field.name} className="textarea" rows={3} maxLength={field.maxLength} placeholder={field.placeholder} />
      ) : (
        <input id={id} name={field.name} className="input" type={field.type ?? "text"} required={field.required}
          maxLength={field.maxLength} autoComplete={field.autoComplete} placeholder={field.placeholder} />
      )}
    </label>
  );
}

function BrandPanel() {
  return (
    <aside className="card stack" style={{ border: "1px solid #d9ecf2", background: "linear-gradient(145deg, #ffffff 0%, #f7fbfc 100%)", justifyContent: "space-between" }}>
      <div className="stack" style={{ textAlign: "center" }}>
        <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={190} height={95} priority style={{ justifySelf: "center" }} />
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Cozy Concierge</p>
        <h1 style={{ margin: 0, fontSize: 30 }}>Create your private travel hub.</h1>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Set up secure access for trip details, documents, Travel Circle messages, shared trips, and advisor updates.
        </p>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {["Secure profile", "Trip documents", "Travel Circle", "Advisor messaging"].map((item) => (
          <div key={item} style={{ padding: "10px 12px", borderRadius: 12, background: "#ffffff", border: "1px solid #e6f0f2", fontWeight: 800, color: "var(--accent-dark)" }}>{item}</div>
        ))}
      </div>
    </aside>
  );
}

export default function RegisterPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMessage || successMessage) feedbackRef.current?.focus();
  }, [errorMessage, successMessage]);

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => {
      setCaptchaToken(token);
    };
    window.onTurnstileExpired = () => {
      setCaptchaToken("");
    };
    window.onTurnstileError = () => {
      setCaptchaToken("");
      setErrorMessage("The bot protection check could not be completed. Please refresh and try again.");
    };

    return () => {
      delete window.onTurnstileSuccess;
      delete window.onTurnstileExpired;
      delete window.onTurnstileError;
    };
  }, []);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const formData = new FormData(event.currentTarget);
      const website = String(formData.get("website") ?? "").trim();
      const answers: Record<string, unknown> = Object.fromEntries(formData);
      for (const field of registrationNotificationFields) answers[field.name] = formData.has(field.name);
      const profileCheck = validateRegistrationProfile(answers);
      if (profileCheck.error) {
        setErrorMessage(profileCheck.error);
        return;
      }

      if (!turnstileSiteKey) {
        setErrorMessage("Registration protection is not configured yet. Please contact Cozy Adventure Vacations.");
        return;
      }

      if (!cleanEmail || !password) {
        setErrorMessage("Please enter your email and password.");
        return;
      }

      if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        setErrorMessage("Use 8–128 characters with an uppercase letter, a number, and a special character.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Password and confirmation password do not match.");
        return;
      }

      if (!captchaToken) {
        setErrorMessage("Please complete the security check before creating your account.");
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      const response = await fetch("/api/register-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email: cleanEmail,
          profile: answers,
          password,
          website,
          captchaToken,
        }),
      });

      window.clearTimeout(timeout);

      let result: { success?: boolean; message?: string; error?: string } = {};
      try { result = await response.json(); } catch { result = {}; }

      if (!response.ok) {
        setErrorMessage(result.error ?? `Unable to create client account. Server returned status ${response.status}.`);
        window.turnstile?.reset();
        setCaptchaToken("");
        return;
      }

      setSuccessMessage(result.message ?? "Check your email to confirm your account before signing in.");
      setPassword(""); setConfirmPassword("");
      window.turnstile?.reset(); setCaptchaToken("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage("The request timed out. Check your inbox for a confirmation email, then try again if needed.");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong while creating the account.");
      window.turnstile?.reset();
      setCaptchaToken("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg, #eef7f8 0%, #ffffff 58%, #f7fbfc 100%)" }}>
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      ) : null}
      <section className="registration-layout" style={{ width: "100%", maxWidth: 1120, display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: 18, alignItems: "start" }}>
        <BrandPanel />

        <div className="card stack" style={{ border: "1px solid #d9ecf2", background: "#ffffff" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Client account</p>
            <h1 style={{ margin: "6px 0 0" }}>Create your Cozy Concierge login</h1>
            <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>Use the same email address you shared with Cozy Adventure Vacations and confirm your email to connect your trips, shared access, and documents.</p>
          </div>

          {successMessage || errorMessage ? (
            <div ref={feedbackRef} tabIndex={-1} role={errorMessage ? "alert" : "status"}
              style={{ padding: 12, borderRadius: 12, background: errorMessage ? "#fff1f2" : "#f0fdf4", border: errorMessage ? "1px solid #fecdd3" : "1px solid #bbf7d0", color: errorMessage ? "#be123c" : "#166534", lineHeight: 1.5 }}>
              {errorMessage || successMessage}
            </div>
          ) : null}

          <form onSubmit={handleRegister} className="stack">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ display: "none" }}
            />

            {registrationSections.map((section) => {
              const content = <>
                <p style={{ margin: "0 0 14px", color: "#667085", fontSize: 14, lineHeight: 1.5 }}>{section.intro}</p>
                <div className="grid grid-2">{section.fields.map((field) => <RegistrationInput key={field.name} field={field} />)}</div>
              </>;
              return section.optional ? (
                <details key={section.title} style={{ border: "1px solid #d9ecf2", borderRadius: 12, padding: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--accent-dark)", marginBottom: 12 }}>{section.title} (optional)</summary>
                  {content}
                </details>
              ) : (
                <fieldset key={section.title} style={{ border: "1px solid #d9ecf2", borderRadius: 12, padding: 16, minWidth: 0 }}>
                  <legend style={{ fontWeight: 800, padding: "0 6px" }}>{section.title}</legend>{content}
                </fieldset>
              );
            })}
            <details style={{ border: "1px solid #d9ecf2", borderRadius: 12, padding: 16 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--accent-dark)", marginBottom: 12 }}>Email preferences (optional)</summary>
              <p style={{ color: "#667085", fontSize: 14 }}>Choose which travel emails you would like. You can change these in your profile. Critical account and security emails may still be sent.</p>
              <div className="stack-sm">
                {registrationNotificationFields.map((field) => <label key={field.name} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" name={field.name} defaultChecked />{field.label}
                </label>)}
              </div>
            </details>
            <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>Passport details and documents can be added later in your profile.</p>

            <label className="stack-sm"><span className="label">Email *</span><input className="input" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>

            <div className="grid grid-2">
              <label className="stack-sm"><span className="label">Password *</span><input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="registration-password-help" required /></label>
              <label className="stack-sm"><span className="label">Confirm password *</span><input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
            </div>
            <p id="registration-password-help" style={{ margin: 0, color: "#667085", fontSize: 13 }}>Use 8–128 characters with an uppercase letter, a number, and a special character. Choose a unique password; common or previously exposed passwords cannot be used.</p>

            {turnstileSiteKey ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "8px 0",
                }}
              >
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                  data-callback="onTurnstileSuccess"
                  data-expired-callback="onTurnstileExpired"
                  data-error-callback="onTurnstileError"
                  data-theme="light"
                />
              </div>
            ) : (
              <div style={{ padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", lineHeight: 1.5 }}>
                Registration protection is not configured yet.
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.75 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}>
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
            <Link href="/login" style={{ color: "var(--accent-dark)", fontWeight: 800, textDecoration: "none" }}>Already have an account?</Link>
            <Link href="/travel-request" style={{ color: "var(--accent-dark)", fontWeight: 800, textDecoration: "none" }}>Request a trip instead</Link>
            <Link href="/privacy-policy" style={{ color: "var(--accent-dark)", fontWeight: 800, textDecoration: "none" }}>Privacy Policy</Link>
          </div>
        </div>
      </section>
      <style>{"@media (max-width: 860px) { .registration-layout { grid-template-columns: 1fr !important; } .registration-layout > aside { display: none !important; } } @media (max-width: 540px) { .registration-layout .grid-2 { grid-template-columns: minmax(0, 1fr); } .registration-layout > .card { padding: 16px; min-width: 0; } }"}</style>
    </main>
  );
}


