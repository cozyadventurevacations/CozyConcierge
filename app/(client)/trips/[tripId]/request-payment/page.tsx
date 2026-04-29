import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TripRow = {
  id: string;
  client_account_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  final_payment_due_date: string | null;
};

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PaymentRequestRow = {
  id: string;
  requested_amount: number | null;
  status: string | null;
  created_at: string | null;
};

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = "Not set") {
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

function formatDateTime(value: string | null | undefined, fallback = "Not set") {
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

function toMoneyNumber(value: FormDataEntryValue | null, fallback = 0) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return fallback;

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid payment amount submitted.");
  }

  return numberValue;
}

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = user.email?.trim().toLowerCase();

  if (!userEmail) {
    throw new Error("Your login account does not have an email address.");
  }

  const { data: clientAccountByEmail, error: clientEmailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .ilike("email", userEmail)
    .maybeSingle();

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientAccountByEmail) {
    return {
      supabase,
      user,
      clientAccount: clientAccountByEmail as ClientAccount,
    };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) {
    throw new Error(clientProfileError.message);
  }

  if (!clientAccountByProfile) {
    throw new Error("Client account not found.");
  }

  return {
    supabase,
    user,
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

async function createPaymentRequest(tripId: string, formData: FormData) {
  "use server";

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const requestedAmount = toMoneyNumber(formData.get("requested_amount"));

  if (requestedAmount <= 0) {
    throw new Error("Please enter a payment amount greater than $0.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, balance_due")
    .eq("id", tripId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Trip not found or access denied.");
  }

  const { error } = await supabase.from("payment_requests").insert({
    trip_id: tripId,
    client_account_id: clientAccount.id,
    requested_amount: requestedAmount,
    status: "new",
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/trips/${tripId}/request-payment?submitted=true`);
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "new";

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

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
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
      <p style={{ margin: "6px 0 0", lineHeight: 1.45, fontWeight: 700 }}>
        {value}
      </p>
      {helper ? (
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export default async function RequestPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { tripId } = await params;
  const { submitted } = await searchParams;

  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date",
    )
    .eq("id", tripId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell
        title="Request Payment Link"
        subtitle="We could not load this trip."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>Trip not found or access denied.</p>
        </div>
      </PageShell>
    );
  }

  const { data: recentPaymentRequests, error: paymentRequestsError } =
    await supabase
      .from("payment_requests")
      .select("id, requested_amount, status, created_at")
      .eq("trip_id", tripId)
      .eq("client_account_id", clientAccount.id)
      .order("created_at", { ascending: false })
      .limit(5);

  const tripRow = trip as TripRow;
  const paymentRequestRows =
    (recentPaymentRequests ?? []) as PaymentRequestRow[];

  const savePaymentRequest = createPaymentRequest.bind(null, tripId);
  const clientName =
    `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim() ||
    "Client";

  const submittedSuccessfully = submitted === "true";

  return (
    <PageShell
      title="Request Payment Link"
      subtitle="Ask Cozy Adventure Vacations to send a secure payment link for this trip."
    >
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          border: "1px solid #e6f0f2",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Cozy Concierge
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          {tripRow.trip_name ?? "Your Trip"}
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Hi {clientName}, use this page to request a secure payment link for
          your trip. Cozy Adventure Vacations will review the request and send the
          appropriate payment link.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusBadge status={tripRow.trip_status} />
          <span style={{ color: "#667085", lineHeight: 1.5 }}>
            {formatDate(tripRow.departure_date)} → {formatDate(tripRow.return_date)}
          </span>
        </div>
      </div>

      {submittedSuccessfully ? (
        <div
          className="card stack"
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
          }}
        >
          <h2 style={{ margin: 0 }}>Payment request received</h2>
          <p style={{ margin: 0, color: "#166534", lineHeight: 1.6 }}>
            Your payment link request has been submitted. Cozy Adventure Vacations
            will review it and send the proper secure payment link.
          </p>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href={`/trips/${tripId}`} className="btn btn-primary">
              Back to Trip
            </Link>

            <Link href="/trips" className="btn btn-outline">
              Back to My Trips
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-3">
        <InfoCard
          label="Destination"
          value={tripRow.destinations ?? "Not set"}
          helper="Where the memories are headed."
        />

        <InfoCard
          label="Balance Due"
          value={formatMoney(tripRow.balance_due)}
          helper="Current balance shown in your trip record."
        />

        <InfoCard
          label="Final Payment Due"
          value={formatDate(tripRow.final_payment_due_date)}
          helper="Please review this date carefully."
        />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Request a Payment Link</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Enter the amount you would like a payment link for. If you are unsure,
          request the current balance due.
        </p>

        <form action={savePaymentRequest} className="stack">
          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Requested Amount</span>
              <input
                name="requested_amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                defaultValue={tripRow.balance_due ?? 0}
                required
              />
            </label>

            <div
              style={{
                padding: "12px",
                border: "1px solid #eef2f5",
                borderRadius: 12,
                background: "#fbfdfe",
              }}
            >
              <span className="label">Helpful Reminder</span>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                Payment links are reviewed before sending so the amount and supplier
                payment process can be confirmed.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            Cozy Adventure Vacations uses secure payment processes and supplier
            payment links whenever appropriate. Please do not send full credit card
            details through this form.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Submit Payment Link Request
            </button>

            <Link href={`/trips/${tripId}`} className="btn btn-outline">
              Back to Trip
            </Link>

            <Link href="/trips" className="btn btn-outline">
              Back to My Trips
            </Link>
          </div>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Recent Payment Link Requests</h2>

        {paymentRequestsError ? (
          <div>
            <p>
              <strong>Error loading payment requests:</strong>
            </p>
            <pre>{JSON.stringify(paymentRequestsError, null, 2)}</pre>
          </div>
        ) : paymentRequestRows.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No payment link requests have been submitted for this trip yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Requested Amount</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>

              <tbody>
                {paymentRequestRows.map((request) => (
                  <tr key={request.id}>
                    <td>{formatMoney(request.requested_amount)}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>{formatDateTime(request.created_at)}</td>
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