import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type PaymentRequestDetail = {
  id: string;
  status: string;
  requested_amount: number | null;
  requested_payment_date: string | null;
  requested_at: string | null;
  completed_at: string | null;
  client_message: string | null;
  trip_id: string;
  client_account_id: string;
  trips:
    | {
        id: string;
        trip_name: string | null;
        balance_due: number | null;
        final_payment_due_date: string | null;
        trip_status: string | null;
      }[]
    | null;
  client_accounts:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone_primary: string | null;
      }[]
    | null;
};

const allowedStatuses = ["new", "sent", "completed", "cancelled", "declined"];
const billableTripComponentTypes = [
  "hotel",
  "air",
  "cruise",
  "transfer",
  "rental_car",
  "activity",
  "insurance",
];

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function recalculateTripPaymentTotals(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tripId: string,
) {
  const [
    { data: components, error: componentsError },
    { data: proposal, error: proposalError },
    { data: ledgerEntries, error: ledgerError },
  ] = await Promise.all([
    supabase
      .from("trip_components" as any)
      .select("component_type, total_price")
      .eq("trip_id", tripId)
      .in("component_type", billableTripComponentTypes),
    supabase
      .from("trip_proposals" as any)
      .select("id, planning_fee")
      .eq("trip_id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_payment_ledger" as any)
      .select("entry_type, amount")
      .eq("trip_id", tripId),
  ]);

  if (componentsError) {
    throw new Error(componentsError.message);
  }

  if (proposalError) {
    throw new Error(proposalError.message);
  }

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const componentTotal = (components ?? []).reduce(
    (sum, component) => sum + Number(component.total_price ?? 0),
    0,
  );
  const planningFee = Number(proposal?.planning_fee ?? 0);
  const calculatedTripTotal = roundMoney(componentTotal + planningFee);

  const ledgerTotalPaid = (ledgerEntries ?? []).reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    if (entry.entry_type === "payment") return sum + amount;
    if (entry.entry_type === "refund") return sum - amount;
    return sum;
  }, 0);

  const ledgerBalanceAdjustment = (ledgerEntries ?? []).reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    if (entry.entry_type === "credit") return sum - amount;
    if (entry.entry_type === "fee" || entry.entry_type === "adjustment") {
      return sum + amount;
    }
    return sum;
  }, 0);

  const totalPaid = Math.max(0, roundMoney(ledgerTotalPaid));
  const balanceDue = Math.max(
    0,
    roundMoney(calculatedTripTotal - totalPaid + ledgerBalanceAdjustment),
  );

  const { error: tripUpdateError } = await supabase
    .from("trips")
    .update({
      total_paid: totalPaid,
      balance_due: balanceDue,
    })
    .eq("id", tripId);

  if (tripUpdateError) {
    throw new Error(tripUpdateError.message);
  }

  if (proposal?.id) {
    const { error: proposalUpdateError } = await supabase
      .from("trip_proposals" as any)
      .update({ total_price: calculatedTripTotal })
      .eq("id", proposal.id);

    if (proposalUpdateError) {
      throw new Error(proposalUpdateError.message);
    }
  }
}

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

function StatusBadge({ status }: { status: string | null | undefined }) {
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
      {status ?? "new"}
    </span>
  );
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

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
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

function StatusButton({
  requestId,
  status,
  label,
}: {
  requestId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updatePaymentRequestStatus}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="btn btn-primary">
        {label}
      </button>
    </form>
  );
}

