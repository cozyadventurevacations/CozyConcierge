import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}
