import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";

export default function GroupsPage() {
  return (
    <PageShell
      title="Groups"
      subtitle="Manage group travel, room blocks, parent communications, and group details."
    >
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
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

        <h2 style={{ margin: 0 }}>Group Travel Area</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          This section is reserved for future group travel tools.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>

          <Link href="/trips" className="btn btn-primary">
            View Trips
          </Link>

          <Link href="/travel-request" className="btn btn-primary">
            Request Travel
          </Link>
        </div>
      </div>
    </PageShell>
  );
}