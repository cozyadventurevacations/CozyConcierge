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

    if (clientEmailError) {
      throw new Error(clientEmailError.message);
    }

    if (clientAccountByEmail) {
      return {
        supabase,
        clientAccountId: (clientAccountByEmail as ClientAccountRow).id,
      };
    }
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!userProfile?.id) {
    return {
      supabase,
      clientAccountId: null,
    };
  }

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) {
    throw new Error(clientProfileError.message);
  }

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

    unreadMessageThreads = Number(privateUnreadCount ?? 0) + groupUnreadCount;
  }

  const navItems = clientNav.map((item) =>
    item.href === "/messages"
      ? {
          ...item,
          badge: unreadMessageThreads,
        }
      : item,
  );

  return (
    <>
      <AppHeader navItems={navItems} homeHref="/dashboard" />
      {children}
    </>
  );
}