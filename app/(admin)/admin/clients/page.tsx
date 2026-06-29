import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_primary: string | null;
  city: string | null;
  state: string | null;
  travel_style: string | null;
  preferred_airport: string | null;
  passport_expiration_date: string | null;
  created_at: string | null;
};

type ClientFilter = "all" | "recent" | "missing-passport" | "passport-expiring";

type PassportDocRow = { client_account_id: string | null };

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function clientName(client: ClientRow) {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.email || "Unnamed Client";
}

function clientMatchesSearch(client: ClientRow, searchTerm: string) {
  if (!searchTerm) return true;
  const haystack = [client.first_name, client.last_name, client.preferred_name, client.email, client.phone_primary, client.city, client.state, client.travel_style, client.preferred_airport].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isRecent(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 1000 * 60 * 60 * 24 * 30;
}

function passportStatus(client: ClientRow, uploadedPassportIds: Set<string>) {
  const uploaded = uploadedPassportIds.has(client.id);
  const days = daysUntil(client.passport_expiration_date);

  if (days !== null && days < 0) return { label: "Expired", tone: "danger" as const, helper: "Needs updated passport" };
  if (days !== null && days <= 180) return { label: "Expiring Soon", tone: "warning" as const, helper: formatDate(client.passport_expiration_date) };
  if (uploaded) return { label: "Uploaded", tone: "good" as const, helper: client.passport_expiration_date ? formatDate(client.passport_expiration_date) : "Add expiration" };
  return { label: "Missing", tone: "warning" as const, helper: "No passport upload" };
}

function matchesFilter(client: ClientRow, filter: ClientFilter, uploadedPassportIds: Set<string>) {
  const status = passportStatus(client, uploadedPassportIds);
  if (filter === "all") return true;
  if (filter === "recent") return isRecent(client.created_at);
  if (filter === "missing-passport") return !uploadedPassportIds.has(client.id);
  if (filter === "passport-expiring") return status.label === "Expired" || status.label === "Expiring Soon";
  return true;
}

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warning" | "danger" }) {
  const colors = {
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    danger: { background: "#fff1f2", color: "#be123c" },
  }[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap", background: colors.background, color: colors.color }}>{label}</span>;
}

function SummaryCard({ label, value, helper, tone = "neutral" }: { label: string; value: string | number; helper: string; tone?: "neutral" | "good" | "warning" }) {
  const colors = tone === "warning" ? { border: "#fed7aa", background: "#fff7ed", color: "#c2410c" } : tone === "good" ? { border: "#bbf7d0", background: "#ecfdf3", color: "#027a48" } : { border: "#e6f0f2", background: "#ffffff", color: "var(--accent-dark)" };
  return <div className="card" style={{ border: `1px solid ${colors.border}`, background: colors.background }}><span className="label">{label}</span><p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: colors.color }}>{value}</p><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{helper}</p></div>;
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "8px 12px", fontSize: 13 }}>{children}</Link>;
}

function SearchBox({ defaultValue, filter }: { defaultValue: string; filter: ClientFilter }) {
  return (
    <form action="/admin/clients" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="filter" value={filter} />
      <input name="q" type="search" placeholder="Search by name, email, phone, city, travel style..." defaultValue={defaultValue} className="input" style={{ flex: "1 1 320px", minWidth: 260 }} />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? <Link href={`/admin/clients?filter=${filter}`} className="btn btn-outline">Clear</Link> : null}
    </form>
  );
}

