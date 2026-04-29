import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type SupplierRow = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  preferred_supplier: boolean | null;
  created_at: string | null;
};

function formatDate(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

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

function supplierMatchesSearch(supplier: SupplierRow, searchTerm: string) {
  if (!searchTerm) return true;

  const preferredText = supplier.preferred_supplier
    ? "preferred yes"
    : "not preferred no";

  const haystack = [
    supplier.supplier_name,
    supplier.supplier_type,
    supplier.contact_name,
    supplier.contact_email,
    supplier.contact_phone,
    supplier.website_url,
    preferredText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/admin/suppliers"
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
        placeholder="Search suppliers by name, type, contact, email, phone, preferred..."
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
        <Link href="/admin/suppliers" className="button-secondary">
          Clear
        </Link>
      ) : null}
    </form>
  );
}

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searchTerm = String(q ?? "").trim();

  const { supabase } = await requireAdmin();

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select(
      "id, supplier_name, supplier_type, contact_name, contact_email, contact_phone, website_url, preferred_supplier, created_at",
    )
    .order("supplier_name", { ascending: true });

  if (error) {
    return (
      <PageShell title="Suppliers" subtitle="Manage supplier and vendor records.">
        <div className="card">
          <p>
            <strong>Error loading suppliers:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const allRows = (suppliers ?? []) as SupplierRow[];
  const rows = allRows.filter((supplier) =>
    supplierMatchesSearch(supplier, searchTerm),
  );

  return (
    <PageShell title="Suppliers" subtitle="Manage supplier and vendor records.">
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
        <p style={{ margin: 0, color: "#64748b" }}>
          Showing {rows.length} of {allRows.length} supplier record
          {allRows.length === 1 ? "" : "s"}.
        </p>

        <Link
          href="/admin/suppliers/new"
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
          Add New Supplier
        </Link>
      </div>

      <div className="card stack">
        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <div>
            <h2 style={{ margin: 0 }}>No suppliers found</h2>
            {searchTerm ? (
              <p style={{ color: "#64748b" }}>
                Try clearing the search or using a broader term.
              </p>
            ) : (
              <p>
                Add suppliers to keep vendor contacts, booking portals, and commission
                notes organized.
              </p>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>Supplier Records</h2>

            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Type</th>
                    <th>Preferred</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.supplier_name}</td>
                      <td>{supplier.supplier_type ?? "Not provided"}</td>
                      <td>{supplier.preferred_supplier ? "Yes" : "No"}</td>
                      <td>{supplier.contact_name ?? "Not provided"}</td>
                      <td>{supplier.contact_email ?? "Not provided"}</td>
                      <td>{supplier.contact_phone ?? "Not provided"}</td>
                      <td>{formatDate(supplier.created_at)}</td>
                      <td>
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
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
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}