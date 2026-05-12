"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function isValidPassword(password: string) {
  return password.length >= 8;
}

function BrandPanel() {
  return (
    <aside className="card stack" style={{ border: "1px solid #d9ecf2", background: "linear-gradient(145deg, #ffffff 0%, #f7fbfc 100%)", justifyContent: "space-between" }}>
      <div className="stack" style={{ textAlign: "center" }}>
        <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={190} height={95} priority style={{ justifySelf: "center" }} />
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Cozy Concierge</p>
        <h1 style={{ margin: 0, fontSize: 30 }}>Create your private travel hub.</h1>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Set up secure access for trip details, documents, Travel Circle messages, invitations, and advisor updates.
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
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phonePrimary, setPhonePrimary] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhonePrimary = phonePrimary.trim();

      if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
        setErrorMessage("Please enter your first name, last name, email, and password.");
        return;
      }

      if (!isValidPassword(password)) {
        setErrorMessage("Password must be at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Password and confirmation password do not match.");
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      const response = await fetch("/api/register-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ firstName: cleanFirstName, lastName: cleanLastName, email: cleanEmail, phonePrimary: cleanPhonePrimary, password }),
      });

      window.clearTimeout(timeout);

      let result: { success?: boolean; message?: string; error?: string } = {};
      try { result = await response.json(); } catch { result = {}; }

      if (!response.ok) {
        setErrorMessage(result.error ?? `Unable to create client account. Server returned status ${response.status}.`);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

      if (signInError) {
        setSuccessMessage("Account created. Please sign in with your email and password.");
        setErrorMessage(null);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage("The account creation request timed out. Please check Supabase to see if the user was created, then try again if needed.");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong while creating the account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg, #eef7f8 0%, #ffffff 58%, #f7fbfc 100%)" }}>
      <section style={{ width: "100%", maxWidth: 1040, display: "grid", gridTemplateColumns: "minmax(0, 0.85fr) minmax(380px, 1fr)", gap: 18, alignItems: "stretch" }}>
        <BrandPanel />

        <div className="card stack" style={{ border: "1px solid #d9ecf2", background: "#ffffff" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Client account</p>
            <h1 style={{ margin: "6px 0 0" }}>Create your Cozy Concierge login</h1>
            <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>Use the same email address you shared with Cozy Adventure Vacations so trips, invitations, and documents can connect automatically.</p>
          </div>

          {successMessage ? <div style={{ padding: 12, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", lineHeight: 1.5 }}>{successMessage}</div> : null}
          {errorMessage ? <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", lineHeight: 1.5 }}>{errorMessage}</div> : null}

          <form onSubmit={handleRegister} className="stack">
            <div className="grid grid-2">
              <label className="stack-sm"><span className="label">First Name</span><input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></label>
              <label className="stack-sm"><span className="label">Last Name</span><input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></label>
            </div>

            <label className="stack-sm"><span className="label">Email</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
            <label className="stack-sm"><span className="label">Phone</span><input className="input" value={phonePrimary} onChange={(event) => setPhonePrimary(event.target.value)} autoComplete="tel" placeholder="Optional, but helpful for travel updates" /></label>

            <div className="grid grid-2">
              <label className="stack-sm"><span className="label">Password</span><input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" required /></label>
              <label className="stack-sm"><span className="label">Confirm Password</span><input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.75 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}>
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
            <Link href="/login" style={{ color: "var(--accent-dark)", fontWeight: 800, textDecoration: "none" }}>Already have an account?</Link>
            <Link href="/travel-request" style={{ color: "var(--accent-dark)", fontWeight: 800, textDecoration: "none" }}>Request a trip instead</Link>
          </div>
        </div>
      </section>
      <style>{"@media (max-width: 860px) { main section { grid-template-columns: 1fr !important; } main aside { display: none !important; } }"}</style>
    </main>
  );
}


