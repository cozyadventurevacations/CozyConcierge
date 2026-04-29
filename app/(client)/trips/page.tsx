import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TripRow = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  final_payment_due_date: string | null;
  created_at: string | null;
};

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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

function getDateValue(value: string | null | undefined) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysUntil(value: string | null | undefined) {
  const date = getDateValue(value);
  if (!date) return null;

  const today = getTodayStart();
  date.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "draft";

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

function TripCard({ trip }: { trip: TripRow }) {
  const daysUntilDeparture = getDaysUntil(trip.departure_date);
  const daysUntilFinalPayment = getDaysUntil(trip.final_payment_due_date);
  const hasBalanceDue = Number(trip.balance_due ?? 0) > 0;

  const departureMessage =
    daysUntilDeparture === null
      ? "Travel dates are being finalized."
      : daysUntilDeparture > 1
        ? `${daysUntilDeparture} days until departure`
        : daysUntilDeparture === 1
          ? "Departure is tomorrow"
          : daysUntilDeparture === 0
            ? "Departure is today"
            : "Trip has already started or passed";

  const paymentMessage =
    daysUntilFinalPayment === null
      ? "Final payment date not set."
      : daysUntilFinalPayment > 1
        ? `Final payment due in ${daysUntilFinalPayment} days`
        : daysUntilFinalPayment === 1
          ? "Final payment due tomorrow"
          : daysUntilFinalPayment === 0
            ? "Final payment due today"
            : "Final payment date has passed";

  const shouldHighlightPayment =
    hasBalanceDue &&
    daysUntilFinalPayment !== null &&
    daysUntilFinalPayment <= 14;

  return (
    <article
      className="card stack"
      style={{
        border: "1px solid #e6f0f2",
        background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 100%)",
      }}
    >
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-dark)",
              fontWeight: 800,
            }}
          >
            Cozy Concierge Trip
          </p>

          <h2 style={{ margin: 0 }}>
            {trip.trip_name ?? trip.destinations ?? "Your Trip"}
          </h2>

          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
            {trip.destinations ?? "Your destination details are coming soon."}
          </p>
        </div>

        <StatusBadge status={trip.trip_status} />
      </div>

      <div className="grid grid-2">
        <div
          style={{
            padding: "12px",
            border: "1px solid #eef2f5",
            borderRadius: 12,
            background: "#ffffff",
          }}
        >
          <span className="label">Travel Dates</span>
          <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
            {formatDate(trip.departure_date)} → {formatDate(trip.return_date)}
          </p>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
            {departureMessage}
          </p>
        </div>

        <div
          style={{
            padding: "12px",
            border: shouldHighlightPayment
              ? "1px solid #fed7aa"
              : "1px solid #eef2f5",
            borderRadius: 12,
            background: shouldHighlightPayment ? "#fff7ed" : "#ffffff",
          }}
        >
          <span className="label">Payment Snapshot</span>
          <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
            Balance Due: <strong>{formatMoney(trip.balance_due)}</strong>
          </p>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
            {paymentMessage}
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
        Review your trip details, travel documents, payment reminders, and advisor
        notes before you travel. A few minutes here can prevent the classic
        “wait…where did I put that confirmation number?” airport moment.
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Link
          href={`/trips/${trip.id}`}
          className="btn btn-primary"
          style={{
            flex: "1 1 180px",
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          Open Trip
        </Link>

        <Link
          href={`/trips/${trip.id}/documents`}
          className="btn btn-primary"
          style={{
            flex: "1 1 180px",
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          View Documents
        </Link>

        <Link
          href={`/trips/${trip.id}/request-payment`}
          className="btn btn-primary"
          style={{
            flex: "1 1 180px",
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          Request Payment Link
        </Link>
      </div>
    </article>
  );
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

export default async function ClientTripsPage() {
  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: trips, error } = await supabase
    .from("trips")
    .select(
      "id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date, created_at",
    )
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: true });

  if (error) {
    return (
      <PageShell title="My Trips" subtitle="We could not load your trips.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripRows = (trips ?? []) as TripRow[];

  const today = getTodayStart();

  const upcomingTrips = tripRows.filter((trip) => {
    const returnDate = getDateValue(trip.return_date);
    const departureDate = getDateValue(trip.departure_date);

    if (returnDate) {
      return returnDate >= today;
    }

    if (departureDate) {
      return departureDate >= today;
    }

    return true;
  });

  const pastTrips = tripRows.filter((trip) => {
    const returnDate = getDateValue(trip.return_date);
    const departureDate = getDateValue(trip.departure_date);

    if (returnDate) {
      return returnDate < today;
    }

    if (departureDate) {
      return departureDate < today;
    }

    return false;
  });

  const clientFirstName = clientAccount.first_name ?? "there";

  return (
    <PageShell title="My Trips" subtitle="Your Cozy Concierge travel dashboard.">
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

        <h1 style={{ margin: "4px 0 0", fontSize: 32 }}>
          Welcome back, {clientFirstName}.
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          This is your home base for upcoming adventures, travel details,
          payment reminders, and important documents. Cozy, organized, and
          significantly better than digging through 47 emails while standing in
          an airport line.
        </p>

        <div className="grid grid-3">
          <div className="card">
            <span className="label">Upcoming Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {upcomingTrips.length}
            </p>
          </div>

          <div className="card">
            <span className="label">Past Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {pastTrips.length}
            </p>
          </div>

          <div className="card">
            <span className="label">Total Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
              {tripRows.length}
            </p>
          </div>
        </div>
      </div>

      {tripRows.length === 0 ? (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>No trips yet</h2>
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Your trip details will appear here once Cozy Adventure Vacations adds
            them to your client portal. Until then, the adventure is still
            simmering behind the scenes.
          </p>

          <a
            href="https://www.cozyadventurevacations.com/contact"
            className="btn btn-primary"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              width: "fit-content",
            }}
          >
            Start Planning a Trip
          </a>
        </div>
      ) : null}

      {upcomingTrips.length > 0 ? (
        <div className="card stack">
          <div>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Up Next
            </p>
            <h2 style={{ margin: 0 }}>Upcoming Trips</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
              Open each trip to review itinerary details, documents, advisor
              notes, payment reminders, and travel essentials.
            </p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {upcomingTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      ) : null}

      {pastTrips.length > 0 ? (
        <div className="card stack">
          <div>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Travel History
            </p>
            <h2 style={{ margin: 0 }}>Past Trips</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
              Completed trips remain here so you can reference past details and
              remember where the good stories came from.
            </p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {pastTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Before You Travel</h2>

        <div className="grid grid-2">
          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Documents</span>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Review names, dates, passports, confirmations, insurance details,
              and any destination requirements before departure.
            </p>
          </div>

          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Questions</span>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              If anything looks off, reach out before travel. Fixing details early
              is much better than discovering a surprise at the check-in counter.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}