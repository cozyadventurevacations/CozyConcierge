import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Database resolves the trusted auth UID -> profile -> client account relationship.
export async function currentClientAccountId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("current_client_account_id");
  if (error) throw new Error("Your client access could not be verified.");
  return data || "00000000-0000-0000-0000-000000000000";
}
