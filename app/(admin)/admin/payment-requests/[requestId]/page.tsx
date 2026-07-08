import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { encryptBuffer } from "@/lib/encryption";

type PaymentRequestDetail = {
  id: string;
  status: string;
  requested_amount: number | null;
  requested_payment_date: string | null;
  requested_at: string | null;
  completed_at: string | null;
  client_message: string | null;
  trip_id: string;
  client_account_id: string;
  trips:
    | {
        id: string;
        trip_name: string | null;
        balance_due: number | null;
        final_payment_due_date: string | null;
        trip_status: string | null;
      }[]
    | null;
  client_accounts:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone_primary: string | null;
      }[]
    | null;
};

type PaymentRequestDocument = {
  id: string;
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  payment_document_type: string | null;
  is_encrypted: boolean | null;
  created_at: string | null;
};

const allowedStatuses = ["new", "sent", "completed", "cancelled", "declined"];
const billableTripComponentTypes = [
  "hotel",
  "air",
  "cruise",
  "transfer",
  "rental_car",
  "activity",
  "insurance",
];
const paymentDocumentTypes = ["receipt", "authorization_form", "other"] as const;
const MAX_PAYMENT_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
const allowedPaymentDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const allowedPaymentDocumentExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getPaymentDocumentTypeLabel(value: string | null | undefined) {
  if (value === "receipt") return "Payment Receipt";
  if (value === "authorization_form") return "Authorization Form";
  return "Other Payment Document";
}

function validatePaymentDocumentType(value: string) {
  if (!paymentDocumentTypes.includes(value as (typeof paymentDocumentTypes)[number])) {
    throw new Error("Invalid payment document type.");
  }

  return value;
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex).toLowerCase();
}

function validatePaymentDocumentFile(file: File) {
  if (file.size === 0) {
    throw new Error("Selected file is empty.");
  }

  if (file.size > MAX_PAYMENT_DOCUMENT_SIZE_BYTES) {
    throw new Error("File is too large. Maximum upload size is 15MB.");
  }

  const extension = getFileExtension(file.name);
  const mimeType = file.type || "";
  const hasAllowedExtension = allowedPaymentDocumentExtensions.includes(extension);
  const hasAllowedMimeType = mimeType ? allowedPaymentDocumentMimeTypes.includes(mimeType) : false;

  if (!hasAllowedExtension || (mimeType && !hasAllowedMimeType)) {
    throw new Error("Invalid file type. Allowed files: PDF, JPG, PNG, WEBP, DOC, and DOCX.");
  }
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getPaymentDocumentSchemaErrorMessage(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  if (
    message.includes("payment_request_id") ||
    message.includes("payment_document_type") ||
    message.includes("is_encrypted") ||
    message.includes("encryption_algorithm") ||
    message.includes("schema cache")
  ) {
    return "Payment request documents are not fully set up in Supabase yet. Run scripts/setup-payment-request-documents.sql in the Supabase SQL Editor, then try again.";
  }

  return null;
}

async function recalculateTripPaymentTotals(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tripId: string,
) {
  const [
    { data: components, error: componentsError },
    { data: proposal, error: proposalError },
    { data: ledgerEntries, error: ledgerError },
  ] = await Promise.all([
    supabase
      .from("trip_components" as any)
      .select("component_type, total_price")
      .eq("trip_id", tripId)
      .in("component_type", billableTripComponentTypes),
    supabase
      .from("trip_proposals" as any)
      .select("id, planning_fee")
      .eq("trip_id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_payment_ledger" as any)
      .select("entry_type, amount")
      .eq("trip_id", tripId),
  ]);

  if (componentsError) {
    throw new Error(componentsError.message);
  }

  if (proposalError) {
    throw new Error(proposalError.message);
  }

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const componentTotal = (components ?? []).reduce(
    (sum, component) => sum + Number(component.total_price ?? 0),
    0,
  );
  const planningFee = Number(proposal?.planning_fee ?? 0);
  const calculatedTripTotal = roundMoney(componentTotal + planningFee);

  const ledgerTotalPaid = (ledgerEntries ?? []).reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    if (entry.entry_type === "payment") return sum + amount;
    if (entry.entry_type === "refund") return sum - amount;
    return sum;
  }, 0);

  const ledgerBalanceAdjustment = (ledgerEntries ?? []).reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    if (entry.entry_type === "credit") return sum - amount;
    if (entry.entry_type === "fee" || entry.entry_type === "adjustment") {
      return sum + amount;
    }
    return sum;
  }, 0);

  const totalPaid = Math.max(0, roundMoney(ledgerTotalPaid));
  const balanceDue = Math.max(
    0,
    roundMoney(calculatedTripTotal - totalPaid + ledgerBalanceAdjustment),
  );

  const { error: tripUpdateError } = await supabase
    .from("trips")
    .update({
      total_paid: totalPaid,
      balance_due: balanceDue,
    })
    .eq("id", tripId);

  if (tripUpdateError) {
    throw new Error(tripUpdateError.message);
  }

  if (proposal?.id) {
    const { error: proposalUpdateError } = await supabase
      .from("trip_proposals" as any)
      .update({ total_price: calculatedTripTotal })
      .eq("id", proposal.id);

    if (proposalUpdateError) {
      throw new Error(proposalUpdateError.message);
    }
  }
}

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: "#f0f7f8",
        color: "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {status ?? "new"}
    </span>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid #eef2f5",
        borderRadius: 12,
        background: "#fbfdfe",
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "6px 0 0", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
        {value === null || value === undefined || value === ""
          ? "Not provided"
          : value}
      </p>
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-primary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function StatusButton({
  requestId,
  status,
  label,
}: {
  requestId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updatePaymentRequestStatus}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="btn btn-primary">
        {label}
      </button>
    </form>
  );
}

