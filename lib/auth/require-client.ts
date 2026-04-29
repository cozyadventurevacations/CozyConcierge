import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireClient() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!data || data.role !== "client") {
    redirect("/admin/dashboard");
  }

  return user;
}
