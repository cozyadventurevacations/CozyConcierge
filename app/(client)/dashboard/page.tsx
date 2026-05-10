import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientAccountRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
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
};

type MessageThreadRow = {
  id: string;
  status: string | null;
  client_unread_count: number | null;
  last_message_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateLong(value: string | null | undefined) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getPreferredName(client: ClientAccountRow) {
  return (
    client.preferred_name?.trim() ||
    client.first_name?.trim() ||
    client.email ||
    "Traveler"
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "warning";
}) {
  const isWarning = tone === "warning";
  return (
    <div
      className="card stack"
      style={{
        gap: 8,
        border: isWarning ? "1px solid #fed7aa" : "1px solid #e6f0f2",
        background: isWarning ? "#fffbf7" : "#ffffff",
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#5e7e8f",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontSize: "1.7rem",
          lineHeight: 1,
          color: isWarning ? "#6b3a08" : "var(--accent-dark)",
        }}
      >
        {value}
      </strong>
      {helper && (
        <span style={{ fontSize: 12, color: "#5e7e8f", lineHeight: 1.4 }}>
          {helper}
        </span>
      )}
    </div>
  );
}

function AdvisorCard({ unreadCount }: { unreadCount: number }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        gap: 18,
        alignItems: "center",
        flexWrap: "wrap",
        background: "linear-gradient(135deg, #f0f7f8 0%, #ffffff 60%)",
        border: "1px solid #e6f0f2",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--accent-dark)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 18,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        JB
      </div>

      <div style={{ flex: 1, minWidth: 160 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Your Advisor
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800 }}>
          Jeremy Brown
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5e7e8f" }}>
          Cozy Adventure Vacations &middot;{" "}
          <em>Memories Await!</em>
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <Link
          href="/messages"
          className="btn btn-outline"
          style={{ padding: "8px 14px", fontSize: 13 }}
        >
          {unreadCount > 0 ? `✉ ${unreadCount} Unread` : "✉ Messages"}
        </Link>
        <Link
          href="/travel-request"
          className="btn btn-primary"
          style={{ padding: "8px 14px", fontSize: 13 }}
        >
          Request a Quote
        </Link>
      </div>
    </div>
  );
}

function TripStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "draft";
  const colors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: "#eaf3de", color: "#3b6d11" },
    active: { bg: "#eaf3de", color: "#3b6d11" },
    completed: { bg: "#f0f7f8", color: "var(--accent-dark)" },
    cancelled: { bg: "#fef2f2", color: "#991b1b" },
    draft: { bg: "#f0f7f8", color: "var(--accent-dark)" },
  };
  const style = colors[s] ?? colors.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        background: style.bg,
        color: style.color,
        fontWeight: 700,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {s}
    </span>
  );
}

function TripCard({ trip }: { trip: TripRow }) {
  const departure = formatDateShort(trip.departure_date);
  const returnDate = formatDateShort(trip.return_date);
  const hasBalance =
    typeof trip.balance_due === "number" && trip.balance_due > 0;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "14px 0",
        borderBottom: "1px solid #f0f5f8",
      }}
    >
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>
          {trip.trip_name ?? "Trip"}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#5e7e8f" }}>
          {trip.destinations ?? "Destination TBD"}
          {departure ? ` · ${departure}` : ""}
          {returnDate ? ` → ${returnDate}` : ""}
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <TripStatusBadge status={trip.trip_status} />
        {hasBalance && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#6b3a08",
              whiteSpace: "nowrap",
            }}
          >
            {formatMoney(trip.balance_due)} due
          </span>
        )}
        <Link
          href={`/trips/${trip.trip_id}`}
          className="btn btn-primary"
          style={{ padding: "7px 14px", fontSize: 13 }}
        >
          View Trip
        </Link>
      </div>
    </div>
  );
}

