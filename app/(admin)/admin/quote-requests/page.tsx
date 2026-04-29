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

function formatDate(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: "#f0f7f8",
        color: "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {status || "new"}
    </span>
  );
}

export default async function AdminQuoteRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: quoteRequests, error } = await supabase
    .from("quote_requests")
    .select(
      "id, status, full_name, email, destinations, departure_date, return_date, number_of_travelers, submitted_at",
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    return (
      <PageShell
        title="Quote Requests"
        subtitle="Review incoming inquiries and convert them into trips."
      >
        <div className="card">
          <p>
            <strong>Error loading quote requests:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = (quoteRequests ?? []) as QuoteRequestRow[];

  return (
    <PageShell
      title="Quote Requests"
      subtitle="Review incoming inquiries and convert them into trips."
    >
      {rows.length === 0 ? (
        <div className="card">
          <p>No quote requests found yet.</p>
        </div>
      ) : (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Incoming Quote Requests</h2>

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
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>{request.full_name ?? "Not provided"}</td>
                    <td>{request.email ?? "Not provided"}</td>
                    <td>{request.destinations ?? "Not provided"}</td>
                    <td>{formatDate(request.departure_date)}</td>
                    <td>{formatDate(request.return_date)}</td>
                    <td>{request.number_of_travelers ?? "Not provided"}</td>
                    <td>{formatDateTime(request.submitted_at)}</td>
                    <td>
                      <a
                        href={`/admin/quote-requests/${request.id}`}
                        style={{
                          color: "var(--accent-dark)",
                          fontWeight: 700,
                        }}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}