"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getRedirectPath(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (
    normalizedRole === "admin" ||
    normalizedRole === "owner" ||
    normalizedRole === "administrator"
  ) {
    return "/admin/dashboard";
  }

  return "/dashboard";
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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (signInError || !signInData.user) {
      setIsSubmitting(false);
      setErrorMessage(signInError?.message ?? "Unable to sign in.");
      return;
    }

    const userId = signInData.user.id;

    const { data: profileByAuthId, error: profileByAuthIdError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("auth_user_id", userId)
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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg, rgba(240,247,248,1) 0%, rgba(255,255,255,1) 70%)",
      }}
    >
      <div
        className="card stack"
        style={{
          width: "100%",
          maxWidth: 460,
          border: "1px solid #e6f0f2",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Image
            src="/cozy-logo.png"
            alt="Cozy Adventure Vacations logo"
            width={220}
            height={220}
            style={{
              width: "220px",
              height: "auto",
              objectFit: "contain",
            }}
            priority
          />
        </div>

        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent-dark)",
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            Cozy Concierge
          </p>

          <h1 style={{ margin: 0, textAlign: "center" }}>Sign In</h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#667085",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            Sign in to access your dashboard, trip details, documents, and travel
            planning tools.
          </p>
        </div>

        {message ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="stack">
          <label className="stack-sm">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="stack-sm">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{
              opacity: isSubmitting ? 0.75 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 14,
          }}
        >
          <Link
            href="/forgot-password"
            style={{
              color: "var(--accent-dark)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Forgot password?
          </Link>

          <Link
            href="/register"
            style={{
              color: "var(--accent-dark)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Create client account
          </Link>

          <Link
            href="/travel-request"
            style={{
              color: "var(--accent-dark)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Request a trip
          </Link>
        </div>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg, rgba(240,247,248,1) 0%, rgba(255,255,255,1) 70%)",
      }}
    >
      <div
        className="card stack"
        style={{
          width: "100%",
          maxWidth: 460,
          border: "1px solid #e6f0f2",
          textAlign: "center",
        }}
      >
        <Image
          src="/cozy-logo.png"
          alt="Cozy Adventure Vacations logo"
          width={180}
          height={180}
          style={{
            width: "180px",
            height: "auto",
            objectFit: "contain",
            margin: "0 auto",
          }}
          priority
        />

        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Cozy Concierge
        </p>

        <h1 style={{ margin: 0 }}>Loading Sign In...</h1>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}