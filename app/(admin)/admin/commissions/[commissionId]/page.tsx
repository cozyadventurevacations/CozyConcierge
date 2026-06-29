import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const allowedCommissionStatuses = [
  "expected",
  "pending",
  "received",
  "partial",
  "overdue",
  "cancelled",
];

type CommissionDetail = {
  id: string;
  client_account_id: string | null;
  trip_id: string | null;
  component_id: string | null;
  component_type: string | null;
  supplier_id: string | null;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  client_name_snapshot: string | null;
  trip_name_snapshot: string | null;
  gross_booking_amount: number | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
  notes: string | null;
  created_at: string | null;
};

type CommissionDocumentRow = {
  id: string;
  file_name: string;
  storage_path: string;
  visibility: string | null;
  component_type: string | null;
  created_at: string | null;
  signedUrl?: string | null;
};

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = "Not provided") {
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

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
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

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function calculateExpectedCommission(
  fullCommissionAmount: number | null | undefined,
  agencyCommissionPercent: number | null | undefined,
) {
  const fullCommission = Number(fullCommissionAmount ?? 0);
  const percentage = Number(agencyCommissionPercent ?? 90);

  return Math.round(fullCommission * (percentage / 100) * 100) / 100;
}

function getComponentTypeLabel(componentType: string | null | undefined) {
  const labels: Record<string, string> = {
    hotel: "Hotel",
    air: "Air",
    cruise: "Cruise",
    transfer: "Transfer",
    activity: "Activity",
    insurance: "Insurance",
  };

  return componentType ? labels[componentType] ?? componentType : "Not linked";
}

function getVisibilityLabel(visibility: string | null | undefined) {
  if (visibility === "client") return "Client & Agent";
  if (visibility === "travel_circle") return "Travel Circle & Agent";
  return "Agent Only";
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid #eef2f5",
        borderRadius: 12,
        background: "#fbfdfe",
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "6px 0 0", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
        {value === null || value === undefined || value === ""
          ? "Not provided"
          : value}
      </p>
    </div>
  );
}

function ActionButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-primary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "expected";

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
      {label}
    </span>
  );
}

function StatusButton({
  commissionId,
  status,
  label,
}: {
  commissionId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updateCommissionStatus}>
      <input type="hidden" name="commission_id" value={commissionId} />
      <input type="hidden" name="commission_status" value={status} />
      <button type="submit" className="btn btn-primary">
        {label}
      </button>
    </form>
  );
}

async function updateCommissionStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const commissionId = String(formData.get("commission_id") ?? "").trim();
  const newStatus = String(formData.get("commission_status") ?? "").trim();

  if (!commissionId) {
    throw new Error("Missing commission ID.");
  }

  if (!allowedCommissionStatuses.includes(newStatus)) {
    throw new Error("Invalid commission status.");
  }

  const { error } = await supabase
    .from("commissions")
    .update({
      commission_status: newStatus,
    })
    .eq("id", commissionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/commissions");
  revalidatePath(`/admin/commissions/${commissionId}`);

  redirect(`/admin/commissions/${commissionId}`);
}

