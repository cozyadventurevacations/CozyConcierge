import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error.";
  }
}

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not signed in.");
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

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientAccountByEmail) {
    return {
      supabase,
      clientAccount: clientAccountByEmail as ClientAccount,
    };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: clientAccountByProfile, error: clientProfileError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("user_profile_id", userProfile.id)
    .maybeSingle();

  if (clientProfileError) {
    throw new Error(clientProfileError.message);
  }

  if (!clientAccountByProfile) {
    throw new Error("Client account not found.");
  }

  return {
    supabase,
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

export async function GET() {
  try {
    const { supabase, clientAccount } = await getCurrentClientAccount();

    const { data: threads, error } = await supabase
      .from("ask_cozy_threads")
      .select(
        "id, trip_id, title, status, retention_until, created_at, updated_at",
      )
      .eq("client_account_id", clientAccount.id)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      threads: threads ?? [],
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Ask Cozy threads API error:", message);

    return NextResponse.json(
      {
        error: `Ask Cozy threads API error: ${message}`,
      },
      { status: 500 },
    );
  }
}