"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!password || !confirmPassword) {
      setErrorMessage("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage(
        "We could not update your password. Please request a new reset link and try again.",
      );
      setIsLoading(false);
      return;
    }

    setMessage("Your password has been updated. Redirecting you to login...");

    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1500);
  }

  return (
    <PageShell title="Reset Password" subtitle="Choose a new password." showLogo>
      <div className="card" style={{ maxWidth: 480 }}>
        <form className="stack" onSubmit={handleUpdatePassword}>
          <label>
            <span className="label">New Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            <span className="label">Confirm Password</span>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
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
              {isLoading ? "Updating..." : "Update Password"}
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