async function uploadPaymentRequestDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const paymentDocumentType = validatePaymentDocumentType(
    String(formData.get("payment_document_type") ?? "").trim(),
  );
  const file = formData.get("file");

  if (!requestId) throw new Error("Missing payment request ID.");
  if (!(file instanceof File)) throw new Error("File is required.");

  validatePaymentDocumentFile(file);

  const { data: paymentRequest, error: paymentRequestError } = await supabase
    .from("payment_requests")
    .select("id, trip_id")
    .eq("id", requestId)
    .single();

  if (paymentRequestError || !paymentRequest) {
    throw new Error(paymentRequestError?.message ?? "Payment request not found.");
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !userProfile) {
    throw new Error("User profile not found.");
  }

  const safeFileName =
    file.name
      .trim()
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .replace(/_+/g, "_") || "payment-document";
  const storagePath = `${paymentRequest.trip_id}/payments/${requestId}/${crypto.randomUUID()}-${safeFileName}`;
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);
  const encryptedFileBuffer = encryptBuffer(fileBuffer);

  const { error: uploadError } = await supabase.storage
    .from("trip-documents")
    .upload(storagePath, encryptedFileBuffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await supabase
    .from("trip_documents")
    .insert({
      trip_id: paymentRequest.trip_id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      visibility: "internal",
      component_id: null,
      component_type: null,
      attach_to_commission: false,
      uploaded_by_user_profile_id: userProfile.id,
      payment_request_id: requestId,
      payment_document_type: paymentDocumentType,
      is_encrypted: true,
      encryption_algorithm: "aes-256-gcm",
    });

  if (insertError) {
    await supabase.storage.from("trip-documents").remove([storagePath]);
    throw new Error(
      getPaymentDocumentSchemaErrorMessage(insertError) ??
        insertError.message,
    );
  }

  revalidatePath(`/admin/payment-requests/${requestId}`);
  revalidatePath(`/admin/trips/${paymentRequest.trip_id}`);
  revalidatePath(`/admin/trips/${paymentRequest.trip_id}/documents`);
}

