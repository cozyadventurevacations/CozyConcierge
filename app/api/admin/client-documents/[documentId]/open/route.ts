import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function createSupabaseAdminClient() {
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

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "owner" ||
    normalizedRole === "administrator"
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getDocumentIdFromRequestUrl(request: Request) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // Expected:
  // api/admin/client-documents/{documentId}/open
  const openIndex = parts.lastIndexOf("open");

  if (openIndex <= 0) {
    return null;
  }

  return parts[openIndex - 1] ?? null;
}

export async function GET(request: Request) {
  try {
    const documentId = getDocumentIdFromRequestUrl(request);

    if (!documentId || documentId === "undefined" || !isUuid(documentId)) {
      return NextResponse.json(
        {
          error: "Invalid or missing document ID.",
          receivedDocumentId: documentId,
          expectedUrlFormat:
            "/api/admin/client-documents/{documentId}/open",
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: profileByAuthId, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    if (!isAdminRole(profileByAuthId?.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: clientDocument, error: documentError } = await supabaseAdmin
      .from("client_documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .single();

    if (documentError || !clientDocument) {
      return NextResponse.json(
        { error: documentError?.message ?? "Document not found." },
        { status: 404 },
      );
    }

    if (!clientDocument.storage_path) {
      return NextResponse.json(
        { error: "This document does not have a storage path." },
        { status: 400 },
      );
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("client-documents")
        .createSignedUrl(clientDocument.storage_path, 60 * 5);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        {
          error:
            signedUrlError?.message ??
            "Unable to create secure document link.",
        },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signedUrlData.signedUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open document.",
      },
      { status: 500 },
    );
  }
}