async function markCommissionReceived(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const commissionId = String(formData.get("commission_id") ?? "").trim();

  if (!commissionId) {
    throw new Error("Missing commission ID.");
  }

  const { data: commission, error: loadError } = await supabase
    .from("commissions")
    .select(
      "id, full_commission_amount, agency_commission_percent, expected_commission_amount",
    )
    .eq("id", commissionId)
    .single();

  if (loadError || !commission) {
    throw new Error(loadError?.message ?? "Commission not found.");
  }

  const calculatedExpectedAmount = calculateExpectedCommission(
    commission.full_commission_amount,
    commission.agency_commission_percent,
  );

  const receivedAmount =
    Number(commission.expected_commission_amount ?? 0) || calculatedExpectedAmount;

  const { error } = await supabase
    .from("commissions")
    .update({
      commission_status: "received",
      expected_commission_amount: receivedAmount,
      received_commission_amount: receivedAmount,
      received_payment_date: todayDateString(),
    })
    .eq("id", commissionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/commissions");
  revalidatePath(`/admin/commissions/${commissionId}`);

  redirect(`/admin/commissions/${commissionId}`);
}

async function deleteCommission(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const commissionId = String(formData.get("commission_id") ?? "").trim();

  if (!commissionId) {
    throw new Error("Missing commission ID.");
  }

  const { error } = await supabase
    .from("commissions")
    .delete()
    .eq("id", commissionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/commissions");
  redirect("/admin/commissions?deleted=1");
}

export default async function CommissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ commissionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { commissionId } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: commission, error } = await supabase
    .from("commissions")
    .select("*")
    .eq("id", commissionId)
    .single();

  if (error || !commission) {
    return (
      <PageShell
        title="Commission Detail"
        subtitle="We could not load this commission."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const row = commission as CommissionDetail;

  const calculatedExpectedCommission = calculateExpectedCommission(
    row.full_commission_amount,
    row.agency_commission_percent,
  );

  const expectedCommissionAmount =
    Number(row.expected_commission_amount ?? 0) || calculatedExpectedCommission;

  const outstandingAmount =
    expectedCommissionAmount - Number(row.received_commission_amount ?? 0);

  const attachedDocuments: CommissionDocumentRow[] = row.trip_id && row.component_id
    ? await (async () => {
        const { data: documents } = await supabase
          .from("trip_documents")
          .select("id, file_name, storage_path, visibility, component_type, created_at")
          .eq("trip_id", row.trip_id)
          .eq("component_id", row.component_id)
          .order("created_at", { ascending: false });

        return Promise.all(
          ((documents ?? []) as CommissionDocumentRow[]).map(async (document) => {
            const { data } = await supabase.storage
              .from("trip-documents")
              .createSignedUrl(document.storage_path, 60 * 60);

            return {
              ...document,
              signedUrl: data?.signedUrl ?? null,
            };
          }),
        );
      })()
    : [];

  return (
    <PageShell title={row.commission_name} subtitle="Commission tracking detail.">
      {saved === "created" || saved === "updated" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontWeight: 900 }}>
            {saved === "created" ? "Commission created successfully." : "Commission saved successfully."}
          </p>
          <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
            You are viewing the saved commission record.
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <ActionButton href="/admin/commissions">
          Back to Commissions
        </ActionButton>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {row.client_account_id ? (
            <ActionButton href={`/admin/clients/${row.client_account_id}`}>
              Open Client
            </ActionButton>
          ) : null}

          {row.trip_id ? (
            <ActionButton href={`/admin/trips/${row.trip_id}`}>
              Open Trip
            </ActionButton>
          ) : null}

          {row.supplier_id ? (
            <ActionButton href={`/admin/suppliers/${row.supplier_id}`}>
              Open Supplier
            </ActionButton>
          ) : null}

          <ActionButton href={`/admin/commissions/${row.id}/edit`}>
            Edit Commission
          </ActionButton>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Commission Detail
            </p>

            <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>
              {row.commission_name}
            </h1>

            <p style={{ margin: "6px 0 0", color: "#667085" }}>
              {row.client_name_snapshot ?? "Client not provided"} •{" "}
              {row.trip_name_snapshot ?? "Trip not provided"}
            </p>
          </div>

          <StatusBadge status={row.commission_status} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Full Commission</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(row.full_commission_amount)}
          </p>
        </div>

        <div className="card">
          <span className="label">Your Expected Commission</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(expectedCommissionAmount)}
          </p>
        </div>

        <div className="card">
          <span className="label">Received Commission</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(row.received_commission_amount)}
          </p>
        </div>
      </div>

      <div className="card">
        <span className="label">Outstanding</span>
        <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
          {formatMoney(outstandingAmount)}
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Quick Actions</h2>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <form action={markCommissionReceived}>
            <input type="hidden" name="commission_id" value={row.id} />
            <button type="submit" className="btn btn-primary">
              Mark Received
            </button>
          </form>

          <StatusButton commissionId={row.id} status="expected" label="Mark Expected" />
          <StatusButton commissionId={row.id} status="pending" label="Mark Pending" />
          <StatusButton commissionId={row.id} status="partial" label="Mark Partial" />
          <StatusButton commissionId={row.id} status="overdue" label="Mark Overdue" />
          <StatusButton commissionId={row.id} status="cancelled" label="Mark Cancelled" />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Commission Information</h2>

        <div className="grid grid-2">
          <InfoItem label="Commission Name" value={row.commission_name} />
          <InfoItem label="Booking Number" value={row.booking_number} />
          <InfoItem label="Status" value={row.commission_status ?? "expected"} />
          <InfoItem label="Created" value={formatDateTime(row.created_at)} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Connections</h2>

        <div className="grid grid-2">
          <InfoItem label="Client" value={row.client_name_snapshot} />
          <InfoItem label="Trip" value={row.trip_name_snapshot} />
          <InfoItem label="Trip Component" value={getComponentTypeLabel(row.component_type)} />
          <InfoItem label="Supplier" value={row.supplier_name_snapshot} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Attached Component Documents</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          These secure files come from the trip documents attached to the same travel component as this commission.
        </p>

        {!row.component_id ? (
          <p style={{ margin: 0, color: "#667085" }}>
            This commission is not linked to a trip component.
          </p>
        ) : attachedDocuments.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>
            No documents are attached to this component yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Component</th>
                  <th>Visibility</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {attachedDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>{document.file_name}</td>
                    <td>{getComponentTypeLabel(document.component_type)}</td>
                    <td>{getVisibilityLabel(document.visibility)}</td>
                    <td>{formatDateTime(document.created_at)}</td>
                    <td>
                      {document.signedUrl ? (
                        <a
                          href={document.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap" }}
                        >
                          Open Secure Link
                        </a>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Amounts</h2>

        <div className="grid grid-2">
          <InfoItem
            label="Gross Booking Amount"
            value={formatMoney(row.gross_booking_amount)}
          />
          <InfoItem
            label="Full Commission"
            value={formatMoney(row.full_commission_amount)}
          />
          <InfoItem
            label="Your Commission Percentage"
            value={`${row.agency_commission_percent ?? 90}%`}
          />
          <InfoItem
            label="Your Expected Commission"
            value={formatMoney(expectedCommissionAmount)}
          />
          <InfoItem
            label="Received Commission Amount"
            value={formatMoney(row.received_commission_amount)}
          />
          <InfoItem label="Outstanding Amount" value={formatMoney(outstandingAmount)} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Payment Timing</h2>

        <div className="grid grid-2">
          <InfoItem
            label="Expected Payment Date"
            value={formatDate(row.expected_payment_date)}
          />
          <InfoItem
            label="Received Payment Date"
            value={formatDate(row.received_payment_date)}
          />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Notes</h2>
        <InfoItem label="Notes" value={row.notes} />
      </div>

      <div className="card stack" style={{ border: "1px solid #fecaca", background: "#fff1f2" }}>
        <h2 style={{ margin: 0, color: "#be123c" }}>Delete Commission</h2>
        <p style={{ margin: 0, color: "#9f1239", lineHeight: 1.6 }}>
          This permanently removes this commission record. Use this for duplicates or commissions entered by mistake.
        </p>
        <form action={deleteCommission}>
          <input type="hidden" name="commission_id" value={row.id} />
          <button type="submit" className="btn btn-outline" style={{ color: "#be123c", borderColor: "#fecaca" }}>
            Delete Commission
          </button>
        </form>
      </div>
    </PageShell>
  );
}
