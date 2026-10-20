"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/security/paths";

function destination() {
    return safeNextPath(new URLSearchParams(window.location.search).get("next"), "/admin/dashboard");
  }

export default function MfaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsEnrollment, setNeedsEnrollment] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.replace("/login"); return; }
      const { data: profile } = await supabase.from("user_profiles").select("role").eq("auth_user_id", user.id).maybeSingle();
      if (!["admin", "owner", "administrator"].includes(String(profile?.role).toLowerCase())) {
        window.location.replace("/dashboard"); return;
      }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel === "aal2") { window.location.replace(destination()); return; }
      const { data, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const verified = data.totp.find((factor) => factor.status === "verified");
      if (active) { setFactorId(verified?.id ?? ""); setNeedsEnrollment(!verified); setLoading(false); }
    }
    void load().catch(() => { if (active) { setError("Your security settings could not be loaded. Please try again."); setLoading(false); } });
    return () => { active = false; };
  }, [supabase]);


  async function enroll() {
    setBusy(true); setError("");
    try {
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      for (const factor of factors.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Cozy Concierge admin" });
      if (enrollError) throw enrollError;
      setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); setNeedsEnrollment(false);
    } catch { setError("Authenticator setup could not be started. Please try again."); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit code from your authenticator."); return; }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) { setError("That code could not be verified. Try the current code from your authenticator."); return; }
      setCode(""); setSecret(""); setQrCode("");
      window.location.replace(destination());
    } catch { setError("Verification is temporarily unavailable. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="page-shell" style={{ maxWidth: 520, margin: "48px auto", padding: 24 }}>
    <section className="card stack">
      <h1>Secure your admin access</h1>
      <p>{needsEnrollment ? "Set up an authenticator app to protect client documents and administrative access." : "Enter the current code from your authenticator to continue."}</p>
      {loading ? <p role="status">Loading your security settings...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && needsEnrollment ? <button className="btn btn-primary" disabled={busy} onClick={() => void enroll()}>Set up authenticator</button> : null}
      {qrCode ? <div className="stack">
        <p>Scan this code with your authenticator app, then enter its six-digit code below.</p>
        <Image src={qrCode} width={220} height={220} alt="Authenticator setup QR code" unoptimized />
        <details><summary>Enter a setup key manually</summary><code style={{ overflowWrap: "anywhere" }}>{secret}</code></details>
      </div> : null}
      {!loading && factorId ? <form className="stack" onSubmit={verify}>
        <label className="stack-sm"><span className="label">Authenticator code</span>
          <input className="input" aria-label="Authenticator code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
        </label>
        <button className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? "Verifying..." : "Verify and continue"}</button>
      </form> : null}
      <Link href="/logout">Sign out</Link>
      <p style={{ fontSize: 13 }}>If you lose access to your authenticator, contact the account owner to restore access through Supabase.</p>
    </section>
  </main>;
}
