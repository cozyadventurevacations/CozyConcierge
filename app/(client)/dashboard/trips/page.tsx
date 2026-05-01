import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

function TripCard({ trip }: { trip: DisplayTrip }) {
  const isShared = trip.accessType === "shared";

  return (
    <div
      className="card stack"
      style={{
        border: "1px solid #e6f0f2",
        background: isShared
          ? "linear-gradient(135deg, #fff7ed 0%, #ffffff 72%)"
          : "#ffffff",
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
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-dark)",
              fontWeight: 800,
            }}
          >
            {isShared ? "Shared Trip" : "My Trip"}
          </p>

          <h2 style={{ margin: "6px 0 0" }}>{trip.trip_name ?? "Trip"}</h2>

          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
            {trip.destinations ?? "Destination not provided"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusBadge label={trip.trip_status ?? "draft"} />
          <StatusBadge
            label={trip.accessLabel}
            tone={isShared ? "warning" : "neutral"}
          />
        </div>
      </div>

      <div className="grid grid-3">
        <div>
          <span className="label">Departure</span>
          <p style={{ margin: "6px 0 0", fontWeight: 800 }}>
            {formatDate(trip.departure_date)}
          </p>
        </div>

        <div>
          <span className="label">Return</span>
          <p style={{ margin: "6px 0 0", fontWeight: 800 }}>
            {formatDate(trip.return_date)}
          </p>
        </div>

        <div>
          <span className="label">Final Payment</span>
          <p style={{ margin: "6px 0 0", fontWeight: 800 }}>
            {formatDate(trip.final_payment_due_date)}
          </p>
        </div>
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: 12,
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <span className="label">Balance Due</span>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900 }}>
            {formatMoney(trip.balance_due)}
          </p>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href={`/trips/${trip.trip_id}`} className="btn btn-primary">
            Open Trip
          </Link>

          <Link
            href={`/messages?tripId=${trip.trip_id}&subject=${encodeURIComponent(
              `Question about ${trip.trip_name ?? "my trip"}`,
            )}`}
            className="btn btn-primary"
          >
            Message Advisor
          </Link>

          {isShared ? (
            <Link
              href={`/messages?tripId=${trip.trip_id}&scope=group&subject=${encodeURIComponent(
                `${trip.trip_name ?? "Trip"} — Travel Circle`,
              )}`}
              className="btn btn-primary"
            >
              Message Travel Circle
            </Link>
          ) : null}
        </div>
      </div>
    </div>
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
      <PageShell title="My Trips" subtitle="We could not load your account.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>{error instanceof Error ? error.message : "Client account not found."}</p>
        </div>
      </PageShell>
    );
  }

  const { supabase, clientAccount } = clientContext;

  const { data: ownedTrips, error: ownedTripsError } = await supabase
    .from("client_trip_summaries")
    .select(
      "trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date",
    )
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: true });

  if (ownedTripsError) {
    return (
      <PageShell title="My Trips" subtitle="Your travel details, all in one place.">
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
      "id, trip_id, client_account_id, role, invite_status, can_view_trip, created_at, trips(id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date)",
    )
    .eq("client_account_id", clientAccount.id)
    .eq("invite_status", "active")
    .eq("can_view_trip", true)
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  if (sharedTripsError) {
    return (
      <PageShell title="My Trips" subtitle="Your travel details, all in one place.">
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
    final_payment_due_date: trip.final_payment_due_date,
    accessType: "primary",
    accessLabel: "Primary Client",
  }));

  const sharedTrips: DisplayTrip[] = ((sharedTripMembers ?? []) as SharedTripRow[])
    .map((member) => {
      const trip = getSharedTrip(member);

      if (!trip || ownedTripIds.has(trip.id)) {
        return null;
      }

      return {
        trip_id: trip.id,
        trip_name: trip.trip_name,
        destinations: trip.destinations,
        departure_date: trip.departure_date,
        return_date: trip.return_date,
        trip_status: trip.trip_status,
        balance_due: trip.balance_due,
        final_payment_due_date: trip.final_payment_due_date,
        accessType: "shared" as const,
        accessLabel: getRoleLabel(member.role),
        role: member.role,
      };
    })
    .filter((trip): trip is DisplayTrip => Boolean(trip));

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
      subtitle={`Welcome back, ${clientName}. View your trips and shared Travel Circle access.`}
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

        <h2 style={{ margin: 0 }}>Your Trip Library</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Review trips booked for you directly, plus any trips shared with you
          through a Travel Circle invitation.
        </p>

        <div className="grid grid-3">
          <div className="card">
            <span className="label">My Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>
              {myTrips.length}
            </p>
          </div>

          <div className="card">
            <span className="label">Shared With Me</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>
              {sharedTrips.length}
            </p>
          </div>

          <div className="card">
            <span className="label">Upcoming Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>
              {upcomingCount}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>

          <Link href="/invites" className="btn btn-primary">
            Review Travel Invitations
          </Link>

          <Link href="/travel-request" className="btn btn-primary">
            Request Travel
          </Link>
        </div>
      </div>

      <div className="card stack">
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
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Primary Travel
            </p>
            <h2 style={{ margin: "4px 0 0" }}>My Trips</h2>
          </div>

          <StatusBadge label={`${myTrips.length} trip${myTrips.length === 1 ? "" : "s"}`} />
        </div>

        {myTrips.length === 0 ? (
          <div
            style={{
              padding: "14px",
              borderRadius: 14,
              border: "1px solid #e6f0f2",
              background: "#f7fbfc",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              You do not have any primary trips showing yet. Once your advisor
              creates or confirms a trip, it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {myTrips.map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
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
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Travel Circle
            </p>
            <h2 style={{ margin: "4px 0 0" }}>Shared With Me</h2>
          </div>

          <StatusBadge
            label={`${sharedTrips.length} shared trip${sharedTrips.length === 1 ? "" : "s"}`}
            tone={sharedTrips.length > 0 ? "warning" : "neutral"}
          />
        </div>

        {sharedTrips.length === 0 ? (
          <div
            style={{
              padding: "14px",
              borderRadius: 14,
              border: "1px solid #e6f0f2",
              background: "#f7fbfc",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              No shared Travel Circle trips yet. If someone invites you to a trip,
              you can accept the invitation from your Travel Invitations page.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {sharedTrips.map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
