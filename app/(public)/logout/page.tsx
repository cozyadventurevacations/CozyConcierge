"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const supabase = createClient();
  const [isSigningOut, setIsSigningOut] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function signOut() {
      setIsSigningOut(true);
      setErrorMessage(null);

      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
      }

      setIsSigningOut(false);
    }

    signOut();
  }, [supabase]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 70%)",
      }}
    >
      <section
        className="card stack"
        style={{
          width: "100%",
          maxWidth: 520,
          textAlign: "center",
          border: "1px solid #e6f0f2",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <Image
            src="/cozy-logo.png"
            alt="Cozy Adventure Vacations"
            width={200}
            height={120}
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
        </div>

        <h1 style={{ margin: 0 }}>
          {isSigningOut ? "Signing You Out..." : "Signed Out"}
        </h1>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          {isSigningOut
            ? "One quick moment while we close your session."
            : "You have been signed out successfully."}
        </p>

        {errorMessage ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              textAlign: "left",
              lineHeight: 1.5,
            }}
          >
            <strong>Sign-out notice:</strong> {errorMessage}
          </div>
        ) : null}

        {!isSigningOut ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href="/login" className="btn btn-primary">
              Sign In Again
            </Link>

            <Link href="/travel-request" className="btn btn-primary">
              Request a Trip
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}