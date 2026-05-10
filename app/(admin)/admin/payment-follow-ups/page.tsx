import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return value;
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);
  const today = new Date();

  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

type PaymentTone = "good" | "warning" | "danger" | "neutral";

type TripRow = {
  id: string;
  trip_name: string;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  total_paid: number | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
  client_account_id: string;
  client_accounts:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

function getClientName(trip: TripRow) {
  const client = trip.client_accounts?.[0];

  if (!client) return "Unknown Client";

  return (
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
    client.email ||
    "Unknown Client"
  );
}

function getPaymentStatus(trip: TripRow): {
  label: string;
  tone: PaymentTone;
  sortPriority: number;
} {
  const balanceDue = Number(trip.balance_due ?? 0);
  const depositPaid = trip.deposit_paid === true;

  if (balanceDue <= 0) {
    return {
      label: "Paid in Full",
      tone: "good",
      sortPriority: 99,
    };
  }

  if (!depositPaid && trip.deposit_due_date) {
    const pastDue = isPastDue(trip.deposit_due_date);

    return {
      label: pastDue ? "Deposit Past Due" : "Deposit Pending",
      tone: pastDue ? "danger" : "warning",
      sortPriority: pastDue ? 1 : 3,
    };
  }

  if (trip.final_payment_due_date) {
    const pastDue = isPastDue(trip.final_payment_due_date);

    return {
      label: pastDue ? "Final Payment Past Due" : "Final Payment Due",
      tone: pastDue ? "danger" : "warning",
      sortPriority: pastDue ? 2 : 4,
    };
  }

  return {
    label: "Balance Due",
    tone: "warning",
    sortPriority: 5,
  };
}

function PaymentBadge({ trip }: { trip: TripRow }) {
  const status = getPaymentStatus(trip);

  const colors: Record<PaymentTone, { background: string; color: string }> = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    danger: { background: "#fff1f2", color: "#be123c" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  };

  const style = colors[status.tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
        background: style.background,
        color: style.color,
      }}
    >
      {status.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const colors = {
    neutral: {
      background: "#ffffff",
      border: "#e6f0f2",
      color: "var(--accent-dark)",
    },
    warning: {
      background: "#fff7ed",
      border: "#fed7aa",
      color: "#c2410c",
    },
    danger: {
      background: "#fff1f2",
      border: "#fecdd3",
      color: "#be123c",
    },
  }[tone];

  return (
    <div
      className="card stack"
      style={{
        gap: 8,
        background: colors.background,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#5e7e8f",
          fontWeight: 800,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: "1.7rem",
          lineHeight: 1,
          color: colors.color,
        }}
      >
        {value}
      </strong>

      {helper ? (
        <span style={{ fontSize: 12, color: "#5e7e8f", lineHeight: 1.4 }}>
          {helper}
        </span>
      ) : null}
    </div>
  );
}

export default async function AdminPaymentFollowUpsPage() {
  const { supabase } = await requireAdmin();

  const { data: trips, error } = await supabase
    .from("trips")
    .select(`
      id,
      trip_name,
      departure_date,
      return_date,
      trip_status,
      total_paid,
      balance_due,
      deposit_amount,
      deposit_due_date,
      deposit_paid,
      final_payment_due_date,
      client_account_id,
      client_accounts!trips_client_account_id_fkey (
        first_name,
        last_name,
        email
      )
    `)
    .order("departure_date", { ascending: true });

  if (error) {
    return (
      <PageShell
        title="Payment Follow-Ups"
        subtitle="Trips needing deposit or final payment attention."
      >
        <div className="card">
          <p>
            <strong>Error loading payment follow-ups:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripRows = (trips ?? []) as TripRow[];

  const followUps = tripRows
    .filter((trip) => Number(trip.balance_due ?? 0) > 0)
    .sort((a, b) => {
      const aStatus = getPaymentStatus(a);
      const bStatus = getPaymentStatus(b);

      if (aStatus.sortPriority !== bStatus.sortPriority) {
        return aStatus.sortPriority - bStatus.sortPriority;
      }

      const aDate =
        a.deposit_paid !== true && a.deposit_due_date
          ? a.deposit_due_date
          : a.final_payment_due_date ?? a.departure_date ?? "9999-12-31";

      const bDate =
        b.deposit_paid !== true && b.deposit_due_date
          ? b.deposit_due_date
          : b.final_payment_due_date ?? b.departure_date ?? "9999-12-31";

      return aDate.localeCompare(bDate);
    });

  const depositPastDueCount = followUps.filter(
    (trip) => trip.deposit_paid !== true && isPastDue(trip.deposit_due_date),
  ).length;

  const finalPastDueCount = followUps.filter(
    (trip) =>
      Number(trip.balance_due ?? 0) > 0 &&
      trip.deposit_paid === true &&
      isPastDue(trip.final_payment_due_date),
  ).length;

  const totalBalanceDue = followUps.reduce(
    (sum, trip) => sum + Number(trip.balance_due ?? 0),
    0,
  );

  return (
    <PageShell
      title="Payment Follow-Ups"
      subtitle="Trips that may need deposit or final payment attention."
    >
      <div className="row">
        <Link href="/admin/trips" className="btn btn-primary">
          Back to Trips
        </Link>
      </div>

      <div className="grid grid-3">
        <SummaryCard
          label="Trips Needing Attention"
          value={followUps.length}
          helper="Trips with an outstanding balance."
          tone={followUps.length > 0 ? "warning" : "neutral"}
        />

        <SummaryCard
          label="Past Due Items"
          value={depositPastDueCount + finalPastDueCount}
          helper={`${depositPastDueCount} deposit · ${finalPastDueCount} final payment`}
          tone={depositPastDueCount + finalPastDueCount > 0 ? "danger" : "neutral"}
        />

        <SummaryCard
          label="Outstanding Balance"
          value={formatMoney(totalBalanceDue)}
          helper="Total remaining balance across visible trips."
          tone={totalBalanceDue > 0 ? "warning" : "neutral"}
        />
      </div>

      {followUps.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            No payment follow-ups needed right now. Everything with a visible
            payment balance is caught up.
          </p>
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Payment Status</th>
                <th>Client</th>
                <th>Trip</th>
                <th>Deposit</th>
                <th>Final Payment</th>
                <th>Balance Due</th>
                <th>Departure</th>
                <th>Open</th>
              </tr>
            </thead>

            <tbody>
              {followUps.map((trip) => {
                return (
                  <tr key={trip.id}>
                    <td>
                      <PaymentBadge trip={trip} />
                    </td>

                    <td>{getClientName(trip)}</td>

                    <td>
                      <strong>{trip.trip_name}</strong>
                    </td>

                    <td>
                      <div style={{ display: "grid", gap: 3 }}>
                        <strong>{formatMoney(trip.deposit_amount)}</strong>
                        <span style={{ color: "#64748b", fontSize: 12 }}>
                          Due {formatDate(trip.deposit_due_date)}
                        </span>
                        <span
                          style={{
                            color: trip.deposit_paid ? "#027a48" : "#c2410c",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {trip.deposit_paid ? "Paid" : "Not marked paid"}
                        </span>
                      </div>
                    </td>

                    <td>{formatDate(trip.final_payment_due_date)}</td>

                    <td>
                      <strong>{formatMoney(trip.balance_due)}</strong>
                    </td>

                    <td>{formatDate(trip.departure_date)}</td>

                    <td>
                      <Link
                        href={`/admin/trips/${trip.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "5px 12px" }}
                      >
                        Open Trip
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}