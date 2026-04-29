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

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;
  return `$${value.toFixed(2)}`;
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
      <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
        {value === null || value === undefined || value === ""
          ? "Not provided"
          : value}
      </p>
    </div>
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
    .select("id, trip_id")
    .eq("id", requestId)
    .single();

  if (existingRequestError || !existingRequest) {
    throw new Error(
      existingRequestError?.message ?? "Payment request not found.",
    );
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
      subtitle="Review the full payment request details below."
    >
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
              {clientName || "Unknown Client"} •{" "}
              {trip?.trip_name ?? "Unknown Trip"}
            </p>
          </div>

          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Request Details</h2>

        <div className="grid grid-2">
          <InfoItem label="Status" value={request.status} />
          <InfoItem label="Submitted" value={formatDateTime(request.requested_at)} />
          <InfoItem label="Completed" value={formatDateTime(request.completed_at)} />
          <InfoItem
            label="Requested Amount"
            value={formatMoney(request.requested_amount)}
          />
          <InfoItem
            label="Requested Payment Date"
            value={formatDate(request.requested_payment_date)}
          />
          <InfoItem label="Client" value={clientName || "Unknown Client"} />
          <InfoItem label="Client Email" value={client?.email ?? "Not provided"} />
          <InfoItem
            label="Client Phone"
            value={client?.phone_primary ?? "Not provided"}
          />
        </div>

        <div
          style={{
            padding: "12px",
            border: "1px solid #eef2f5",
            borderRadius: 12,
            background: "#fbfdfe",
          }}
        >
          <span className="label">Client Message</span>
          <p style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
            {request.client_message ?? "No message provided."}
          </p>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <form action={updatePaymentRequestStatus}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="status" value="new" />
            <button type="submit" className="btn btn-outline">
              Mark New
            </button>
          </form>

          <form action={updatePaymentRequestStatus}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="status" value="sent" />
            <button type="submit" className="btn btn-outline">
              Mark Sent
            </button>
          </form>

          <form action={updatePaymentRequestStatus}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="status" value="completed" />
            <button type="submit" className="btn btn-primary">
              Mark Completed
            </button>
          </form>

          <form action={updatePaymentRequestStatus}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="status" value="cancelled" />
            <button type="submit" className="btn btn-outline">
              Mark Cancelled
            </button>
          </form>

          <form action={updatePaymentRequestStatus}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="status" value="declined" />
            <button type="submit" className="btn btn-outline">
              Mark Declined
            </button>
          </form>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Client Follow-Up</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Use this as a shortcut after you create the supplier payment link.
          The email opens in your mail app with a starter message you can customize.
        </p>

        <div className="row">
          {client?.email ? (
            <a
              href={`mailto:${client.email}?subject=${emailSubject}&body=${emailBody}`}
              className="btn btn-primary"
            >
              Email Client
            </a>
          ) : null}

          <a href="/admin/payment-requests" className="btn btn-outline">
            Back to Payment Requests
          </a>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Linked Trip</h2>

        <div className="grid grid-2">
          <InfoItem label="Trip Name" value={trip?.trip_name ?? "Unknown Trip"} />
          <InfoItem
            label="Trip Status"
            value={trip?.trip_status ?? "Not provided"}
          />
          <InfoItem label="Balance Due" value={formatMoney(trip?.balance_due)} />
          <InfoItem
            label="Final Payment Due Date"
            value={formatDate(trip?.final_payment_due_date)}
          />
        </div>

        <div className="row">
          {trip ? (
            <a href={`/admin/trips/${trip.id}`} className="btn btn-primary">
              Open Linked Trip
            </a>
          ) : null}

          <a href="/admin/payment-requests" className="btn btn-outline">
            Back to Payment Requests
          </a>
        </div>
      </div>
    </PageShell>
  );
}