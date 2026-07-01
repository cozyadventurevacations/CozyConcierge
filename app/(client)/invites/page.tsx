import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripInfo = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
};

type TripInviteRow = {
  id: string;
  trip_id: string;
  client_account_id: string | null;
  invite_email: string | null;
  invite_name: string | null;
  role: string;
  invite_status: string;
  created_at: string | null;
  trips: TripInfo | TripInfo[] | null;
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

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTrip(invite: TripInviteRow) {
  if (Array.isArray(invite.trips)) {
    return invite.trips[0] ?? null;
  }

  return invite.trips ?? null;
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

function StatusPill({
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

  if (clientEmailError) throw new Error(clientEmailError.message);

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

  if (profileError) throw new Error(profileError.message);
  if (!userProfile) throw new Error("User profile not found.");

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) throw new Error(clientProfileError.message);
  if (!clientAccountByProfile) throw new Error("Client account not found.");

  return {
    supabase,
    user,
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

export default async function ClientInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: inviteStatus } = await searchParams;
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell title="Shared Trips" subtitle="We could not load your account.">
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

  const clientEmail = clientAccount.email?.trim().toLowerCase();

  if (!clientEmail) {
    return (
      <PageShell
        title="Shared Trips"
        subtitle="Shared trip access is matched by email address."
      >
        <div className="card">
          <p>Your client account does not have an email address.</p>
        </div>
      </PageShell>
    );
  }

  const { data: pendingInvites, error: pendingError } = await supabase
    .from("trip_members" as any)
    .select(
      "id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
    )
    .or(`invite_email.ilike.${clientEmail},client_account_id.eq.${clientAccount.id}`)
    .eq("invite_status", "invited")
    .order("created_at", { ascending: false });

  if (pendingError) {
    return (
      <PageShell
        title="Shared Trips"
        subtitle="Review trips shared with you through Travel Circle."
      >
        <div className="card">
          <p>
            <strong>Error loading shared trips:</strong>
          </p>
          <pre>{JSON.stringify(pendingError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const pendingRows = (pendingInvites ?? []) as TripInviteRow[];

  if (pendingRows.length > 0) {
    const displayName =
      `${clientAccount.first_name ?? ""} ${clientAccount.last_name ?? ""}`.trim() ||
      clientAccount.email ||
      null;

    for (const invite of pendingRows) {
      const { data: existingActiveMember, error: existingError } = await supabase
        .from("trip_members" as any)
        .select("id")
        .eq("trip_id", invite.trip_id)
        .eq("client_account_id", clientAccount.id)
        .eq("invite_status", "active")
        .maybeSingle();

      if (existingError) throw new Error(existingError.message);

      if (existingActiveMember) {
        const { error: removeDuplicateError } = await supabase
          .from("trip_members" as any)
          .update({
            invite_status: "removed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invite.id);

        if (removeDuplicateError) throw new Error(removeDuplicateError.message);
      } else {
        const { error: activateError } = await supabase
          .from("trip_members" as any)
          .update({
            client_account_id: clientAccount.id,
            invite_name: displayName,
            invite_status: "active",
            can_view_trip: true,
            can_view_shared_documents: true,
            can_join_group_messages: true,
            can_upload_own_documents: invite.role === "contributor",
            can_manage_companions: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invite.id)
          .eq("invite_status", "invited");

        if (activateError) throw new Error(activateError.message);
      }

      revalidatePath(`/trips/${invite.trip_id}`);
    }

    revalidatePath("/invites");
    revalidatePath("/trips");
    redirect("/invites?invite=activated");
  }

  const { data: activeMemberships, error: activeError } = await supabase
    .from("trip_members" as any)
    .select(
      "id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, created_at, trips(id, trip_name, destinations, departure_date, return_date)",
    )
    .or(`client_account_id.eq.${clientAccount.id},invite_email.ilike.${clientEmail}`)
    .eq("invite_status", "active")
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  if (activeError) {
    return (
      <PageShell
        title="Shared Trips"
        subtitle="Review trips shared with you through Travel Circle."
      >
        <div className="card">
          <p>
            <strong>Error loading shared trips:</strong>
          </p>
          <pre>{JSON.stringify(activeError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const activeRows = (activeMemberships ?? []) as TripInviteRow[];

  return (
    <PageShell
      title="Shared Trips"
      subtitle="Review trips shared with you through Travel Circle."
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
        <h2 style={{ margin: 0 }}>Travel Circle Access</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Shared trip access is matched to the email address on your Cozy Concierge account:
          <strong> {clientEmail}</strong>
        </p>
        <div className="grid grid-2">
          <div
            className="card"
            style={{
              border: "1px solid #e6f0f2",
              background: "#ffffff",
            }}
          >
            <span className="label">Shared Trips</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>
              {activeRows.length}
            </p>
          </div>

          <div
            className="card"
            style={{
              border: "1px solid #e6f0f2",
              background: "#ffffff",
            }}
          >
            <span className="label">Access Status</span>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>
              Active
            </p>
          </div>
        </div>
      </div>

      {inviteStatus === "activated" ? (
        <div
          className="card"
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1e3a8a",
            fontWeight: 800,
          }}
        >
          Your Travel Circle access is active. Your shared trips are listed below.
        </div>
      ) : null}

      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Shared Access Updates</h2>
          <StatusPill label={`${pendingRows.length} activating`} tone={pendingRows.length > 0 ? "warning" : "good"} />
        </div>

        {pendingRows.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            Any Travel Circle access shared with you will appear below automatically.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pendingRows.map((invite) => {
              const trip = getTrip(invite);

              return (
                <div
                  key={invite.id}
                  className="card stack"
                  style={{
                    border: "1px solid #fed7aa",
                    background: "#fff7ed",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "var(--accent-dark)" }}>
                        {trip?.trip_name ?? "Shared Trip"}
                      </p>
                      <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                        {trip?.destinations ?? "Destination not provided"}
                      </p>
                      <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                        {formatDate(trip?.departure_date)} → {formatDate(trip?.return_date)}
                      </p>
                    </div>

                    <StatusPill label={getRoleLabel(invite.role)} tone={invite.role === "contributor" ? "neutral" : "warning"} />
                  </div>

                  <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                    This shared trip access is active automatically. You can open the
                    trip to view shared details, documents, and Travel Circle messages
                    based on your access level.
                  </p>

                  {trip?.id ? (
                    <Link href={`/trips/${trip.id}`} className="btn btn-primary">
                      Open Trip
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Trips Shared With Me</h2>
          <StatusPill label={`${activeRows.length} active`} tone="neutral" />
        </div>

        {activeRows.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No trips have been shared with you yet. Once someone adds you to a Travel Circle, the trip will appear here automatically.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {activeRows.map((membership) => {
              const trip = getTrip(membership);

              return (
                <div
                  key={membership.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                    padding: "12px",
                    borderRadius: 14,
                    border: "1px solid #e6f0f2",
                    background: "#ffffff",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 900 }}>
                      {trip?.trip_name ?? "Shared Trip"}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>
                      {trip?.destinations ?? "Destination not provided"} • {getRoleLabel(membership.role)}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>
                      {formatDate(trip?.departure_date)} → {formatDate(trip?.return_date)}
                    </p>
                  </div>

                  {trip?.id ? (
                    <Link href={`/trips/${trip.id}`} className="btn btn-primary">
                      Open Trip
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          border: "1px solid #e6f0f2",
          background: "#f7fbfc",
          color: "#667085",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Privacy note:</strong> Travel Circle access is for shared trip
          information. Personal profile details, passport uploads, traveler numbers,
          and private advisor messages remain protected unless separately shared.
        </p>
      </div>
    </PageShell>
  );
}
