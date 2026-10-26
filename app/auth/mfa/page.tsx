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
      <h1>{needsEnrollment || qrCode ? "Set up two-step verification" : "Verify your sign-in"}</h1>
      <p>{needsEnrollment
        ? "Use an authenticator app on your phone to generate the six-digit codes that protect your account."
        : qrCode
          ? "Follow the steps below to connect your authenticator app."
          : "Open your authenticator app, find Cozy Concierge, and enter the current six-digit code below."}</p>
      {loading ? <p role="status">Loading your security settings...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && needsEnrollment ? <div className="stack">
        <p>Have your authenticator app ready, then select <strong>Set up authenticator</strong> to display your QR code.</p>
        <button className="btn btn-primary" disabled={busy} onClick={() => void enroll()}>Set up authenticator</button>
      </div> : null}
      {qrCode ? <div className="stack">
        <div className="stack-sm" style={{ padding: 16, borderRadius: 12, background: "#f0f7f8", border: "1px solid #d9ecf2" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Scan from inside your authenticator app</h2>
          <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.7 }}>
            <li>Open your <strong>authenticator app</strong> on your phone.</li>
            <li>Tap <strong>+</strong> or <strong>Add account</strong>, then choose <strong>Scan QR code</strong>.</li>
            <li>Use the scanner inside that app to scan the QR code below.</li>
            <li>Find the <strong>six-digit code for Cozy Concierge</strong> in the app. Enter it below and select <strong>Verify and continue</strong>.</li>
          </ol>
          <p style={{ margin: 0 }}><strong>Only seeing text when you scan?</strong> Your phone’s regular Camera app may show setup text. Open your authenticator app and scan again using its built-in scanner. This QR code connects your authenticator; it does not open a webpage.</p>
        </div>
        <Image src={qrCode} width={220} height={220} alt="Authenticator setup QR code" unoptimized />
        <details>
          <summary>Using this phone or unable to scan? Enter a setup key manually</summary>
          <p>In your authenticator app, choose <strong>Add account</strong>, then the option to enter a setup key. Name the account <strong>Cozy Concierge</strong>, enter the key below, and choose <strong>Time-based</strong> if asked. Then enter the six-digit code the app generates in the field below.</p>
          <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
        </details>
      </div> : null}
      {!loading && factorId ? <form className="stack" onSubmit={verify}>
        <label className="stack-sm"><span className="label">Six-digit code from your authenticator app</span>
          <input className="input" aria-label="Authenticator code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
        </label>
        <button className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? "Verifying..." : "Verify and continue"}</button>
      </form> : null}
      <Link href="/logout">Sign out</Link>
      <p style={{ fontSize: 13 }}>If you lose access to your authenticator, contact the account owner to restore access through Supabase.</p>
    </section>
  </main>;
}