async function deletePaymentRequestDocument(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!requestId) throw new Error("Missing payment request ID.");
  if (!documentId) throw new Error("Missing document ID.");

  const { data: document, error: documentError } = await supabase
    .from("trip_documents")
    .select("id, trip_id, storage_path")
    .eq("id", documentId)
    .eq("payment_request_id", requestId)
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? "Payment document not found.");
  }

  const { error: deleteError } = await supabase
    .from("trip_documents")
    .delete()
    .eq("id", documentId)
    .eq("payment_request_id", requestId);

  if (deleteError) {
    throw new Error(
      getPaymentDocumentSchemaErrorMessage(deleteError) ??
        deleteError.message,
    );
  }

  if (document.storage_path) {
    await supabase.storage.from("trip-documents").remove([document.storage_path]);
  }

  revalidatePath(`/admin/payment-requests/${requestId}`);
  revalidatePath(`/admin/trips/${document.trip_id}`);
  revalidatePath(`/admin/trips/${document.trip_id}/documents`);
}

async function updatePaymentRequestStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();

  if (!requestId) {
    throw new Error("Missing payment request ID.");
  }

  if (!allowedStatuses.includes(newStatus)) {
    throw new Error("Invalid payment request status.");
  }

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("payment_requests")
    .select("id, trip_id, status, requested_amount, requested_payment_date")
    .eq("id", requestId)
    .single();

  if (existingRequestError || !existingRequest) {
    throw new Error(existingRequestError?.message ?? "Payment request not found.");
  }

  const previousStatus = String(existingRequest.status ?? "new").toLowerCase();
  const requestedAmount = Number(existingRequest.requested_amount ?? 0);
  const ledgerReference = `payment-request:${requestId}`;

  let hasLinkedLedgerEntry = false;

  if (newStatus === "completed" || previousStatus === "completed") {
    const { data: linkedLedgerEntry, error: linkedLedgerError } = await supabase
      .from("trip_payment_ledger" as any)
      .select("id")
      .eq("trip_id", existingRequest.trip_id)
      .eq("reference_number", ledgerReference)
      .maybeSingle();

    if (linkedLedgerError) {
      throw new Error(linkedLedgerError.message);
    }

    hasLinkedLedgerEntry = Boolean(linkedLedgerEntry);
  }

  const isCompletingPayment = newStatus === "completed" && !hasLinkedLedgerEntry;
  const isReopeningCompletedPayment =
    previousStatus === "completed" && newStatus !== "completed" && hasLinkedLedgerEntry;

  if ((isCompletingPayment || isReopeningCompletedPayment) && requestedAmount <= 0) {
    throw new Error("This payment request does not have a valid amount to apply to the trip.");
  }

  const updates: {
    status: string;
    completed_at?: string | null;
  } = {
    status: newStatus,
  };

  if (newStatus === "completed") {
    updates.completed_at = new Date().toISOString();
  } else {
    updates.completed_at = null;
  }

  const { error } = await supabase
    .from("payment_requests")
    .update(updates)
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  if (isCompletingPayment || isReopeningCompletedPayment) {
    if (isCompletingPayment) {
      const { error: ledgerError } = await supabase
        .from("trip_payment_ledger" as any)
        .insert({
          trip_id: existingRequest.trip_id,
          entry_type: "payment",
          amount: requestedAmount,
          entry_date: existingRequest.requested_payment_date ?? todayDateString(),
          payment_method: "Client payment request",
          reference_number: ledgerReference,
          notes: "Applied automatically when the payment request was marked completed.",
        });

      if (ledgerError) {
        throw new Error(ledgerError.message);
      }
    }

    if (isReopeningCompletedPayment) {
      const { error: ledgerDeleteError } = await supabase
        .from("trip_payment_ledger" as any)
        .delete()
        .eq("trip_id", existingRequest.trip_id)
        .eq("reference_number", ledgerReference);

      if (ledgerDeleteError) {
        throw new Error(ledgerDeleteError.message);
      }
    }
  }

  if (newStatus === "completed" || previousStatus === "completed") {
    await recalculateTripPaymentTotals(supabase, existingRequest.trip_id);
  }

  revalidatePath("/admin/payment-requests");
  revalidatePath(`/admin/payment-requests/${requestId}`);
  revalidatePath(`/admin/trips/${existingRequest.trip_id}`);
  revalidatePath(`/trips/${existingRequest.trip_id}`);
}

