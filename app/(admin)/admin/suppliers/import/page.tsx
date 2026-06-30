import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const csvHeaders = [
  "Supplier Name",
  "Supplier Type",
  "Website URL",
  "Booking Portal URL",
  "Contact Name",
  "Contact Email",
  "Contact Phone",
  "Preferred Supplier",
  "BDM Phone",
  "BDM Contact",
  "BDM Notes",
  "Travel Agent Support Phone",
  "Travel Agent Support Contact",
  "Travel Agent Support Notes",
  "Groups Phone",
  "Groups Contact",
  "Groups Notes",
  "Customer Service Phone",
  "Customer Service Contact",
  "Customer Service Notes",
  "Emergency / In Travel Phone",
  "Emergency / In Travel Contact",
  "Emergency / In Travel Notes",
  "Commission Notes",
  "Internal Notes",
];

const phoneMappings = [
  {
    label: "BDM",
    phone: "bdm phone",
    contact: "bdm contact",
    notes: "bdm notes",
  },
  {
    label: "Travel Agent Support",
    phone: "travel agent support phone",
    contact: "travel agent support contact",
    notes: "travel agent support notes",
  },
  {
    label: "Groups",
    phone: "groups phone",
    contact: "groups contact",
    notes: "groups notes",
  },
  {
    label: "Customer Service",
    phone: "customer service phone",
    contact: "customer service contact",
    notes: "customer service notes",
  },
  {
    label: "Emergency / In Travel",
    phone: "emergency / in travel phone",
    contact: "emergency / in travel contact",
    notes: "emergency / in travel notes",
  },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanCell(row: Record<string, string>, key: string) {
  const value = row[normalizeHeader(key)]?.trim();
  return value || null;
}

function parseBoolean(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "1", "y", "preferred"].includes(normalized)) return true;
  if (["no", "false", "0", "n", "standard"].includes(normalized)) return false;
  return null;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);

  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] ?? "";
    });
    return item;
  });
}

function templateCsvHref() {
  const line = csvHeaders.map((header) => `"${header.replace(/"/g, '""')}"`).join(",");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`${line}\n`)}`;
}

async function importSuppliers(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const file = formData.get("supplier_csv") as File | null;

  if (!file || file.size === 0) {
    throw new Error("Choose a CSV file to import.");
  }

  const csvText = await file.text();
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new Error("The CSV did not contain any supplier rows.");
  }

  const { data: existingSuppliers, error: existingError } = await supabase
    .from("suppliers")
    .select("id, supplier_name");

  if (existingError) throw new Error(existingError.message);

  const existingByName = new Map(
    (existingSuppliers ?? []).map((supplier) => [
      String(supplier.supplier_name ?? "").trim().toLowerCase(),
      String(supplier.id),
    ]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const supplierName = cleanCell(row, "Supplier Name");
    if (!supplierName) {
      skipped += 1;
      continue;
    }

    const preferredValue = parseBoolean(cleanCell(row, "Preferred Supplier"));
    const payload: Record<string, unknown> = {
      supplier_name: supplierName,
    };

    const fieldMap = [
      ["supplier_type", "Supplier Type"],
      ["contact_name", "Contact Name"],
      ["contact_email", "Contact Email"],
      ["contact_phone", "Contact Phone"],
      ["website_url", "Website URL"],
      ["booking_portal_url", "Booking Portal URL"],
      ["commission_notes", "Commission Notes"],
      ["internal_notes", "Internal Notes"],
    ] as const;

    for (const [dbField, csvField] of fieldMap) {
      const value = cleanCell(row, csvField);
      if (value) payload[dbField] = value;
    }

    if (preferredValue !== null) {
      payload.preferred_supplier = preferredValue;
    }

    const existingId = existingByName.get(supplierName.toLowerCase());
    let supplierId: string | null = existingId ?? null;

    if (existingId) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", existingId);

      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { data: inserted, error } = await supabase
        .from("suppliers")
        .insert(payload)
        .select("id")
        .single();

      if (error || !inserted) {
        throw new Error(error?.message ?? `Could not create ${supplierName}.`);
      }

      supplierId = String(inserted.id);
      existingByName.set(supplierName.toLowerCase(), supplierId);
      created += 1;
    }

    const phoneRows = phoneMappings
      .map((mapping, index) => {
        const phoneNumber = cleanCell(row, mapping.phone);
        const contactName = cleanCell(row, mapping.contact);
        const notes = cleanCell(row, mapping.notes);

        if (!phoneNumber && !contactName && !notes) return null;

        return {
          supplier_id: supplierId,
          label: mapping.label,
          phone_number: phoneNumber ?? "Not provided",
          contact_name: contactName,
          notes,
          sort_order: index,
        };
      })
      .filter(Boolean);

    if (phoneRows.length > 0 && supplierId) {
      const labels = phoneRows.map((phoneRow: any) => phoneRow.label);
      const { error: deleteError } = await supabase
        .from("supplier_phone_numbers" as any)
        .delete()
        .eq("supplier_id", supplierId)
        .in("label", labels);

      if (deleteError) throw new Error(deleteError.message);

      const { error: phoneError } = await supabase
        .from("supplier_phone_numbers" as any)
        .insert(phoneRows);

      if (phoneError) throw new Error(phoneError.message);
    }
  }

  revalidatePath("/admin/suppliers");
  redirect(`/admin/suppliers/import?created=${created}&updated=${updated}&skipped=${skipped}`);
}

export default async function SupplierImportPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; skipped?: string }>;
}) {
  const { created, updated, skipped } = await searchParams;
  await requireAdmin();

  return (
    <PageShell
      title="Import Suppliers"
      subtitle="Upload supplier records from WorldVia or a spreadsheet."
    >
      {(created || updated || skipped) ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}>
          <p style={{ margin: 0, fontWeight: 900 }}>Supplier import complete.</p>
          <p style={{ margin: "6px 0 0" }}>
            Created {created ?? 0}, updated {updated ?? 0}, skipped {skipped ?? 0}.
          </p>
        </div>
      ) : null}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Fast WorldVia Import Workflow</h2>
        <ol style={{ margin: 0, paddingLeft: 22, color: "#475569", lineHeight: 1.7 }}>
          <li>Use the extractor script while you are on the WorldVia supplier page.</li>
          <li>Download the generated CSV.</li>
          <li>Upload that CSV here.</li>
          <li>Review the imported suppliers from the Suppliers page.</li>
        </ol>
        <div className="row" style={{ gap: 10 }}>
          <a href="/worldvia-supplier-extractor.js" download className="btn btn-outline">
            Download Extractor Script
          </a>
          <a href={templateCsvHref()} download="cozy-supplier-import-template.csv" className="btn btn-outline">
            Download CSV Template
          </a>
          <Link href="/admin/suppliers" className="btn btn-primary">
            Back to Suppliers
          </Link>
        </div>
      </div>

      <form action={importSuppliers} className="card stack">
        <h2 style={{ margin: 0 }}>Upload Supplier CSV</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          Existing suppliers are matched by supplier name. Non-empty fields in the CSV update the supplier record.
        </p>
        <label className="stack-sm">
          <span className="label">CSV File</span>
          <input className="input" type="file" name="supplier_csv" accept=".csv,text/csv" required />
        </label>
        <button type="submit" className="btn btn-primary">
          Import Suppliers
        </button>
      </form>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>CSV Columns Supported</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          The importer looks for these headers. Extra columns are ignored.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {csvHeaders.map((header) => (
            <span key={header} className="badge">
              {header}
            </span>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
