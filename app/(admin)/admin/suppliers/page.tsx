import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

type SupplierLinkRow = {
  supplier_id: string | null;
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

function LinkedBadge({ count }: { count: number }) {
  return (
    <span
      title="Open the supplier to see linked trip components and commissions."
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontWeight: 800,
        fontSize: 12,
        background: "#fff7ed",
        color: "#c2410c",
        whiteSpace: "nowrap",
      }}
    >
      {count} linked
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

async function deleteSupplier(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const supplierId = String(formData.get("supplier_id") ?? "").trim();

  if (!supplierId) throw new Error("Missing supplier ID.");

  const [componentCheck, commissionCheck] = await Promise.all([
    supabase
      .from("trip_components")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId),
    supabase
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId),
  ]);

  if (componentCheck.error) throw new Error(componentCheck.error.message);
  if (commissionCheck.error) throw new Error(commissionCheck.error.message);

  const relatedCount = Number(componentCheck.count ?? 0) + Number(commissionCheck.count ?? 0);
  if (relatedCount > 0) {
    redirect("/admin/suppliers?deleteBlocked=1");
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", supplierId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers?deleted=1");
}

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleteBlocked?: string; deleted?: string }>;
}) {
  const { q, deleteBlocked, deleted } = await searchParams;
  const searchTerm = String(q ?? "").trim();

  const { supabase } = await requireAdmin();

  const [suppliersResult, componentLinksResult, commissionLinksResult] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_name, supplier_type, contact_name, contact_email, contact_phone, website_url, preferred_supplier, created_at")
      .order("supplier_name", { ascending: true }),
    supabase
      .from("trip_components")
      .select("supplier_id")
      .not("supplier_id", "is", null),
    supabase
      .from("commissions")
      .select("supplier_id")
      .not("supplier_id", "is", null),
  ]);

  const { data: suppliers, error } = suppliersResult;

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
  const linkedCounts = new Map<string, number>();

  for (const link of [
    ...((componentLinksResult.data ?? []) as SupplierLinkRow[]),
    ...((commissionLinksResult.data ?? []) as SupplierLinkRow[]),
  ]) {
    if (!link.supplier_id) continue;
    linkedCounts.set(link.supplier_id, (linkedCounts.get(link.supplier_id) ?? 0) + 1);
  }

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

      {deleteBlocked ? (
        <div className="card" style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
          <p style={{ margin: 0, fontWeight: 900 }}>Supplier was not deleted.</p>
          <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
            That supplier is linked to trip components or commissions. Open the supplier record to review what is connected before removing it.
          </p>
        </div>
      ) : null}

      {deleted ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#027a48" }}>
          <p style={{ margin: 0, fontWeight: 900 }}>Supplier deleted.</p>
        </div>
      ) : null}

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((supplier) => {
                  const linkedCount = linkedCounts.get(supplier.id) ?? 0;
                  return (
                  <tr key={supplier.id}>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span>{supplier.supplier_name}</span>
                        {linkedCount > 0 ? <LinkedBadge count={linkedCount} /> : null}
                      </div>
                    </td>
                    <td>{supplier.supplier_type ?? "—"}</td>
                    <td><PreferredBadge preferred={supplier.preferred_supplier} /></td>
                    <td>{supplier.contact_name ?? "—"}</td>
                    <td>{supplier.contact_email ?? "—"}</td>
                    <td>{supplier.contact_phone ?? "—"}</td>
                    <td>{formatDate(supplier.created_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
                          className="btn btn-primary"
                          style={{ fontSize: 13, padding: "5px 12px" }}
                        >
                          Open
                        </Link>
                        {linkedCount > 0 ? (
                          <button
                            type="button"
                            disabled
                            className="btn btn-outline"
                            title="This supplier has linked trip components or commissions."
                            style={{ fontSize: 13, padding: "5px 12px", color: "#94a3b8", borderColor: "#e2e8f0", cursor: "not-allowed" }}
                          >
                            Protected
                          </button>
                        ) : (
                          <form action={deleteSupplier}>
                            <input type="hidden" name="supplier_id" value={supplier.id} />
                            <button
                              type="submit"
                              className="btn btn-outline"
                              style={{ fontSize: 13, padding: "5px 12px", color: "#be123c", borderColor: "#fecaca" }}
                            >
                              Delete
                            </button>
                          </form>
                        )}
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
