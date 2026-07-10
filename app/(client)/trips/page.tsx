import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { tripMemberIdentityFilter } from "@/lib/travel-circle-access";

type ClientAccountRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripSummaryRow = {
  trip_id: string;
  client_account_id: string;
  trip_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  destinations: string | null;
  trip_status: string | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
};

type SharedTripRow = {
  id: string;
  trip_id: string;
  client_account_id: string | null;
  role: "owner" | "contributor" | "viewer" | string;
  invite_status: string;
  can_view_trip: boolean | null;
  created_at: string | null;
  trips:
    | {
        id: string;
        client_account_id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
        trip_status: string | null;
        balance_due: number | null;
        deposit_amount: number | null;
        deposit_due_date: string | null;
        deposit_paid: boolean | null;
        final_payment_due_date: string | null;
      }
    | Array<{
        id: string;
        client_account_id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
        trip_status: string | null;
        balance_due: number | null;
        deposit_amount: number | null;
        deposit_due_date: string | null;
        deposit_paid: boolean | null;
        final_payment_due_date: string | null;
      }>
    | null;
};

type DisplayTrip = {
  trip_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
  accessLabel: string;
  accessType: "primary" | "shared";
  role?: string | null;
};

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

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getClientDisplayName(client: ClientAccountRow) {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Traveler";
}

function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "owner":
      return "Owner";
    case "contributor":
      return "Contributor";
    case "viewer":
      return "Viewer";
    default:
      return role ?? "Viewer";
  }
}

function getSharedTrip(member: SharedTripRow) {
  if (Array.isArray(member.trips)) {
    return member.trips[0] ?? null;
  }

  return member.trips ?? null;
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);
  const today = new Date();

  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

function getPaymentStatus(trip: DisplayTrip) {
  const balanceDue = Number(trip.balance_due ?? 0);
  const depositPaid = trip.deposit_paid === true;

  if (balanceDue <= 0) {
    return {
      label: "Paid in Full",
      tone: "good" as const,
    };
  }

  if (!depositPaid && trip.deposit_due_date) {
    return {
      label: isPastDue(trip.deposit_due_date) ? "Deposit Past Due" : "Deposit Pending",
      tone: "warning" as const,
    };
  }

  if (trip.final_payment_due_date) {
    return {
      label: isPastDue(trip.final_payment_due_date) ? "Final Payment Past Due" : "Final Payment Due",
      tone: "warning" as const,
    };
  }

  return {
    label: "Balance Due",
    tone: "warning" as const,
  };
}

function PaymentStatusBadge({ trip }: { trip: DisplayTrip }) {
  const paymentStatus = getPaymentStatus(trip);

  return <StatusBadge label={paymentStatus.label} tone={paymentStatus.tone} />;
}

