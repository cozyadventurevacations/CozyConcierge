import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeRole(role: string | null | undefined) {
  return String(role ?? "").trim().toLowerCase();
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "admin" ||
    normalizedRole === "owner" ||
    normalizedRole === "administrator"
  );
}

export async function requireClient() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const role = normalizeRole(data?.role);

  if (role === "client") {
    return user;
  }

  if (isAdminRole(role)) {
    redirect("/admin/dashboard");
  }

  redirect("/login");
}