async function updatePaymentRequestStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();

  if (!requestId) {
    throw new Error("Missing payment request ID.");
  }

  if (!allowedStatuses.includes(newStatus)) {
    throw new Error("Invalid payment request status.");
  }

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("payment_requests")
    .select("id, trip_id, status, requested_amount, requested_payment_date")
    .eq("id", requestId)
    .single();

  if (existingRequestError || !existingRequest) {
    throw new Error(existingRequestError?.message ?? "Payment request not found.");
  }

  const previousStatus = String(existingRequest.status ?? "new").toLowerCase();
  const requestedAmount = Number(existingRequest.requested_amount ?? 0);
  const ledgerReference = `payment-request:${requestId}`;

  let hasLinkedLedgerEntry = false;

  if (newStatus === "completed" || previousStatus === "completed") {
    const { data: linkedLedgerEntry, error: linkedLedgerError } = await supabase
      .from("trip_payment_ledger" as any)
      .select("id")
      .eq("trip_id", existingRequest.trip_id)
      .eq("reference_number", ledgerReference)
      .maybeSingle();

    if (linkedLedgerError) {
      throw new Error(linkedLedgerError.message);
    }

    hasLinkedLedgerEntry = Boolean(linkedLedgerEntry);
  }

  const isCompletingPayment = newStatus === "completed" && !hasLinkedLedgerEntry;
  const isReopeningCompletedPayment =
    previousStatus === "completed" && newStatus !== "completed" && hasLinkedLedgerEntry;

  if ((isCompletingPayment || isReopeningCompletedPayment) && requestedAmount <= 0) {
    throw new Error("This payment request does not have a valid amount to apply to the trip.");
  }

  const updates: {
    status: string;
    completed_at?: string | null;
  } = {
    status: newStatus,
  };

  if (newStatus === "completed") {
    updates.completed_at = new Date().toISOString();
  } else {
    updates.completed_at = null;
  }

  const { error } = await supabase
    .from("payment_requests")
    .update(updates)
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  if (isCompletingPayment || isReopeningCompletedPayment) {
    if (isCompletingPayment) {
      const { error: ledgerError } = await supabase
        .from("trip_payment_ledger" as any)
        .insert({
          trip_id: existingRequest.trip_id,
          entry_type: "payment",
          amount: requestedAmount,
          entry_date: existingRequest.requested_payment_date ?? todayDateString(),
          payment_method: "Client payment request",
          reference_number: ledgerReference,
          notes: "Applied automatically when the payment request was marked completed.",
        });

      if (ledgerError) {
        throw new Error(ledgerError.message);
      }
    }

    if (isReopeningCompletedPayment) {
      const { error: ledgerDeleteError } = await supabase
        .from("trip_payment_ledger" as any)
        .delete()
        .eq("trip_id", existingRequest.trip_id)
        .eq("reference_number", ledgerReference);

      if (ledgerDeleteError) {
        throw new Error(ledgerDeleteError.message);
      }
    }
  }

  if (newStatus === "completed" || previousStatus === "completed") {
    await recalculateTripPaymentTotals(supabase, existingRequest.trip_id);
  }

  revalidatePath("/admin/payment-requests");
  revalidatePath(`/admin/payment-requests/${requestId}`);
  revalidatePath(`/admin/trips/${existingRequest.trip_id}`);
  revalidatePath(`/trips/${existingRequest.trip_id}`);
}

