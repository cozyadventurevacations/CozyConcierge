import Link from "next/link";
import { revalidatePath } from "next/cache";
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

type RequestFilter = "all" | "new" | "reviewing" | "quoted" | "booked" | "closed";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function normalizeStatus(value: string | null | undefined) {
  return (value || "new").toLowerCase();
}

const statusColors: Record<string, { background: string; color: string }> = {
  new: { background: "#fff7ed", color: "#c2410c" },
  pending: { background: "#fff7ed", color: "#c2410c" },
  reviewing: { background: "#f5f3ff", color: "#6d28d9" },
  quoted: { background: "#e6f0fb", color: "#185fa5" },
  booked: { background: "#ecfdf3", color: "#027a48" },
  completed: { background: "#ecfdf3", color: "#027a48" },
  cancelled: { background: "#fff1f2", color: "#be123c" },
  closed: { background: "#f1f5f9", color: "#475569" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status || "new";
  const colors = statusColors[label.toLowerCase()] ?? { background: "#f0f7f8", color: "var(--accent-dark)" };
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: colors.background, color: colors.color }}>{label}</span>;
}

function matchesFilter(request: QuoteRequestRow, filter: RequestFilter) {
  const status = normalizeStatus(request.status);
  if (filter === "all") return true;
  if (filter === "new") return status === "new" || status === "pending";
  if (filter === "reviewing") return status === "reviewing";
  if (filter === "quoted") return status === "quoted";
  if (filter === "booked") return status === "booked" || status === "completed";
  if (filter === "closed") return status === "closed" || status === "cancelled";
  return true;
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function SummaryCard({ label, value, helper, tone = "neutral" }: { label: string; value: string | number; helper: string; tone?: "neutral" | "warning" | "good" }) {
  const colors = tone === "warning" ? { border: "#fed7aa", background: "#fff7ed", color: "#c2410c" } : tone === "good" ? { border: "#bbf7d0", background: "#ecfdf3", color: "#027a48" } : { border: "#e6f0f2", background: "#ffffff", color: "var(--accent-dark)" };
  return (
    <div className="card" style={{ border: `1px solid ${colors.border}`, background: colors.background }}>
      <span className="label">{label}</span>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: colors.color }}>{value}</p>
      <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{helper}</p>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "8px 12px", fontSize: 13 }}>{children}</Link>;
}

async function deleteQuoteRequest(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) throw new Error("Missing travel request ID.");

  const { error } = await supabase
    .from("quote_requests")
    .delete()
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/quote-requests");
  revalidatePath("/admin/dashboard");
}

export default async function AdminQuoteRequestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const activeFilter = (["all", "new", "reviewing", "quoted", "booked", "closed"].includes(String(rawFilter)) ? rawFilter : "all") as RequestFilter;
  const { supabase } = await requireAdmin();

  const { data: quoteRequests, error } = await supabase
    .from("quote_requests")
    .select("id, status, full_name, email, destinations, departure_date, return_date, number_of_travelers, submitted_at")
    .order("submitted_at", { ascending: false });

  if (error) {
    return <PageShell title="Travel Requests" subtitle="Review incoming inquiries and convert them into trips."><div className="card"><p><strong>Error loading travel requests:</strong></p><pre>{JSON.stringify(error, null, 2)}</pre></div></PageShell>;
  }

  const allRows = (quoteRequests ?? []) as QuoteRequestRow[];
  const rows = allRows.filter((request) => matchesFilter(request, activeFilter));
  const newRows = allRows.filter((request) => matchesFilter(request, "new"));
  const reviewingRows = allRows.filter((request) => matchesFilter(request, "reviewing"));
  const quotedRows = allRows.filter((request) => matchesFilter(request, "quoted"));
  const staleRows = newRows.filter((request) => Number(daysSince(request.submitted_at) ?? 0) >= 2);
  const base = "/admin/quote-requests";

  return (
    <PageShell title="Travel Requests" subtitle="Review incoming inquiries and convert them into trips.">
      <div className="grid grid-4">
        <SummaryCard label="New" value={newRows.length} helper="Need first review" tone={newRows.length > 0 ? "warning" : "neutral"} />
        <SummaryCard label="Reviewing" value={reviewingRows.length} helper="In progress" />
        <SummaryCard label="Quoted" value={quotedRows.length} helper="Awaiting booking" />
        <SummaryCard label="Older Than 2 Days" value={staleRows.length} helper="Fresh leads to follow up" tone={staleRows.length > 0 ? "warning" : "good"} />
      </div>

      <div className="card stack">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <FilterLink href={base} active={activeFilter === "all"}>All</FilterLink>
          <FilterLink href={`${base}?filter=new`} active={activeFilter === "new"}>New</FilterLink>
          <FilterLink href={`${base}?filter=reviewing`} active={activeFilter === "reviewing"}>Reviewing</FilterLink>
          <FilterLink href={`${base}?filter=quoted`} active={activeFilter === "quoted"}>Quoted</FilterLink>
          <FilterLink href={`${base}?filter=booked`} active={activeFilter === "booked"}>Booked</FilterLink>
          <FilterLink href={`${base}?filter=closed`} active={activeFilter === "closed"}>Closed</FilterLink>
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No travel requests match this view.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead><tr><th>Status</th><th>Name</th><th>Email</th><th>Destination</th><th>Departure</th><th>Return</th><th>Travelers</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((request) => {
                  const age = daysSince(request.submitted_at);
                  const needsAttention = matchesFilter(request, "new") && Number(age ?? 0) >= 2;
                  return (
                    <tr key={request.id} style={{ background: needsAttention ? "#fff7ed" : undefined }}>
                      <td><StatusBadge status={request.status} /></td>
                      <td><strong>{request.full_name ?? "-"}</strong></td>
                      <td>{request.email ?? "-"}</td>
                      <td>{request.destinations ?? "-"}</td>
                      <td>{formatDate(request.departure_date)}</td>
                      <td>{formatDate(request.return_date)}</td>
                      <td>{request.number_of_travelers ?? "-"}</td>
                      <td>{formatDateTime(request.submitted_at)}{needsAttention ? <span style={{ display: "block", color: "#c2410c", fontSize: 12, fontWeight: 800 }}>Follow up soon</span> : null}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <Link href={`/admin/quote-requests/${request.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>Open</Link>
                          <form action={deleteQuoteRequest}>
                            <input type="hidden" name="request_id" value={request.id} />
                            <button
                              type="submit"
                              className="btn btn-primary"
                              style={{ fontSize: 13, padding: "5px 12px", background: "#ffffff", color: "#b42318", border: "1px solid #fecaca" }}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
