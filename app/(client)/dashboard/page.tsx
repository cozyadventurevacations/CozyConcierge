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

type MessageThreadRow = {
  id: string;
  status: string | null;
  client_unread_count: number | null;
  last_message_at: string | null;
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

function getClientDisplayName(client: ClientAccountRow | null) {
  if (!client) return "Traveler";

  return (
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
    client.email ||
    "Traveler"
  );
}

function getInviteTrip(invite: TripInviteRow) {
  if (Array.isArray(invite.trips)) {
    return invite.trips[0] ?? null;
  }

  return invite.trips ?? null;
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
    <div
      className="card stack"
      style={{
        border: "1px solid #e6f0f2",
        background: "#ffffff",
      }}
    >
      <span className="label">{label}</span>
      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{value}</strong>
      {helper ? (
        <span style={{ color: "#64748b", lineHeight: 1.45 }}>{helper}</span>
      ) : null}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
  tone = "neutral",
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  tone?: "neutral" | "warning" | "good";
}) {
  const styles = {
    neutral: { background: "#ffffff", border: "1px solid #e6f0f2" },
    warning: { background: "#fff7ed", border: "1px solid #fed7aa" },
    good: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
  }[tone];

  return (
    <div
      className="card stack"
      style={{
        background: styles.background,
        border: styles.border,
      }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>

      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
        {description}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={href} className="btn btn-primary">
          {cta}
        </Link>
      </div>
    </div>
  );
}

function AskCozyDashboardCard() {
  return (
    <div
      className="card stack"
      style={{
        border: "1px solid #e6f0f2",
        background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
      }}
    >
      <div>
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
          Ask Cozy
        </p>

        <h2 style={{ margin: "4px 0 0" }}>Need a quick travel answer?</h2>

        <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.6 }}>
          Ask Cozy can help with general travel questions, packing reminders, trip
          prep, and what to ask your advisor next.
        </p>
      </div>

      <form action="/ask-cozy" method="get" className="stack">
        <label className="stack-sm">
          <span className="label">Ask a general travel question</span>
          <textarea
            className="textarea"
            name="question"
            rows={3}
            placeholder="Example: What should I double-check 30 days before travel?"
          />
        </label>

        <button type="submit" className="btn btn-primary">
          Ask Cozy
        </button>
      </form>

      <div
        style={{
          padding: "12px",
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Quick note:</strong> Ask Cozy cannot see private trip records,
        payments, passport uploads, or documents. Use Concierge Messages for
        booking-specific questions.
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

export default async function ClientDashboardPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell
        title="Client Dashboard"
        subtitle="We could not load your Cozy Concierge dashboard."
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

  const { data: trips, error } = await supabase
    .from("client_trip_summaries")
    .select(
      "trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date",
    )
    .eq("client_account_id", clientAccount.id)
    .order("departure_date", { ascending: true });

  const { data: messageThreads } = await supabase
    .from("message_threads")
    .select("id, status, client_unread_count, last_message_at")
    .eq("client_account_id", clientAccount.id)
    .order("last_message_at", { ascending: false });

  const clientEmail = clientAccount.email?.trim().toLowerCase() ?? "";

  const { data: pendingInvites } = clientEmail
    ? await supabase
        .from("trip_members")
        .select(
          "id, trip_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
        )
        .ilike("invite_email", clientEmail)
        .eq("invite_status", "invited")
        .order("created_at", { ascending: false })
    : { data: [] as TripInviteRow[] };

  const { data: sharedTripMemberships } = await supabase
    .from("trip_members")
    .select(
      "id, trip_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
    )
    .eq("client_account_id", clientAccount.id)
    .eq("invite_status", "active")
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <PageShell
        title="Client Dashboard"
        subtitle="We could not load your trip dashboard."
      >
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
        String(a.final_payment_due_date).localeCompare(
          String(b.final_payment_due_date),
        ),
      )[0] ?? null;

  const clientName = getClientDisplayName(clientAccount);

  const messageThreadRows = (messageThreads ?? []) as MessageThreadRow[];

  const unreadMessages = messageThreadRows.reduce(
    (sum, thread) => sum + Number(thread.client_unread_count ?? 0),
    0,
  );

  const openMessageThreads = messageThreadRows.filter(
    (thread) => thread.status === "open",
  ).length;

  const pendingInviteRows = (pendingInvites ?? []) as TripInviteRow[];
  const sharedTripRows = (sharedTripMemberships ?? []) as TripInviteRow[];
  const nextInviteTrip = pendingInviteRows[0]
    ? getInviteTrip(pendingInviteRows[0])
    : null;

  return (
    <PageShell
      title={`Welcome back, ${clientName}`}
      subtitle="Your Cozy Concierge dashboard for trips, messages, invitations, payments, and travel details."
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

        <h2 style={{ margin: 0 }}>Travel Snapshot</h2>

        <div className="grid grid-3">
          <SummaryCard
            label="Upcoming Trips"
            value={upcomingTrips.length}
            helper={
              nextTrip
                ? `Next trip: ${nextTrip.trip_name ?? nextTrip.destinations ?? "Trip"}`
                : "No upcoming trips yet."
            }
          />

          <SummaryCard
            label="Balance Due"
            value={formatMoney(totalBalanceDue)}
            helper={
              nextPaymentTrip
                ? `Next final payment: ${formatDate(nextPaymentTrip.final_payment_due_date)}`
                : "No final payment due date on file."
            }
          />

          <SummaryCard
            label="Travel Invitations"
            value={pendingInviteRows.length}
            helper={
              pendingInviteRows.length > 0
                ? "Review shared trip access."
                : sharedTripRows.length > 0
                  ? `${sharedTripRows.length} shared trip${
                      sharedTripRows.length === 1 ? "" : "s"
                    } accepted.`
                  : "No pending invitations."
            }
          />
        </div>
      </div>

      <AskCozyDashboardCard />

      <div className="grid grid-2">
        <ActionCard
          title="Travel Invitations"
          description={
            nextInviteTrip
              ? `You have a pending invite for ${
                  nextInviteTrip.trip_name ?? "a shared trip"
                }${
                  nextInviteTrip.destinations
                    ? ` — ${nextInviteTrip.destinations}`
                    : ""
                }.`
              : sharedTripRows.length > 0
                ? `${sharedTripRows.length} shared trip${
                    sharedTripRows.length === 1 ? "" : "s"
                  } accepted.`
                : "Accept shared trip access from family, friends, and fellow travelers."
          }
          href="/invites"
          cta={
            pendingInviteRows.length > 0
              ? `Review ${pendingInviteRows.length} Invitation${
                  pendingInviteRows.length === 1 ? "" : "s"
                }`
              : "Open Invitations"
          }
          tone={pendingInviteRows.length > 0 ? "warning" : "good"}
        />

        <ActionCard
          title="Concierge Messages"
          description={
            unreadMessages > 0
              ? `You have ${unreadMessages} unread advisor ${
                  unreadMessages === 1 ? "reply" : "replies"
                }.`
              : `You have ${openMessageThreads} open message ${
                  openMessageThreads === 1 ? "thread" : "threads"
                }.`
          }
          href="/messages"
          cta={unreadMessages > 0 ? "Read Messages" : "Open Messages"}
          tone={unreadMessages > 0 ? "warning" : "good"}
        />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Quick Actions</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/trips" className="btn btn-primary">
            View My Trips
          </Link>

          <Link href="/travel-request" className="btn btn-primary">
            Request New Travel Quote
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

        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          Need to reach your advisor? Use the Concierge Messages card above so the conversation stays connected to your client account.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Upcoming Trips</h2>

        {upcomingTrips.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No upcoming trips found yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
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
                      <Link href={`/trips/${trip.trip_id}`}>Open</Link>
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