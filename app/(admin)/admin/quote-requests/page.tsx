import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type QuoteRequestRow = {
  id: string;
  status: string | null;
  full_name: string | null;
  email: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  number_of_travelers: number | null;
  submitted_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const statusColors: Record<string, { background: string; color: string }> = {
  new:        { background: "#fff7ed", color: "#c2410c" },
  pending:    { background: "#fff7ed", color: "#c2410c" },
  reviewing:  { background: "#f5f3ff", color: "#6d28d9" },
  quoted:     { background: "#e6f0fb", color: "#185fa5" },
  booked:     { background: "#ecfdf3", color: "#027a48" },
  completed:  { background: "#ecfdf3", color: "#027a48" },
  cancelled:  { background: "#fff1f2", color: "#be123c" },
  closed:     { background: "#f1f5f9", color: "#475569" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status || "new";
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
      background: colors.background, color: colors.color,
    }}>
      {label}
    </span>
  );
}

export default async function AdminQuoteRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: quoteRequests, error } = await supabase
    .from("quote_requests")
    .select("id, status, full_name, email, destinations, departure_date, return_date, number_of_travelers, submitted_at")
    .order("submitted_at", { ascending: false });

  if (error) {
    return (
      <PageShell title="Travel Requests" subtitle="Review incoming inquiries and convert them into trips.">
        <div className="card">
          <p><strong>Error loading travel requests:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = (quoteRequests ?? []) as QuoteRequestRow[];

  return (
    <PageShell title="Travel Requests" subtitle="Review incoming inquiries and convert them into trips.">
      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b" }}>No travel requests found yet.</p>
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Email</th>
                <th>Destination</th>
                <th>Departure</th>
                <th>Return</th>
                <th>Travelers</th>
                <th>Submitted</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.id}>
                  <td><StatusBadge status={request.status} /></td>
                  <td>{request.full_name ?? "—"}</td>
                  <td>{request.email ?? "—"}</td>
                  <td>{request.destinations ?? "—"}</td>
                  <td>{formatDate(request.departure_date)}</td>
                  <td>{formatDate(request.return_date)}</td>
                  <td>{request.number_of_travelers ?? "—"}</td>
                  <td>{formatDateTime(request.submitted_at)}</td>
                  <td>
                    <Link href={`/admin/quote-requests/${request.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}