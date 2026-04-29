import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";

export default function ClientsPage() {
  return (
    <PageShell
      title="Clients"
      subtitle="View, add, and manage your Cozy Concierge client records."
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

        <h2 style={{ margin: 0 }}>Client Area</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          This section is reserved for client-related dashboard tools.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>

          <Link href="/profile" className="btn btn-primary">
            My Profile
          </Link>

          <Link href="/trips" className="btn btn-primary">
            My Trips
          </Link>
        </div>
      </div>
    </PageShell>
  );
}