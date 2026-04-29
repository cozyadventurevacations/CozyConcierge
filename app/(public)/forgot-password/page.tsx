"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handlePasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setErrorMessage("");

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      setErrorMessage(
        "We could not send a password reset email right now. Please try again.",
      );
      setIsLoading(false);
      return;
    }

    setMessage(
      "If an account exists for that email address, a password reset email will be sent shortly.",
    );
    setEmail("");
    setIsLoading(false);
  }

  return (
    <PageShell title="Forgot Password" subtitle="Request a password reset.">
      <div className="card" style={{ maxWidth: 480 }}>
        <form className="stack" onSubmit={handlePasswordReset}>
          <label>
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          {message ? (
            <div
              className="card"
              style={{
                background: "#f7fbfc",
                borderColor: "#d8ecef",
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="card"
              style={{
                background: "#fff4f4",
                borderColor: "#f1cccc",
              }}
            >
              <p style={{ margin: 0 }}>{errorMessage}</p>
            </div>
          ) : null}

          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Email"}
            </button>

            <Link href="/login" className="btn btn-primary">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </PageShell>
  );
}