export default async function AdminPaymentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { supabase } = await requireAdmin();

  if (!requestId || requestId === "undefined") {
    return (
      <PageShell
        title="Payment Request Detail"
        subtitle="We could not load this payment request."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>Missing payment request ID.</p>
        </div>
      </PageShell>
    );
  }

  const { data, error } = await supabase
    .from("payment_requests")
    .select(
      `
      id,
      status,
      requested_amount,
      requested_payment_date,
      requested_at,
      completed_at,
      client_message,
      trip_id,
      client_account_id,
      trips!payment_requests_trip_id_fkey (
        id,
        trip_name,
        balance_due,
        final_payment_due_date,
        trip_status
      ),
      client_accounts!payment_requests_client_account_id_fkey (
        first_name,
        last_name,
        email,
        phone_primary
      )
    `,
    )
    .eq("id", requestId)
    .single();

  if (error || !data) {
    return (
      <PageShell
        title="Payment Request Detail"
        subtitle="We could not load this payment request."
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

  const request = data as PaymentRequestDetail;
  const trip = request.trips?.[0] ?? null;
  const client = request.client_accounts?.[0] ?? null;

  const clientName = client
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : "Unknown Client";

  const emailSubject = encodeURIComponent(
    `Payment link for ${trip?.trip_name ?? "your trip"}`,
  );

  const emailBody = encodeURIComponent(
    `Hi ${client?.first_name ?? ""},\n\nYour payment link for ${
      trip?.trip_name ?? "your trip"
    } is ready.\n\nRequested amount: ${formatMoney(
      request.requested_amount,
    )}\nRequested payment date: ${formatDate(
      request.requested_payment_date,
    )}\n\n`,
  );

  return (
    <PageShell
      title="Payment Request Detail"
      subtitle={`${clientName || "Unknown Client"} • ${trip?.trip_name ?? "Unknown Trip"}`}
    >
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
        <ActionLink href="/admin/payment-requests">
          Back to Payment Requests
        </ActionLink>

        {trip ? (
          <ActionLink href={`/admin/trips/${trip.id}`}>Open Linked Trip</ActionLink>
        ) : null}
      </div>

      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 70%)",
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
              Payment Request
            </p>

            <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>
              {formatMoney(request.requested_amount)}
            </h1>

            <p style={{ margin: "6px 0 0", color: "#667085" }}>
              {clientName || "Unknown Client"} • {trip?.trip_name ?? "Unknown Trip"}
            </p>
          </div>

          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Requested Amount</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(request.requested_amount)}
          </p>
        </div>

        <div className="card">
          <span className="label">Requested Payment Date</span>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>
            {formatDate(request.requested_payment_date)}
          </p>
        </div>

        <div className="card">
          <span className="label">Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusBadge status={request.status} />
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Request Details</h2>

        <div className="grid grid-2">
          <InfoItem label="Submitted" value={formatDateTime(request.requested_at)} />
          <InfoItem label="Completed" value={formatDateTime(request.completed_at)} />
          <InfoItem label="Client" value={clientName || "Unknown Client"} />
          <InfoItem label="Client Email" value={client?.email ?? "Not provided"} />
          <InfoItem label="Client Phone" value={client?.phone_primary ?? "Not provided"} />
          <InfoItem label="Trip" value={trip?.trip_name ?? "Unknown Trip"} />
        </div>

        <InfoItem
          label="Client Message"
          value={request.client_message ?? "No message provided."}
        />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusButton requestId={request.id} status="new" label="Mark New" />
          <StatusButton requestId={request.id} status="sent" label="Mark Sent" />
          <StatusButton requestId={request.id} status="completed" label="Mark Completed" />
          <StatusButton requestId={request.id} status="cancelled" label="Mark Cancelled" />
          <StatusButton requestId={request.id} status="declined" label="Mark Declined" />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Client Follow-Up</h2>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {client?.email ? (
            <a
              href={`mailto:${client.email}?subject=${emailSubject}&body=${emailBody}`}
              className="btn btn-primary"
            >
              Email Client
            </a>
          ) : null}

          <ActionLink href="/admin/payment-requests">
            Back to Payment Requests
          </ActionLink>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Linked Trip</h2>

        <div className="grid grid-2">
          <InfoItem label="Trip Name" value={trip?.trip_name ?? "Unknown Trip"} />
          <InfoItem label="Trip Status" value={trip?.trip_status ?? "Not provided"} />
          <InfoItem label="Balance Due" value={formatMoney(trip?.balance_due)} />
          <InfoItem
            label="Final Payment Due Date"
            value={formatDate(trip?.final_payment_due_date)}
          />
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {trip ? (
            <ActionLink href={`/admin/trips/${trip.id}`}>Open Linked Trip</ActionLink>
          ) : null}

          <ActionLink href="/admin/payment-requests">
            Back to Payment Requests
          </ActionLink>
        </div>
      </div>
    </PageShell>
  );
}
