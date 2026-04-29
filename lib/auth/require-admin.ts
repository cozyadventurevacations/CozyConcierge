import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type UserProfile = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role: string | null;
};

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "owner" ||
    normalizedRole === "administrator"
  );
}

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = user.email?.trim().toLowerCase() ?? "";

  const { data: profileByAuthId, error: profileByAuthIdError } = await supabase
    .from("user_profiles")
    .select("id, auth_user_id, email, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileByAuthIdError) {
    throw new Error(profileByAuthIdError.message);
  }

  const profile = profileByAuthId as UserProfile | null;

  if (profile && isAdminRole(profile.role)) {
    return {
      supabase,
      user,
      profile,
    };
  }

  if (userEmail) {
    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("user_profiles")
      .select("id, auth_user_id, email, role")
      .ilike("email", userEmail)
      .maybeSingle();

    if (profileByEmailError) {
      throw new Error(profileByEmailError.message);
    }

    const emailProfile = profileByEmail as UserProfile | null;

    if (emailProfile && isAdminRole(emailProfile.role)) {
      return {
        supabase,
        user,
        profile: emailProfile,
      };
    }
  }

  redirect("/dashboard");
}