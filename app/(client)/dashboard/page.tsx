import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TripRow = {
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

type TripInviteRow = {
  id: string;
  trip_id: string;
  invite_email: string | null;
  invite_name: string | null;
  role: string | null;
  invite_status: string | null;
  created_at: string | null;
  trips:
    | {
        id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
      }
    | Array<{
        id: string;
        trip_name: string | null;
        destinations: string | null;
        departure_date: string | null;
        return_date: string | null;
      }>
    | null;
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
      {status ?? "draft"}
    </span>
  );
}

function getInviteTrip(invite: TripInviteRow) {
  if (Array.isArray(invite.trips)) {
    return invite.trips[0] ?? null;
  }

  return invite.trips ?? null;
}


function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="card">
      <span className="label">{label}</span>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
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
    return { supabase, user, clientAccount: clientAccountByEmail };
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

  const { data: clientAccountByProfile, error: clientProfileError } =
    await supabase
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

  return { supabase, user, clientAccount: clientAccountByProfile };
}

export default async function ClientDashboardPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell title="Dashboard" subtitle="We could not load your account.">
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

  const { data: trips, error } = await supabase
    .from("client_trip_summaries")
    .select(
      "trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date",
    )
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: true });

  const { data: messageThreads } = await supabase
    .from("message_threads" as any)
    .select("id, status, client_unread_count, last_message_at")
    .eq("client_account_id", clientAccount.id)
    .order("last_message_at", { ascending: false });

  const clientEmail = clientAccount.email?.trim().toLowerCase() ?? "";

  const { data: pendingInvites } = clientEmail
    ? await supabase
        .from("trip_members" as any)
        .select(
          "id, trip_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
        )
        .ilike("invite_email", clientEmail)
        .eq("invite_status", "invited")
        .order("created_at", { ascending: false })
    : { data: [] as TripInviteRow[] };

  const { data: sharedTripMemberships } = await supabase
    .from("trip_members" as any)
    .select(
      "id, trip_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
    )
    .eq("client_account_id", clientAccount.id)
    .eq("invite_status", "active")
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <PageShell title="Dashboard" subtitle="Your travel details, all in one place.">
        <div className="card">
          <p>
            <strong>Error loading dashboard:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const rows = (trips ?? []) as TripRow[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingTrips = rows.filter((trip) => {
    if (!trip.departure_date) return false;
    const departureDate = new Date(`${trip.departure_date}T00:00:00`);
    return departureDate >= today;
  });

  const nextTrip = upcomingTrips[0] ?? null;

  const totalBalanceDue = rows.reduce((total, trip) => {
    return total + (typeof trip.balance_due === "number" ? trip.balance_due : 0);
  }, 0);

  const nextPaymentTrip =
    rows
      .filter((trip) => trip.final_payment_due_date)
      .sort((a, b) =>
        String(a.final_payment_due_date).localeCompare(String(b.final_payment_due_date)),
      )[0] ?? null;

  const clientName =
    `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim() ||
    "Traveler";

  const unreadMessages = (messageThreads ?? []).reduce(
    (sum, thread: any) => sum + Number(thread.client_unread_count ?? 0),
    0,
  );

  const openMessageThreads = (messageThreads ?? []).filter(
    (thread: any) => thread.status === "open",
  ).length;

  const pendingInviteRows = (pendingInvites ?? []) as TripInviteRow[];
  const sharedTripRows = (sharedTripMemberships ?? []) as TripInviteRow[];
  const nextInviteTrip = pendingInviteRows[0]
    ? getInviteTrip(pendingInviteRows[0])
    : null;

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Welcome back, ${clientName}. Here’s your travel snapshot.`}
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

        <h2 style={{ margin: 0 }}>Travel Snapshot</h2>

        <div className="grid grid-4">
          <SummaryCard label="Upcoming Trips" value={upcomingTrips.length} />

          <SummaryCard
            label="Next Trip"
            value={nextTrip ? nextTrip.trip_name ?? "Upcoming Trip" : "No upcoming trips"}
          />

          <SummaryCard
            label="Pending Invites"
            value={pendingInviteRows.length}
            helper={
              pendingInviteRows.length > 0
                ? "Review shared trip access."
                : "No pending invitations."
            }
          />

          <SummaryCard
            label="Next Final Payment"
            value={
              nextPaymentTrip
                ? formatDate(nextPaymentTrip.final_payment_due_date)
                : "Not set"
            }
          />

          <SummaryCard label="Total Balance Due" value={formatMoney(totalBalanceDue)} />
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: pendingInviteRows.length > 0 ? "#fff7ed" : "#ffffff",
          border: pendingInviteRows.length > 0 ? "1px solid #fed7aa" : "1px solid #e6f0f2",
        }}
      >
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
            <h2 style={{ margin: 0 }}>Travel Invitations</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Accept shared trip access from family, friends, and fellow travelers.
            </p>
            {nextInviteTrip ? (
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                Next invite: <strong>{nextInviteTrip.trip_name ?? "Shared Trip"}</strong>
                {nextInviteTrip.destinations ? ` — ${nextInviteTrip.destinations}` : ""}
              </p>
            ) : sharedTripRows.length > 0 ? (
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                {sharedTripRows.length} shared trip{sharedTripRows.length === 1 ? "" : "s"} accepted.
              </p>
            ) : null}
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "6px 12px",
              background: pendingInviteRows.length > 0 ? "#fff" : "#ecfdf3",
              color: pendingInviteRows.length > 0 ? "#c2410c" : "#027a48",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {pendingInviteRows.length > 0
              ? `${pendingInviteRows.length} pending invite${pendingInviteRows.length === 1 ? "" : "s"}`
              : `${sharedTripRows.length} shared trip${sharedTripRows.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/invites" className="btn btn-primary">
            Review Invitations
          </Link>
          {nextInviteTrip ? (
            <Link href="/invites" className="btn btn-primary">
              Accept Shared Trip
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: unreadMessages > 0 ? "#fff7ed" : "#f7fbfc",
          border: unreadMessages > 0 ? "1px solid #fed7aa" : "1px solid #e6f0f2",
        }}
      >
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
            <h2 style={{ margin: 0 }}>Concierge Messages</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Send questions directly to your travel advisor and keep trip conversations in one place.
            </p>
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "6px 12px",
              background: unreadMessages > 0 ? "#fff" : "#ecfdf3",
              color: unreadMessages > 0 ? "#c2410c" : "#027a48",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {unreadMessages > 0
              ? `${unreadMessages} unread reply${unreadMessages === 1 ? "" : "ies"}`
              : `${openMessageThreads} open thread${openMessageThreads === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/messages" className="btn btn-primary">
            Open Messages
          </Link>
          <Link href="/messages#new-message" className="btn btn-primary">
            Ask a Question
          </Link>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Quick Actions</h2>

        <div className="row">
          <Link href="/trips" className="btn btn-primary">
            View My Trips
          </Link>

          <Link href="/travel-request" className="btn btn-primary">
            Request New Travel Quote
          </Link>

          <Link href="/messages" className="btn btn-primary">
            Message My Advisor
          </Link>

          <Link href="/invites" className="btn btn-primary">
            Travel Invitations
          </Link>

          {nextTrip ? (
            <Link href={`/trips/${nextTrip.trip_id}`} className="btn btn-primary">
              Open Next Trip
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upcoming Trips</h2>

        {upcomingTrips.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>No upcoming trips found yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Destination</th>
                  <th>Departure</th>
                  <th>Return</th>
                  <th>Status</th>
                  <th>Open</th>
                </tr>
              </thead>

              <tbody>
                {upcomingTrips.slice(0, 5).map((trip) => (
                  <tr key={trip.trip_id}>
                    <td>{trip.trip_name ?? "Trip"}</td>
                    <td>{trip.destinations ?? "Not provided"}</td>
                    <td>{formatDate(trip.departure_date)}</td>
                    <td>{formatDate(trip.return_date)}</td>
                    <td>
                      <StatusBadge status={trip.trip_status} />
                    </td>
                    <td>
                      <Link
                        href={`/trips/${trip.trip_id}`}
                        className="btn btn-primary"
                        style={{
                          padding: "6px 10px",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Open
                      </Link>
                    </td>
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