export default async function AdminClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q, filter: rawFilter } = await searchParams;
  const searchTerm = String(q ?? "").trim();
  const activeFilter = (["all", "recent", "missing-passport", "passport-expiring"].includes(String(rawFilter)) ? rawFilter : "all") as ClientFilter;
  const { supabase } = await requireAdmin();

  const { data: clients, error } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email, phone_primary, city, state, travel_style, preferred_airport, passport_expiration_date, created_at")
    .order("last_name", { ascending: true });

  const { data: passportDocs } = await supabase
    .from("client_documents")
    .select("client_account_id")
    .eq("document_type", "passport");

  if (error) {
    return <PageShell title="Clients" subtitle="Search and manage client records."><div className="card"><p><strong>Error loading clients:</strong></p><pre>{JSON.stringify(error, null, 2)}</pre></div></PageShell>;
  }

  const allRows = (clients ?? []) as ClientRow[];
  const uploadedPassportIds = new Set(((passportDocs ?? []) as PassportDocRow[]).map((doc) => doc.client_account_id).filter(Boolean) as string[]);
  const rows = allRows
    .filter((client) => matchesFilter(client, activeFilter, uploadedPassportIds))
    .filter((client) => clientMatchesSearch(client, searchTerm));
  const recentCount = allRows.filter((client) => isRecent(client.created_at)).length;
  const missingPassportCount = allRows.filter((client) => !uploadedPassportIds.has(client.id)).length;
  const passportAttentionCount = allRows.filter((client) => matchesFilter(client, "passport-expiring", uploadedPassportIds)).length;
  const base = "/admin/clients";

  return (
    <PageShell title="Clients" subtitle="Search and manage client records.">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, color: "#64748b" }}>Showing {rows.length} of {allRows.length} client records.</p>
        <Link href="/admin/clients/new" className="btn btn-primary">Add New Client</Link>
      </div>

      <div className="grid grid-4">
        <SummaryCard label="Total Clients" value={allRows.length} helper="Client records" />
        <SummaryCard label="Recently Added" value={recentCount} helper="Last 30 days" />
        <SummaryCard label="Missing Passport" value={missingPassportCount} helper="No passport upload" tone={missingPassportCount > 0 ? "warning" : "good"} />
        <SummaryCard label="Passport Attention" value={passportAttentionCount} helper="Expired or expiring soon" tone={passportAttentionCount > 0 ? "warning" : "good"} />
      </div>

      <div className="card stack">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <FilterLink href={base} active={activeFilter === "all"}>All</FilterLink>
          <FilterLink href={`${base}?filter=recent`} active={activeFilter === "recent"}>Recently Added</FilterLink>
          <FilterLink href={`${base}?filter=missing-passport`} active={activeFilter === "missing-passport"}>Missing Passport</FilterLink>
          <FilterLink href={`${base}?filter=passport-expiring`} active={activeFilter === "passport-expiring"}>Passport Attention</FilterLink>
        </div>
        <SearchBox defaultValue={searchTerm} filter={activeFilter} />

        {rows.length === 0 ? (
          <div><p style={{ margin: 0, color: "#64748b" }}>No clients found.</p>{searchTerm ? <p style={{ margin: "6px 0 0", color: "#64748b" }}>Try clearing the search or using a broader term.</p> : null}</div>
        ) : (
          <div className="grid grid-2">
            {rows.map((client) => {
              const status = passportStatus(client, uploadedPassportIds);
              const location = [client.city, client.state].filter(Boolean).join(", ") || "-";
              const attention = status.tone === "danger" || status.tone === "warning";

              return (
                <div
                  key={client.id}
                  className="card stack"
                  style={{
                    border: attention ? "1px solid #fed7aa" : "1px solid #e6f0f2",
                    background: attention ? "#fffbf7" : "#ffffff",
                    borderRadius: 14,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{clientName(client)}</h3>
                      {client.preferred_name ? (
                        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                          Goes by {client.preferred_name}
                        </p>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 6 }}>
                      <Link href={`/admin/clients/${client.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "6px 10px" }}>Open</Link>
                      <Link href={`/admin/clients/${client.id}#private-message`} className="btn btn-outline" style={{ fontSize: 13, padding: "6px 10px" }}>Message</Link>
                      <Link href={`/admin/clients/${client.id}#delete-client`} className="btn btn-outline" style={{ fontSize: 13, padding: "6px 10px", color: "#be123c", borderColor: "#fecaca" }}>Delete</Link>
                    </div>
                  </div>

                  <div className="row">
                    <Badge label={status.label} tone={status.tone} />
                    <span style={{ color: "#64748b", fontSize: 13 }}>{status.helper}</span>
                  </div>

                  <div className="grid grid-2" style={{ gap: 10 }}>
                    <div><span className="label">Email</span><strong>{client.email ?? "-"}</strong></div>
                    <div><span className="label">Phone</span><strong>{client.phone_primary ?? "-"}</strong></div>
                    <div><span className="label">Location</span><strong>{location}</strong></div>
                    <div><span className="label">Airport</span><strong>{client.preferred_airport ?? "-"}</strong></div>
                    <div><span className="label">Travel Style</span><strong>{client.travel_style ?? "-"}</strong></div>
                    <div><span className="label">Added</span><strong>{formatDate(client.created_at)}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}

