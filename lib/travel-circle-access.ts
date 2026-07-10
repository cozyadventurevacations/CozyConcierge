type SupabaseLike = {
  from: (table: string) => any;
};

export type TripMemberAccess = {
  id: string;
  role?: string | null;
  invite_status?: string | null;
  can_view_trip?: boolean | null;
  can_view_shared_documents?: boolean | null;
  can_upload_own_documents?: boolean | null;
  can_manage_companions?: boolean | null;
  client_account_id?: string | null;
  invite_email?: string | null;
};

export function normalizeTravelCircleEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

export function tripMemberIdentityFilter(clientAccountId: string, email: string | null | undefined) {
  const normalizedEmail = normalizeTravelCircleEmail(email);
  return normalizedEmail
    ? `client_account_id.eq.${clientAccountId},invite_email.ilike.${normalizedEmail}`
    : `client_account_id.eq.${clientAccountId}`;
}

export async function findActiveTripMemberAccess<T extends TripMemberAccess = TripMemberAccess>({
  supabase,
  tripId,
  clientAccountId,
  email,
  select,
}: {
  supabase: SupabaseLike;
  tripId: string;
  clientAccountId: string;
  email?: string | null;
  select: string;
}) {
  const { data, error } = await supabase
    .from("trip_members")
    .select(select)
    .eq("trip_id", tripId)
    .or(tripMemberIdentityFilter(clientAccountId, email))
    .eq("invite_status", "active")
    .limit(1)
    .maybeSingle();

  return { data: (data as T | null) ?? null, error };
}
