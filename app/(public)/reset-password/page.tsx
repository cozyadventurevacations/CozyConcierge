"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [isReadyToReset, setIsReadyToReset] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hasRecoveryHash = hashParams.get("type") === "recovery" && accessToken && refreshToken;
    let isMounted = true;

    async function prepareRecoverySession() {
      setIsPreparingSession(true);
      setErrorMessage("");

      let recoveryError: Error | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        recoveryError = error;
      } else if (hasRecoveryHash) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        recoveryError = error;
      }

      if (!isMounted) {
        return;
      }

      if (code || hasRecoveryHash) {
        window.history.replaceState({}, "", "/reset-password");
      }

      if (recoveryError) {
        setErrorMessage(
          "That password reset link is invalid or has expired. Please request a new reset link and try again.",
        );
        setIsReadyToReset(false);
        setIsPreparingSession(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        setErrorMessage(
          "Open the reset link from your email, or request a new password reset link if this one has expired.",
        );
        setIsReadyToReset(false);
      } else {
        setIsReadyToReset(true);
      }

      setIsPreparingSession(false);
    }

    void prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setErrorMessage(
        "Your password reset session is missing or expired. Please request a new reset link and try again.",
      );
      setIsReadyToReset(false);
      setIsLoading(false);
      return;
    }

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
    await supabase.auth.signOut();

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
            <button className="btn btn-primary" type="submit" disabled={isLoading || isPreparingSession || !isReadyToReset}>
              {isPreparingSession ? "Preparing..." : isLoading ? "Updating..." : "Update Password"}
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
