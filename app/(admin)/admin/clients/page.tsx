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
  created_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function clientMatchesSearch(client: ClientRow, searchTerm: string) {
  if (!searchTerm) return true;
  const haystack = [
    client.first_name,
    client.last_name,
    client.preferred_name,
    client.email,
    client.phone_primary,
    client.city,
    client.state,
    client.travel_style,
    client.preferred_airport,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/admin/clients"
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        name="q"
        type="search"
        placeholder="Search by name, email, phone, city, travel style..."
        defaultValue={defaultValue}
        className="input"
        style={{ flex: "1 1 320px", minWidth: 260 }}
      />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? (
        <Link href="/admin/clients" className="btn btn-primary">Clear</Link>
      ) : null}
    </form>
  );
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searchTerm = String(q ?? "").trim();

  const { supabase } = await requireAdmin();

  const { data: clients, error } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email, phone_primary, city, state, travel_style, preferred_airport, created_at")
    .order("last_name", { ascending: true });

  if (error) {
    return (
      <PageShell title="Clients" subtitle="Search and manage client records.">
        <div className="card">
          <p><strong>Error loading clients:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = ((clients ?? []) as ClientRow[]).filter((client) =>
    clientMatchesSearch(client, searchTerm)
  );

  return (
    <PageShell title="Clients" subtitle="Search and manage client records.">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, color: "#64748b" }}>
          Showing {rows.length} of {(clients ?? []).length} client records.
        </p>
        <Link href="/admin/clients/new" className="btn btn-primary">
          Add New Client
        </Link>
      </div>

      <div className="card stack">
        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <div>
            <p style={{ margin: 0, color: "#64748b" }}>No clients found.</p>
            {searchTerm ? (
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Try clearing the search or using a broader term.
              </p>
            ) : null}
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Goes By</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Travel Style</th>
                  <th>Airport</th>
                  <th>Added</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const clientName =
                    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "—";
                  const location =
                    [client.city, client.state].filter(Boolean).join(", ") || "—";

                  return (
                    <tr key={client.id}>
                      <td>{clientName}</td>
                      <td>{client.preferred_name ?? "—"}</td>
                      <td>{client.email ?? "—"}</td>
                      <td>{client.phone_primary ?? "—"}</td>
                      <td>{location}</td>
                      <td>{client.travel_style ?? "—"}</td>
                      <td>{client.preferred_airport ?? "—"}</td>
                      <td>{formatDate(client.created_at)}</td>
                      <td>
                        <Link href={`/admin/clients/${client.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "5px 12px" }}>
                          Open
                        </Link>
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