export default async function AdminPaymentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { supabase } = await requireAdmin();

  if (!requestId || requestId === "undefined") {
    return (
      <PageShell
        title="Payment Request Detail"
        subtitle="We could not load this payment request."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>Missing payment request ID.</p>
        </div>
      </PageShell>
    );
  }

  const { data, error } = await supabase
    .from("payment_requests")
    .select(
      `
      id,
      status,
      requested_amount,
      requested_payment_date,
      requested_at,
      completed_at,
      client_message,
      trip_id,
      client_account_id,
      trips!payment_requests_trip_id_fkey (
        id,
        trip_name,
        balance_due,
        final_payment_due_date,
        trip_status
      ),
      client_accounts!payment_requests_client_account_id_fkey (
        first_name,
        last_name,
        email,
        phone_primary
      )
    `,
    )
    .eq("id", requestId)
    .single();

  if (error || !data) {
    return (
      <PageShell
        title="Payment Request Detail"
        subtitle="We could not load this payment request."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const request = data as PaymentRequestDetail;
  const trip = request.trips?.[0] ?? null;
  const client = request.client_accounts?.[0] ?? null;
  const { data: paymentDocumentsData, error: paymentDocumentsError } = await supabase
    .from("trip_documents")
    .select("id, file_name, storage_path, mime_type, file_size_bytes, payment_document_type, is_encrypted, created_at")
    .eq("payment_request_id", request.id)
    .order("created_at", { ascending: false });
  const paymentDocumentsSetupMessage =
    getPaymentDocumentSchemaErrorMessage(paymentDocumentsError);
  const paymentDocuments = (paymentDocumentsData ?? []) as PaymentRequestDocument[];

  const clientName = client
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : "Unknown Client";

  const emailSubject = encodeURIComponent(
    `Payment link for ${trip?.trip_name ?? "your trip"}`,
  );

  const emailBody = encodeURIComponent(
    `Hi ${client?.first_name ?? ""},\n\nYour payment link for ${
      trip?.trip_name ?? "your trip"
    } is ready.\n\nRequested amount: ${formatMoney(
      request.requested_amount,
    )}\nRequested payment date: ${formatDate(
      request.requested_payment_date,
    )}\n\n`,
  );

  return (
    <PageShell
      title="Payment Request Detail"
      subtitle={`${clientName || "Unknown Client"} • ${trip?.trip_name ?? "Unknown Trip"}`}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <ActionLink href="/admin/payment-requests">
          Back to Payment Requests
        </ActionLink>

        {trip ? (
          <ActionLink href={`/admin/trips/${trip.id}`}>Open Linked Trip</ActionLink>
        ) : null}
      </div>

      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 70%)",
          border: "1px solid #e6f0f2",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 800,
              }}
            >
              Payment Request
            </p>

            <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>
              {formatMoney(request.requested_amount)}
            </h1>

            <p style={{ margin: "6px 0 0", color: "#667085" }}>
              {clientName || "Unknown Client"} • {trip?.trip_name ?? "Unknown Trip"}
            </p>
          </div>

          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Requested Amount</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(request.requested_amount)}
          </p>
        </div>

        <div className="card">
          <span className="label">Requested Payment Date</span>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>
            {formatDate(request.requested_payment_date)}
          </p>
        </div>

        <div className="card">
          <span className="label">Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusBadge status={request.status} />
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Request Details</h2>

        <div className="grid grid-2">
          <InfoItem label="Submitted" value={formatDateTime(request.requested_at)} />
          <InfoItem label="Completed" value={formatDateTime(request.completed_at)} />
          <InfoItem label="Client" value={clientName || "Unknown Client"} />
          <InfoItem label="Client Email" value={client?.email ?? "Not provided"} />
          <InfoItem label="Client Phone" value={client?.phone_primary ?? "Not provided"} />
          <InfoItem label="Trip" value={trip?.trip_name ?? "Unknown Trip"} />
        </div>

        <InfoItem
          label="Client Message"
          value={request.client_message ?? "No message provided."}
        />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusButton requestId={request.id} status="new" label="Mark New" />
          <StatusButton requestId={request.id} status="sent" label="Mark Sent" />
          <StatusButton requestId={request.id} status="completed" label="Mark Completed" />
          <StatusButton requestId={request.id} status="cancelled" label="Mark Cancelled" />
          <StatusButton requestId={request.id} status="declined" label="Mark Declined" />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Payment Documents</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Upload payment receipts, signed authorization forms, or other payment records for this request.
        </p>

        {paymentDocumentsSetupMessage ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              color: "#9a3412",
              lineHeight: 1.55,
              fontWeight: 700,
            }}
          >
            {paymentDocumentsSetupMessage}
          </div>
        ) : paymentDocumentsError ? (
          <div>
            <p>
              <strong>Error loading payment documents:</strong>
            </p>
            <pre>{JSON.stringify(paymentDocumentsError, null, 2)}</pre>
          </div>
        ) : null}

        <form action={uploadPaymentRequestDocument} className="stack">
          <input type="hidden" name="request_id" value={request.id} />
          <div className="grid grid-2">
            <label className="stack-sm">
              <span className="label">Document Type</span>
              <select className="select" name="payment_document_type" defaultValue="receipt" required>
                <option value="receipt">Payment Receipt</option>
                <option value="authorization_form">Authorization Form</option>
                <option value="other">Other Payment Document</option>
              </select>
            </label>

            <label className="stack-sm">
              <span className="label">File</span>
              <input
                className="input"
                type="file"
                name="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                required
              />
            </label>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            Payment documents are saved as internal trip files and linked to this payment request.
          </div>

          <button type="submit" className="btn btn-primary" disabled={Boolean(paymentDocumentsSetupMessage)}>
            Upload Payment Document
          </button>
        </form>

        {paymentDocuments.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No payment documents have been uploaded yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>File</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>{getPaymentDocumentTypeLabel(document.payment_document_type)}</td>
                    <td>{document.file_name ?? "Payment document"}</td>
                    <td>{formatFileSize(document.file_size_bytes)}</td>
                    <td>{formatDateTime(document.created_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <a
                          className="btn btn-outline"
                          href={`/api/admin/payment-request-documents/${document.id}/open`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                        <form action={deletePaymentRequestDocument}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="document_id" value={document.id} />
                          <button type="submit" className="btn btn-outline" style={{ borderColor: "#fecaca", color: "#b42318" }}>
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Client Follow-Up</h2>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {client?.email ? (
            <a
              href={`mailto:${client.email}?subject=${emailSubject}&body=${emailBody}`}
              className="btn btn-primary"
            >
              Email Client
            </a>
          ) : null}

          <ActionLink href="/admin/payment-requests">
            Back to Payment Requests
          </ActionLink>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Linked Trip</h2>

        <div className="grid grid-2">
          <InfoItem label="Trip Name" value={trip?.trip_name ?? "Unknown Trip"} />
          <InfoItem label="Trip Status" value={trip?.trip_status ?? "Not provided"} />
          <InfoItem label="Balance Due" value={formatMoney(trip?.balance_due)} />
          <InfoItem
            label="Final Payment Due Date"
            value={formatDate(trip?.final_payment_due_date)}
          />
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {trip ? (
            <ActionLink href={`/admin/trips/${trip.id}`}>Open Linked Trip</ActionLink>
          ) : null}

          <ActionLink href="/admin/payment-requests">
            Back to Payment Requests
          </ActionLink>
        </div>
      </div>
    </PageShell>
  );
}
