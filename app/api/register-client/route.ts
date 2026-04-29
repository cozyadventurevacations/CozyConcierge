import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Rate limiting: max 5 registration attempts per IP per minute
const rateLimitMap = new Map<string, { count: number; firstRequest: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function getRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

function isRateLimited(request: Request): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, firstRequest: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count++;
  return false;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message:
        "Password must contain at least one special character (e.g. !@#$%).",
    };
  }

  return { valid: true, message: "" };
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      {
        error: "Too many registration attempts. Please try again in a minute.",
      },
      {
        status: 429,
      },
    );
  }

  try {
    const body = await request.json();

    const firstName = cleanText(body.firstName);
    const lastName = cleanText(body.lastName);
    const email = cleanEmail(body.email);
    const phonePrimary = cleanText(body.phonePrimary);
    const password = cleanText(body.password);

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        {
          error: "First name, last name, email, and password are required.",
        },
        {
          status: 400,
        },
      );
    }

    const passwordCheck = validatePassword(password);

    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          error: passwordCheck.message,
        },
        {
          status: 400,
        },
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: createdUserData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone_primary: phonePrimary || null,
          role: "client",
        },
      });

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        {
          error: createUserError?.message ?? "Unable to create user.",
        },
        {
          status: 400,
        },
      );
    }

    const authUser = createdUserData.user;

    const { data: existingProfile, error: existingProfileError } =
      await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        {
          error: existingProfileError.message,
        },
        {
          status: 500,
        },
      );
    }

    let profileId = existingProfile?.id ?? null;

    if (!profileId) {
      const { data: insertedProfile, error: insertProfileError } =
        await supabaseAdmin
          .from("user_profiles")
          .insert({
            auth_user_id: authUser.id,
            email,
            role: "client",
          })
          .select("id")
          .single();

      if (insertProfileError || !insertedProfile) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);

        return NextResponse.json(
          {
            error:
              insertProfileError?.message ??
              "Unable to create client user profile.",
          },
          {
            status: 500,
          },
        );
      }

      profileId = insertedProfile.id;
    }

    const { data: existingClientAccount, error: existingClientAccountError } =
      await supabaseAdmin
        .from("client_accounts")
        .select("id")
        .eq("user_profile_id", profileId)
        .maybeSingle();

    if (existingClientAccountError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      return NextResponse.json(
        {
          error: existingClientAccountError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!existingClientAccount) {
      const { error: insertClientAccountError } = await supabaseAdmin
        .from("client_accounts")
        .insert({
          user_profile_id: profileId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone_primary: phonePrimary || null,
        });

      if (insertClientAccountError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);

        return NextResponse.json(
          {
            error: insertClientAccountError.message,
          },
          {
            status: 500,
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Client account created successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create client account.",
      },
      {
        status: 500,
      },
    );
  }
}