function AskCozyCompact() {
  return (
    <div className="card stack" style={{ gap: 10, border: "1px solid #e6f0f2" }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Ask Cozy
        </p>
        <p style={{ margin: "3px 0 0", fontWeight: 700, fontSize: 15 }}>
          Got a travel question?
        </p>
      </div>

      <form action="/ask-cozy" method="get" style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          name="question"
          placeholder="e.g. What should I pack for May in Florida?"
          style={{ flex: 1, padding: "9px 13px", fontSize: 13 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: "9px 16px", fontSize: 13, whiteSpace: "nowrap" }}
        >
          Ask
        </button>
      </form>

      <p style={{ margin: 0, fontSize: 11, color: "#5e7e8f", lineHeight: 1.5 }}>
        For booking-specific questions, use Concierge Messages so your advisor
        can see the full context.
      </p>
    </div>
  );
}

function QuickActions({ nextTripId }: { nextTripId: string | null }) {
  const actions = [
    { label: "My Trips", href: "/trips" },
    { label: "Messages", href: "/messages" },
    { label: "Invitations", href: "/invites" },
    { label: "My Profile", href: "/profile" },
    ...(nextTripId
      ? [{ label: "Open Next Trip", href: `/trips/${nextTripId}` }]
      : []),
  ];

  return (
    <div className="card stack" style={{ gap: 10, border: "1px solid #e6f0f2" }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--accent-dark)",
          fontWeight: 800,
        }}
      >
        Quick Actions
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#f0f7f8",
              color: "var(--accent-dark)",
              border: "1px solid #e6f0f2",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) throw new Error("Your login account does not have an email address.");

  const { data: byEmail, error: emailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email")
    .ilike("email", userEmail)
    .maybeSingle();

  if (emailError) throw new Error(emailError.message);
  if (byEmail) return { supabase, user, clientAccount: byEmail as ClientAccountRow };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User profile not found.");

  const { data: byProfile, error: profileAccountError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email")
    .eq("user_profile_id", profile.id)
    .maybeSingle();

  if (profileAccountError) throw new Error(profileAccountError.message);
  if (!byProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: byProfile as ClientAccountRow };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDashboardPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell title="Dashboard" subtitle="We could not load your dashboard.">
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

  const [tripsResult, threadsResult, invitesResult] = await Promise.all([
    supabase
      .from("client_trip_summaries")
      .select(
        "trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date",
      )
      .eq("client_account_id", clientAccount.id)
      .order("departure_date", { ascending: true }),

    supabase
      .from("message_threads")
      .select("id, status, client_unread_count, last_message_at")
      .eq("client_account_id", clientAccount.id)
      .order("last_message_at", { ascending: false }),

    clientAccount.email
      ? supabase
          .from("trip_members")
          .select("id, trip_id, invite_email, invite_name, role, invite_status, created_at")
          .ilike("invite_email", clientAccount.email)
          .eq("invite_status", "invited")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as TripInviteRow[] }),
  ]);

  const rows = (tripsResult.data ?? []) as TripRow[];
  const messageThreads = (threadsResult.data ?? []) as MessageThreadRow[];
  const pendingInvites = (invitesResult.data ?? []) as TripInviteRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingTrips = rows.filter((t) => {
    if (!t.departure_date) return false;
    return new Date(`${t.departure_date}T00:00:00`) >= today;
  });

  const nextTrip = upcomingTrips[0] ?? null;

  const totalBalance = rows.reduce(
    (sum, t) => sum + (typeof t.balance_due === "number" ? t.balance_due : 0),
    0,
  );

  const nextPaymentTrip =
    rows
      .filter((t) => t.final_payment_due_date && (t.balance_due ?? 0) > 0)
      .sort((a, b) =>
        String(a.final_payment_due_date).localeCompare(String(b.final_payment_due_date)),
      )[0] ?? null;

  const unreadMessages = messageThreads.reduce(
    (sum, t) => sum + Number(t.client_unread_count ?? 0),
    0,
  );

  const openThreads = messageThreads.filter((t) => t.status === "open").length;

  const preferredName = getPreferredName(clientAccount);

  return (
    <PageShell
      title={`Welcome back, ${preferredName}`}
      subtitle={getTodayLabel()}
    >
      {/* Metrics row */}
      <div className="grid grid-3">
        <MetricCard
          label="Upcoming Trips"
          value={upcomingTrips.length}
          helper={
            nextTrip
              ? `Next: ${nextTrip.trip_name ?? "Trip"} · ${formatDateShort(nextTrip.departure_date) ?? ""}`
              : "No upcoming trips yet."
          }
        />
        <MetricCard
          label="Balance Due"
          value={formatMoney(totalBalance)}
          helper={
            nextPaymentTrip
              ? `Final payment due ${formatDateLong(nextPaymentTrip.final_payment_due_date)}`
              : "No outstanding balance."
          }
          tone={totalBalance > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Messages"
          value={openThreads}
          helper={
            unreadMessages > 0
              ? `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`
              : "No unread messages."
          }
          tone={unreadMessages > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Advisor card */}
      <AdvisorCard unreadCount={unreadMessages} />

      {/* Upcoming trips */}
      <div
        className="card stack"
        style={{ border: "1px solid #e6f0f2" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              My Trips
            </p>
            <h2 style={{ margin: "3px 0 0" }}>Upcoming Adventures</h2>
          </div>
          <Link
            href="/trips"
            className="btn btn-outline"
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            View All Trips
          </Link>
        </div>

        {upcomingTrips.length === 0 ? (
          <p style={{ margin: 0, color: "#5e7e8f", lineHeight: 1.6 }}>
            No upcoming trips yet.{" "}
            <Link href="/travel-request" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>
              Request a quote
            </Link>{" "}
            to start planning your next adventure.
          </p>
        ) : (
          <div style={{ paddingTop: 4 }}>
            {upcomingTrips.slice(0, 5).map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </div>

      {/* Pending invites banner */}
      {pendingInvites.length > 0 && (
        <div
          className="card"
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 800, color: "#854f0b" }}>
              {pendingInvites.length} Pending Travel Invitation
              {pendingInvites.length === 1 ? "" : "s"}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#92400e" }}>
              You have been invited to join a shared trip.
            </p>
          </div>
          <Link
            href="/invites"
            className="btn btn-primary"
            style={{ background: "#854f0b", padding: "8px 16px", fontSize: 13 }}
          >
            Review Invitations
          </Link>
        </div>
      )}

      {/* Ask Cozy + Quick Actions */}
      <div className="grid grid-2">
        <AskCozyCompact />
        <QuickActions nextTripId={nextTrip?.trip_id ?? null} />
      </div>
    </PageShell>
  );
}