import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { protectPublicRequest, requestIp } from "@/lib/security/request-limits";
import { sendRegistrationConfirmation } from "@/lib/email/confirm-registration";

export const dynamic = "force-dynamic";

async function verifyTurnstileToken(request: Request, token: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return {
      valid: false,
      message: "Registration protection is not configured.",
    };
  }

  if (!token) {
    return {
      valid: false,
      message: "Please complete the security check before creating your account.",
    };
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const remoteIp = requestIp(request);
  if (remoteIp && remoteIp !== "unknown") {
    formData.append("remoteip", remoteIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    return {
      valid: false,
      message: "The security check could not be verified. Please try again.",
    };
  }

  const result = (await response.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!result.success) {
    return {
      valid: false,
      message: "The security check failed. Please refresh and try again.",
    };
  }

  return {
    valid: true,
    message: "",
  };
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
  try {
    const body = await request.json();
    const email = cleanEmail(body.email);
    const limited = await protectPublicRequest(request, "registration", email);
    if (limited) return limited;
    const firstName = cleanText(body.firstName).slice(0, 100);
    const lastName = cleanText(body.lastName).slice(0, 100);
    const phonePrimary = cleanText(body.phonePrimary).slice(0, 50);
    const password = typeof body.password === "string" ? body.password : "";
    const generic = { success: true, requiresEmailConfirmation: true,
      message: "Check your email to confirm your account. If you already have an account, sign in or reset your password." };
    if (cleanText(body.website)) return NextResponse.json(generic);
    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length > 128) {
      return NextResponse.json({ error: "Enter your name, a valid email, and a password of 8–128 characters." }, { status: 400 });
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
    const check = await verifyTurnstileToken(request, cleanText(body.captchaToken));
    if (!check.valid) return NextResponse.json({ error: check.message }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().auth.admin.generateLink({
      type: "signup", email, password,
      options: { data: { first_name: firstName, last_name: lastName, phone_primary: phonePrimary || null } },
    });
    if (error) {
      if (["email_exists", "user_already_exists"].includes(error.code ?? "")) return NextResponse.json(generic);
      throw new Error("Registration unavailable.");
    }
    if (data.user?.email_confirmed_at) return NextResponse.json(generic);
    if (!data.properties?.hashed_token) throw new Error("Confirmation unavailable.");
    await sendRegistrationConfirmation(email, data.properties.hashed_token);
    return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to complete registration right now. Please try again shortly." }, { status: 503 });
  }
}
