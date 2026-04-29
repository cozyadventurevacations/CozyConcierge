import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_primary: string | null;
  city: string | null;
  state: string | null;
  travel_style: string | null;
  preferred_airport: string | null;
  created_at: string | null;
};

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
  });
}

function clientMatchesSearch(client: ClientRow, searchTerm: string) {
  if (!searchTerm) return true;

  const haystack = [
    client.first_name,
    client.last_name,
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
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <input
        name="q"
        type="search"
        placeholder="Search clients by name, email, phone, city, travel style..."
        defaultValue={defaultValue}
        style={{
          flex: "1 1 320px",
          minWidth: 260,
        }}
      />

      <button type="submit" className="button">
        Search
      </button>

      {defaultValue ? (
        <Link href="/admin/clients" className="button-secondary">
          Clear
        </Link>
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
    .select(
      "id, first_name, last_name, email, phone_primary, city, state, travel_style, preferred_airport, created_at",
    )
    .order("last_name", { ascending: true });

  if (error) {
    return (
      <PageShell title="Clients" subtitle="Search and manage client records.">
        <div className="card">
          <p>
            <strong>Error loading clients:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = ((clients ?? []) as ClientRow[]).filter((client) =>
    clientMatchesSearch(client, searchTerm),
  );

  return (
    <PageShell title="Clients" subtitle="Search and manage client records.">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#64748b" }}>
            Showing {rows.length} of {(clients ?? []).length} client records.
          </p>
        </div>

        <Link
          href="/admin/clients/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--accent-dark)",
            color: "white",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Add New Client
        </Link>
      </div>

      <div className="card stack">
        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <div>
            <p>No clients found.</p>
            {searchTerm ? (
              <p style={{ color: "#64748b" }}>
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
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Travel Style</th>
                  <th>Airport</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((client) => {
                  const clientName =
                    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
                    "Unnamed Client";

                  const location =
                    [client.city, client.state].filter(Boolean).join(", ") ||
                    "Not provided";

                  return (
                    <tr key={client.id}>
                      <td>{clientName}</td>
                      <td>{client.email ?? "Not provided"}</td>
                      <td>{client.phone_primary ?? "Not provided"}</td>
                      <td>{location}</td>
                      <td>{client.travel_style ?? "Not provided"}</td>
                      <td>{client.preferred_airport ?? "Not provided"}</td>
                      <td>{formatDateTime(client.created_at)}</td>
                      <td>
                        <Link
                          href={`/admin/clients/${client.id}`}
                          style={{
                            color: "var(--accent-dark)",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
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