function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warning" | "neutral";
}) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: styles.background,
        color: styles.color,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function TripInfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "10px",
        borderRadius: 12,
        background: "#f7fbfc",
        border: "1px solid #e6f0f2",
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "4px 0 0", fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function TripCard({ trip }: { trip: DisplayTrip }) {
  const isShared = trip.accessType === "shared";

  return (
    <article
      className="card stack"
      style={{
        border: isShared ? "1px solid #fed7aa" : "1px solid #e6f0f2",
        background: isShared ? "#fff7ed" : "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <StatusBadge
            label={isShared ? `Shared Trip • ${trip.accessLabel}` : "My Trip"}
            tone={isShared ? "warning" : "good"}
          />

          <h2 style={{ margin: "10px 0 0" }}>{trip.trip_name ?? "Trip"}</h2>

          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            {trip.destinations ?? "Destination not provided"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusBadge label={trip.trip_status ?? "draft"} />
          <PaymentStatusBadge trip={trip} />
        </div>
      </div>

      <div className="grid grid-2">
        <TripInfoItem label="Departure" value={formatDate(trip.departure_date)} />
        <TripInfoItem label="Return" value={formatDate(trip.return_date)} />
        <TripInfoItem label="Final Payment" value={formatDate(trip.final_payment_due_date)} />
        <TripInfoItem label="Balance Due" value={formatMoney(trip.balance_due)} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/trips/${trip.trip_id}`} className="btn btn-primary">
          Open Trip
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
      clientAccount: clientAccountByEmail as ClientAccountRow,
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
    clientAccount: clientAccountByProfile as ClientAccountRow,
  };
}

export default async function TripsPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell
        title="My Trips"
        subtitle="We could not load your trips."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>{" "}
            {error instanceof Error ? error.message : "Client account not found."}
          </p>
        </div>
      </PageShell>
    );
  }

  const { supabase, clientAccount } = clientContext;

  const { data: ownedTrips, error: ownedTripsError } = await supabase
    .from("client_trip_summaries")
    .select(
      "trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date, deposit_amount, deposit_due_date, deposit_paid",
    )
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: true });

  if (ownedTripsError) {
    return (
      <PageShell
        title="My Trips"
        subtitle="We could not load your primary trips."
      >
        <div className="card">
          <p>
            <strong>Error loading trips:</strong>
          </p>
          <pre>{JSON.stringify(ownedTripsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const { data: sharedTripMembers, error: sharedTripsError } = await supabase
    .from("trip_members" as any)
    .select(
      "id, trip_id, client_account_id, role, invite_status, can_view_trip, created_at, trips(id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date, deposit_amount, deposit_due_date, deposit_paid)",
    )
    .or(tripMemberIdentityFilter(clientAccount.id, clientAccount.email))
    .eq("invite_status", "active")
    .eq("can_view_trip", true)
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  if (sharedTripsError) {
    return (
      <PageShell
        title="My Trips"
        subtitle="We could not load your shared trips."
      >
        <div className="card">
          <p>
            <strong>Error loading shared trips:</strong>
          </p>
          <pre>{JSON.stringify(sharedTripsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const ownedTripRows = (ownedTrips ?? []) as TripSummaryRow[];
  const ownedTripIds = new Set(ownedTripRows.map((trip) => trip.trip_id));

  const myTrips: DisplayTrip[] = ownedTripRows.map((trip) => ({
    trip_id: trip.trip_id,
    trip_name: trip.trip_name,
    destinations: trip.destinations,
    departure_date: trip.departure_date,
    return_date: trip.return_date,
    trip_status: trip.trip_status,
    balance_due: trip.balance_due,
    deposit_amount: trip.deposit_amount,
    deposit_due_date: trip.deposit_due_date,
    deposit_paid: trip.deposit_paid,
    final_payment_due_date: trip.final_payment_due_date,
    accessType: "primary",
    accessLabel: "Primary Client",
  }));

  const sharedTrips: DisplayTrip[] = ((sharedTripMembers ?? []) as SharedTripRow[]).flatMap(
    (member): DisplayTrip[] => {
      const trip = getSharedTrip(member);

      if (!trip || ownedTripIds.has(trip.id)) {
        return [];
      }

      return [
        {
          trip_id: trip.id,
          trip_name: trip.trip_name,
          destinations: trip.destinations,
          departure_date: trip.departure_date,
          return_date: trip.return_date,
          trip_status: trip.trip_status,
          balance_due: trip.balance_due,
          deposit_amount: trip.deposit_amount,
          deposit_due_date: trip.deposit_due_date,
          deposit_paid: trip.deposit_paid,
          final_payment_due_date: trip.final_payment_due_date,
          accessType: "shared",
          accessLabel: getRoleLabel(member.role),
          role: member.role,
        },
      ];
    },
  );

  const clientName = getClientDisplayName(clientAccount);

  const upcomingCount = [...myTrips, ...sharedTrips].filter((trip) => {
    if (!trip.departure_date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departure = new Date(`${trip.departure_date}T00:00:00`);

    return departure >= today;
  }).length;

  return (
    <PageShell
      title="My Trips"
      subtitle={`${clientName}, review your primary trips and shared Travel Circle trips.`}
    >
      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
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

        <h2 style={{ margin: 0 }}>Your Trip Library</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Review trips booked for you directly, plus any trips shared with you through Travel Circle.
        </p>

        <div className="grid grid-3">
          <TripInfoItem label="My Trips" value={String(myTrips.length)} />
          <TripInfoItem label="Shared With Me" value={String(sharedTrips.length)} />
          <TripInfoItem label="Upcoming Trips" value={String(upcomingCount)} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>

          <Link href="/invites" className="btn btn-primary">
            Review Shared Trips
          </Link>

          <Link href="/travel-request" className="btn btn-primary">
            Request Travel
          </Link>
        </div>
      </div>

      <section className="stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <StatusBadge label="Primary Travel" tone="good" />
            <h2 style={{ margin: "8px 0 0" }}>My Trips</h2>
          </div>
        </div>

        {myTrips.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              You do not have any primary trips showing yet. Once your advisor creates or confirms a trip, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-2">
            {myTrips.map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <StatusBadge
              label="Travel Circle"
              tone={sharedTrips.length > 0 ? "warning" : "neutral"}
            />
            <h2 style={{ margin: "8px 0 0" }}>Shared With Me</h2>
          </div>
        </div>

        {sharedTrips.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              No shared Travel Circle trips yet. Once someone adds you to a trip, it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-2">
            {sharedTrips.map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
