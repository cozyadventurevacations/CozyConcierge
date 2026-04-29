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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function supplierMatchesSearch(supplier: SupplierRow, searchTerm: string) {
  if (!searchTerm) return true;
  const haystack = [
    supplier.supplier_name,
    supplier.supplier_type,
    supplier.contact_name,
    supplier.contact_email,
    supplier.contact_phone,
    supplier.website_url,
    supplier.preferred_supplier ? "preferred yes" : "not preferred no",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function PreferredBadge({ preferred }: { preferred: boolean | null }) {
  return preferred ? (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "4px 10px", fontWeight: 700, fontSize: 13,
      background: "#ecfdf3", color: "#027a48",
    }}>
      Preferred
    </span>
  ) : (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 999,
      padding: "4px 10px", fontWeight: 700, fontSize: 13,
      background: "#f1f5f9", color: "#475569",
    }}>
      Standard
    </span>
  );
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/admin/suppliers"
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        name="q"
        type="search"
        placeholder="Search by name, type, contact, email, phone..."
        defaultValue={defaultValue}
        className="input"
        style={{ flex: "1 1 320px", minWidth: 260 }}
      />
      <button type="submit" className="btn btn-primary">Search</button>
      {defaultValue ? (
        <Link href="/admin/suppliers" className="btn btn-primary">Clear</Link>
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
    .select("id, supplier_name, supplier_type, contact_name, contact_email, contact_phone, website_url, preferred_supplier, created_at")
    .order("supplier_name", { ascending: true });

  if (error) {
    return (
      <PageShell title="Suppliers" subtitle="Manage supplier and vendor records.">
        <div className="card">
          <p><strong>Error loading suppliers:</strong></p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const allRows = (suppliers ?? []) as SupplierRow[];
  const rows = allRows.filter((supplier) => supplierMatchesSearch(supplier, searchTerm));

  return (
    <PageShell title="Suppliers" subtitle="Manage supplier and vendor records.">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, color: "#64748b" }}>
          Showing {rows.length} of {allRows.length} supplier record{allRows.length === 1 ? "" : "s"}.
        </p>
        <Link href="/admin/suppliers/new" className="btn btn-primary">
          Add New Supplier
        </Link>
      </div>

      <div className="card stack">
        <SearchBox defaultValue={searchTerm} />

        {rows.length === 0 ? (
          <div>
            <p style={{ margin: 0, color: "#64748b" }}>
              {searchTerm
                ? "No suppliers found. Try clearing the search or using a broader term."
                : "No suppliers yet. Add suppliers to keep vendor contacts and commission notes organized."}
            </p>
          </div>
        ) : (
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
                  <th>Added</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.supplier_name}</td>
                    <td>{supplier.supplier_type ?? "—"}</td>
                    <td><PreferredBadge preferred={supplier.preferred_supplier} /></td>
                    <td>{supplier.contact_name ?? "—"}</td>
                    <td>{supplier.contact_email ?? "—"}</td>
                    <td>{supplier.contact_phone ?? "—"}</td>
                    <td>{formatDate(supplier.created_at)}</td>
                    <td>
                      <Link
                        href={`/admin/suppliers/${supplier.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "5px 12px" }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}