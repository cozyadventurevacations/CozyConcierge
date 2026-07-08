import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptBuffer } from "@/lib/encryption";

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
  const openIndex = parts.lastIndexOf("open");

  if (openIndex <= 0) {
    return null;
  }

  return parts[openIndex - 1] ?? null;
}

function safeAttachmentFileName(fileName: string | null | undefined) {
  return (
    String(fileName ?? "payment-document")
      .trim()
      .replace(/["\r\n]/g, "")
      .replace(/[\\/]/g, "_") || "payment-document"
  );
}

export async function GET(request: Request) {
  try {
    const documentId = getDocumentIdFromRequestUrl(request);

    if (!documentId || documentId === "undefined" || !isUuid(documentId)) {
      return NextResponse.json(
        {
          error: "Invalid or missing payment document ID.",
          receivedDocumentId: documentId,
          expectedUrlFormat:
            "/api/admin/payment-request-documents/{documentId}/open",
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
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!isAdminRole(profileByAuthId?.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: document, error: documentError } = await supabaseAdmin
      .from("trip_documents")
      .select("id, file_name, storage_path, mime_type, is_encrypted, payment_request_id")
      .eq("id", documentId)
      .not("payment_request_id", "is", null)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: documentError?.message ?? "Payment document not found." },
        { status: 404 },
      );
    }

    if (!document.storage_path) {
      return NextResponse.json(
        { error: "This payment document does not have a storage path." },
        { status: 400 },
      );
    }

    const { data: encryptedFile, error: downloadError } = await supabaseAdmin.storage
      .from("trip-documents")
      .download(document.storage_path);

    if (downloadError || !encryptedFile) {
      return NextResponse.json(
        { error: downloadError?.message ?? "Unable to download payment document." },
        { status: 500 },
      );
    }

    const encryptedBytes = Buffer.from(await encryptedFile.arrayBuffer());
    const fileBytes = document.is_encrypted
      ? decryptBuffer(encryptedBytes)
      : encryptedBytes;
    const contentType = document.mime_type || "application/octet-stream";
    const responseBody = new Blob([new Uint8Array(fileBytes)], {
      type: contentType,
    });
    const fileName = safeAttachmentFileName(document.file_name);

    return new Response(responseBody, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open payment document.",
      },
      { status: 500 },
    );
  }
}
