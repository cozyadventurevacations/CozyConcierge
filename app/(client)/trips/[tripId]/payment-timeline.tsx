type PaymentTimelineProps = {
  totalPaid?: number | null;
  balanceDue?: number | null;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  depositPaid?: boolean | null;
  finalPaymentDueDate?: string | null;
  departureDate?: string | null;
  tripStatus?: string | null;
};

function formatMoney(value?: number | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPastDue(value?: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);
  const today = new Date();

  return date.getTime() < today.getTime();
}

function TimelineStep({
  number,
  title,
  subtitle,
  amount,
  status,
  tone = "default",
}: {
  number: number;
  title: string;
  subtitle: string;
  amount?: string;
  status: string;
  tone?: "default" | "success" | "warning";
}) {
  const colors =
    tone === "success"
      ? {
          background: "#eaf6ec",
          border: "#bfe5c7",
          icon: "#3d8c4e",
          text: "#2e7a3c",
        }
      : tone === "warning"
        ? {
            background: "#fff4e6",
            border: "#f4c98b",
            icon: "#6b3a08",
            text: "#6b3a08",
          }
        : {
            background: "#f7fbfc",
            border: "var(--border)",
            icon: "var(--accent-dark)",
            text: "var(--accent-dark)",
          };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: colors.icon,
            color: "white",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            flex: "0 0 auto",
          }}
        >
          {number}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 800,
              color: colors.text,
              fontSize: "1rem",
            }}
          >
            {title}
          </p>

          <p
            style={{
              margin: "5px 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </p>

          {amount ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: "1.35rem",
                fontWeight: 900,
                color: colors.text,
              }}
            >
              {amount}
            </p>
          ) : null}

          <span
            className="badge"
            style={{
              marginTop: 12,
              background: "white",
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PaymentTimeline({
  totalPaid,
  balanceDue,
  depositAmount,
  depositDueDate,
  depositPaid,
  finalPaymentDueDate,
  departureDate,
  tripStatus,
}: PaymentTimelineProps) {
  const depositIsPaid = depositPaid === true;
  const finalBalanceIsPaid = Number(balanceDue ?? 0) <= 0;
  const depositPastDue = !depositIsPaid && isPastDue(depositDueDate);
  const finalPastDue = !finalBalanceIsPaid && isPastDue(finalPaymentDueDate);

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Payment Timeline
          </p>

          <h2 style={{ margin: "6px 0 0", fontSize: "1.35rem" }}>
            Your trip payment path
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--muted)",
              maxWidth: 680,
              lineHeight: 1.55,
            }}
          >
            Track your deposit, final payment, and travel date in one simple
            view.
          </p>
        </div>

        <div>
          <span className="badge">{tripStatus ?? "Trip status pending"}</span>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Paid so far: <strong>{formatMoney(totalPaid)}</strong>
          </p>
        </div>
      </div>

      {/* payment-timeline-steps class enables mobile stacking via globals.css */}
      <div
        className="payment-timeline-steps row"
        style={{
          alignItems: "stretch",
          gap: 14,
        }}
      >
        <TimelineStep
          number={1}
          title="Deposit"
          subtitle={`Due ${formatDate(depositDueDate)}`}
          amount={formatMoney(depositAmount)}
          status={
            depositIsPaid
              ? "Deposit paid"
              : depositPastDue
                ? "Deposit past due"
                : "Deposit pending"
          }
          tone={
            depositIsPaid ? "success" : depositPastDue ? "warning" : "default"
          }
        />

        <TimelineStep
          number={2}
          title="Final Payment"
          subtitle={`Due ${formatDate(finalPaymentDueDate)}`}
          amount={formatMoney(balanceDue)}
          status={
            finalBalanceIsPaid
              ? "Balance paid"
              : finalPastDue
                ? "Final payment past due"
                : "Balance remaining"
          }
          tone={
            finalBalanceIsPaid ? "success" : finalPastDue ? "warning" : "default"
          }
        />

        <TimelineStep
          number={3}
          title="Travel Begins"
          subtitle={`Departure ${formatDate(departureDate)}`}
          status="Adventure awaits"
          tone="default"
        />
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 14,
          color: "var(--muted)",
          fontSize: "0.92rem",
          lineHeight: 1.55,
        }}
      >
        Payment links are issued securely by your advisor. If you are ready to
        make a payment, use the request payment button on this trip.
      </div>
    </section>
  );
}