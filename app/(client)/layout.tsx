import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { clientNav } from "@/components/layout/client-nav";
import { requireClient } from "@/lib/auth/require-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccountRow = {
  id: string;
};

async function getClientAccountIdForCurrentUser(userId: string, email?: string | null) {
  const supabase = await createServerSupabaseClient();
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail) {
    const { data: clientAccountByEmail, error: clientEmailError } = await supabase
      .from("client_accounts")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (clientEmailError) throw new Error(clientEmailError.message);
    if (clientAccountByEmail) {
      return { supabase, clientAccountId: (clientAccountByEmail as ClientAccountRow).id };
    }
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  if (!userProfile?.id) return { supabase, clientAccountId: null };

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) throw new Error(clientProfileError.message);

  return {
    supabase,
    clientAccountId: (clientAccountByProfile as ClientAccountRow | null)?.id ?? null,
  };
}

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();

  const { supabase, clientAccountId } = await getClientAccountIdForCurrentUser(
    user.id,
    user.email,
  );

  let unreadMessageThreads = 0;
  let pendingInviteCount = 0;

  if (clientAccountId) {
    const { count: privateUnreadCount } = await supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("client_account_id", clientAccountId)
      .eq("status", "open")
      .gt("client_unread_count", 0);

    const { data: tripMemberRows } = await supabase
      .from("trip_members" as any)
      .select("trip_id")
      .eq("client_account_id", clientAccountId)
      .eq("invite_status", "active")
      .eq("can_view_trip", true)
      .eq("can_join_group_messages", true);

    const tripIds = Array.from(
      new Set(
        (tripMemberRows ?? [])
          .map((row: { trip_id?: string | null }) => row.trip_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let groupUnreadCount = 0;

    if (tripIds.length > 0) {
      const { count } = await supabase
        .from("message_threads" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("thread_type", "trip_group")
        .in("trip_id", tripIds)
        .gt("client_unread_count", 0);

      groupUnreadCount = count ?? 0;
    }

    if (user.email) {
      const { count } = await supabase
        .from("trip_members" as any)
        .select("id", { count: "exact", head: true })
        .or(
          `invite_email.ilike.${user.email.trim().toLowerCase()},client_account_id.eq.${clientAccountId}`,
        )
        .eq("invite_status", "invited");

      pendingInviteCount = count ?? 0;
    }

    unreadMessageThreads = Number(privateUnreadCount ?? 0) + groupUnreadCount + pendingInviteCount;
  }

  const navItems = clientNav.map((item) =>
    item.href === "/messages"
      ? { ...item, badge: unreadMessageThreads }
      : item,
  );

  return (
    <>
      <AppHeader navItems={navItems} homeHref="/dashboard" />
      {children}

      {/* Advisor footer — appears on every client page */}
      <footer
        style={{
          marginTop: 48,
          borderTop: "1px solid #e6f0f2",
          background: "#123f5b",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Left — advisor info */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                border: "2px solid rgba(255,255,255,0.2)",
              }}
            >
              <Image
                src="/jeremy.jpg"
                alt="Jeremy Brown"
                width={44}
                height={44}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>

            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 700,
                }}
              >
                Your Advisor
              </p>
              <p style={{ margin: "2px 0 0", fontWeight: 800, color: "#ffffff", fontSize: 15 }}>
                Jeremy Brown
              </p>
              <p style={{ margin: "1px 0 0", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                Cozy Adventure Vacations &middot; <em>Memories Await!</em>
              </p>
            </div>
          </div>

          {/* Right — actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href="/messages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              ✉ Message Advisor
            </Link>

            <Link
              href="/travel-request"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 12,
                background: "#ffffff",
                color: "#123f5b",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Request a Quote
            </Link>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 24px",
            textAlign: "center",
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
          }}
        >
          Cozy Concierge · Powered by Cozy Adventure Vacations ·{" "}
          <a
            href="https://www.cozyadventurevacations.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
          >
            cozyadventurevacations.com
          </a>
        </div>
      </footer>
    </>
  );
}
