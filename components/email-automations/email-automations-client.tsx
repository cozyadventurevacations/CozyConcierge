"use client";

import { useState } from "react";

type TriggerResult = {
  success: boolean;
  date: string;
  sent: string[];
  skipped: string[];
  errors: string[];
  sentCount: number;
  skippedCount: number;
  errorCount: number;
};

export function EmailAutomationsClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTestRun() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/trigger-automations", {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Request failed (${res.status}): ${text}`);
        return;
      }

      const data = (await res.json()) as TriggerResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card stack"
      style={{
        border: "1px solid #e6f0f2",
        background: "#f7fbfc",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 4px" }}>Manual Test Run</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.6 }}>
          Trigger the automation engine manually for today. This is safe to run
          anytime — duplicate prevention ensures no email is sent twice for the
          same client and date.
        </p>
      </div>

      <div>
        <button
          className="btn btn-primary"
          onClick={handleTestRun}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Running..." : "Run Email Automations Now"}
        </button>
      </div>

      {result && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e6f0f2",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              fontWeight: 700,
              color: "var(--accent-dark)",
            }}
          >
            ✓ Run complete for {result.date}
          </p>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, color: "#888", display: "block" }}>Sent</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#166534" }}>
                {result.sentCount}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#888", display: "block" }}>Skipped</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#555" }}>
                {result.skippedCount}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#888", display: "block" }}>Errors</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: result.errorCount > 0 ? "#991b1b" : "#555" }}>
                {result.errorCount}
              </span>
            </div>
          </div>

          {result.sent.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                Sent:
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#333" }}>
                {result.sent.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#555" }}>
                Skipped (already sent):
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#555" }}>
                {result.skipped.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                Errors:
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#991b1b" }}>
                {result.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {result.sentCount === 0 && result.skippedCount === 0 && result.errorCount === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              No emails triggered today — no clients matched any automation criteria for this date.
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 16,
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
