import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  const { data: profile, error } = await supabase.from("user_profiles")
    .select("id, auth_user_id, email, role").eq("auth_user_id", user.id).maybeSingle();
  if (error) throw new Error("Your access could not be verified.");
  if (!profile || !["admin", "owner", "administrator"].includes(String(profile.role).toLowerCase())) {
    redirect("/dashboard");
  }
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") redirect("/auth/mfa?next=/admin/dashboard");
  return { supabase, user, profile };
}
