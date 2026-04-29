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

function ActionButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 14px",
        borderRadius: 10,
        background: isPrimary ? "var(--accent-dark)" : "white",
        color: isPrimary ? "white" : "var(--accent-dark)",
        border: isPrimary ? "none" : "1px solid var(--accent-dark)",
        fontWeight: 700,
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

export default async function CommissionDetailPage({
  params,
}: {
  params: Promise<{ commissionId: string }>;
}) {
  const { commissionId } = await params;
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

  return (
    <PageShell title={row.commission_name} subtitle="Commission tracking detail.">
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
        <ActionButton href="/admin/commissions" variant="secondary">
          Back to Commissions
        </ActionButton>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {row.client_account_id ? (
            <ActionButton
              href={`/admin/clients/${row.client_account_id}`}
              variant="secondary"
            >
              Open Client
            </ActionButton>
          ) : null}

          {row.trip_id ? (
            <ActionButton href={`/admin/trips/${row.trip_id}`} variant="secondary">
              Open Trip
            </ActionButton>
          ) : null}

          {row.supplier_id ? (
            <ActionButton
              href={`/admin/suppliers/${row.supplier_id}`}
              variant="secondary"
            >
              Open Supplier
            </ActionButton>
          ) : null}

          <ActionButton href={`/admin/commissions/${row.id}/edit`}>
            Edit Commission
          </ActionButton>
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

          <form action={updateCommissionStatus}>
            <input type="hidden" name="commission_id" value={row.id} />
            <input type="hidden" name="commission_status" value="expected" />
            <button type="submit" className="btn btn-outline">
              Mark Expected
            </button>
          </form>

          <form action={updateCommissionStatus}>
            <input type="hidden" name="commission_id" value={row.id} />
            <input type="hidden" name="commission_status" value="pending" />
            <button type="submit" className="btn btn-outline">
              Mark Pending
            </button>
          </form>

          <form action={updateCommissionStatus}>
            <input type="hidden" name="commission_id" value={row.id} />
            <input type="hidden" name="commission_status" value="partial" />
            <button type="submit" className="btn btn-outline">
              Mark Partial
            </button>
          </form>

          <form action={updateCommissionStatus}>
            <input type="hidden" name="commission_id" value={row.id} />
            <input type="hidden" name="commission_status" value="overdue" />
            <button type="submit" className="btn btn-outline">
              Mark Overdue
            </button>
          </form>

          <form action={updateCommissionStatus}>
            <input type="hidden" name="commission_id" value={row.id} />
            <input type="hidden" name="commission_status" value="cancelled" />
            <button type="submit" className="btn btn-outline">
              Mark Cancelled
            </button>
          </form>
        </div>

        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
          Mark Received will set the received amount to your expected commission
          amount and set today as the received payment date.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Commission Information</h2>

        <div className="grid grid-2">
          <InfoItem label="Commission Name" value={row.commission_name} />
          <InfoItem label="Booking Number" value={row.booking_number} />
          <InfoItem label="Status" value={row.commission_status ?? "expected"} />
          <InfoItem label="Created" value={formatDateTime(row.created_at)} />
        </div>

        <div>
          <span className="label">Current Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusBadge status={row.commission_status} />
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Connections</h2>

        <div className="grid grid-2">
          <InfoItem label="Client" value={row.client_name_snapshot} />
          <InfoItem label="Trip" value={row.trip_name_snapshot} />
          <InfoItem label="Supplier" value={row.supplier_name_snapshot} />
        </div>
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
    </PageShell>
  );
}