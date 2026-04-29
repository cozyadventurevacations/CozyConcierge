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
            }}
          >
            Cozy Concierge
          </p>

          <h1 style={{ margin: 0 }}>
            {isSigningOut ? "Signing You Out..." : "Signed Out"}
          </h1>

          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>
            {isSigningOut
              ? "One quick moment while we close your session."
              : "You have been signed out successfully."}
          </p>
        </div>

        {errorMessage ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            {errorMessage}
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

            <Link href="/travel-request" className="btn btn-outline">
              Request a Trip
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}