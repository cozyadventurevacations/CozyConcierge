"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getRedirectPath(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (["admin", "owner", "administrator"].includes(normalizedRole)) {
    return "/admin/dashboard";
  }

  return "/dashboard";
}

function BrandMark() {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={190} height={95} priority />
      <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>
        Cozy Concierge
      </p>
    </div>
  );
}

function FeaturePill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "7px 11px", background: "#f0f7f8", color: "var(--accent-dark)", fontSize: 13, fontWeight: 800 }}>
      {children}
    </span>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg, #eef7f8 0%, #ffffff 58%, #f7fbfc 100%)" }}>
      <section style={{ width: "100%", maxWidth: 980, display: "grid", gridTemplateColumns: "minmax(0, 0.92fr) minmax(360px, 1fr)", gap: 18, alignItems: "stretch" }}>
        <aside className="card stack" style={{ border: "1px solid #d9ecf2", background: "linear-gradient(145deg, #ffffff 0%, #f7fbfc 100%)", justifyContent: "space-between" }}>
          <div className="stack">
            <BrandMark />
            <div style={{ textAlign: "center" }}>
              <h1 style={{ margin: 0, fontSize: 30 }}>Your trips, details, and documents in one calm place.</h1>
              <p style={{ margin: "10px 0 0", color: "#667085", lineHeight: 1.6 }}>
                Cozy Concierge keeps your upcoming travel organized, private, and easy to review whenever you need it.
              </p>
            </div>
            <div className="row" style={{ justifyContent: "center", gap: 8 }}>
              <FeaturePill>Trip details</FeaturePill>
              <FeaturePill>Secure documents</FeaturePill>
              <FeaturePill>Advisor messages</FeaturePill>
            </div>
          </div>
          <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.5, textAlign: "center" }}>
            Powered by Cozy Adventure Vacations.
          </p>
        </aside>

        <div className="card stack" style={{ border: "1px solid #d9ecf2", background: "#ffffff" }}>
          {children}
        </div>
      </section>

      <style>{"@media (max-width: 820px) { main section { grid-template-columns: 1fr !important; } main aside { display: none !important; } }"}</style>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const message = searchParams.get("message");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setIsSubmitting(false);
      setErrorMessage("Please enter your email and password.");
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (signInError || !signInData.user) {
      setIsSubmitting(false);
      setErrorMessage(signInError?.message ?? "Unable to sign in.");
      return;
    }

    const { data: profileByAuthId, error: profileByAuthIdError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("auth_user_id", signInData.user.id)
      .maybeSingle();

    if (profileByAuthIdError) {
      setIsSubmitting(false);
      setErrorMessage(profileByAuthIdError.message);
      return;
    }

    if (profileByAuthId) {
      router.replace(getRedirectPath(profileByAuthId.role));
      router.refresh();
      return;
    }

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (profileByEmailError) {
      setIsSubmitting(false);
      setErrorMessage(profileByEmailError.message);
      return;
    }

    router.replace(getRedirectPath(profileByEmail?.role));
    router.refresh();
  }

  return (
    <AuthShell>
      <div>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Welcome back</p>
        <h1 style={{ margin: "6px 0 0" }}>Sign in to Cozy Concierge</h1>
        <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Access trip details, payment reminders, documents, Travel Circle messages, and advisor updates.
        </p>
      </div>

      {message ? <div style={{ padding: 12, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", lineHeight: 1.5 }}>{message}</div> : null}
      {errorMessage ? <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", lineHeight: 1.5 }}>{errorMessage}</div> : null}

      <form onSubmit={handleLogin} className="stack">
        <label className="stack-sm">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
        </label>

        <label className="stack-sm">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" required />
        </label>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.75 : 1 }}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
        <Link href="/forgot-password" style={{ fontWeight: 800 }}>Forgot password?</Link>
        <Link href="/register" style={{ fontWeight: 800 }}>Create account</Link>
        <Link href="/travel-request" style={{ fontWeight: 800 }}>Request a trip</Link>
      </div>
    </AuthShell>
  );
}

function LoginPageFallback() {
  return (
    <AuthShell>
      <BrandMark />
      <h1 style={{ margin: 0, textAlign: "center" }}>Loading sign in...</h1>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
