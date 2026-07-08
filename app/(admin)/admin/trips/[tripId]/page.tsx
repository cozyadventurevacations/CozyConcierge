/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Link from "next/link";
import OpenAI, { toFile } from "openai";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { AirportPicker } from "@/components/forms/airport-picker";
import { AirlinePicker } from "@/components/forms/airline-picker";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { HotelLibraryPicker } from "@/components/forms/hotel-library-picker";
import type { HotelLibraryRow } from "@/components/forms/hotel-library-picker";
import { LinkedDateRange } from "@/components/forms/linked-date-range";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";
import { ComponentDocumentUploadSubmitButton } from "./component-document-upload-submit-button";

const allowedTripStatuses = [
  "draft",
  "quoted",
  "reserved",
  "confirmed",
  "pending_final_payment",
  "paid_in_full",
  "travel_complete",
  "cancelled",
];

const billableTripComponentTypes = [
  "hotel",
  "air",
  "cruise",
  "transfer",
  "rental_car",
  "activity",
  "insurance",
];

const tripComponentTypeLabels: Record<string, string> = {
  hotel: "Hotel",
  air: "Air",
  cruise: "Cruise",
  transfer: "Transfer",
  rental_car: "Rental Car",
  activity: "Activity",
  insurance: "Insurance",
};

const allowedBookingStatuses = ["on_hold", "reserved", "quoted"];

const MAX_COMPONENT_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;

const answeredInsuranceDecisionValues = new Set([
  "accepted",
  "accept",
  "yes",
  "declined",
  "decline",
  "no",
  "waived",
  "coverage_accepted",
  "coverage_declined",
]);

function normalizeInsuranceDecision(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function hasInsuranceDecisionBeenAnswered(decision: unknown, decidedAt: unknown) {
  return (
    answeredInsuranceDecisionValues.has(normalizeInsuranceDecision(decision)) ||
    String(decidedAt ?? "").trim().length > 0
  );
}

function getCruisePriceWatchSchemaErrorMessage(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  if (
    message.includes("price_watch_") ||
    message.includes("cruise_price_watch_results") ||
    message.includes("schema cache")
  ) {
    return "Cruise Price Watch is not fully set up in Supabase yet. Run scripts/setup-cruise-price-watch.sql in the Supabase SQL Editor, then try saving the cruise again.";
  }

  return null;
}

const allowedComponentDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const allowedComponentDocumentExtensions = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];

const insuranceOfferedMilestoneTitle = "Travel insurance offered";

const defaultTripMilestones = [
  { title: "Quote requested", description: "Initial client request or inquiry has been received." },
  { title: "Trip created", description: "Trip record has been created in Cozy Concierge." },
  { title: "Deposit paid", description: "Client deposit has been paid or marked as not required." },
  { title: insuranceOfferedMilestoneTitle, description: "Travel protection has been offered and the client trip-page prompt is available." },
  { title: "Travel insurance accepted / declined", description: "Client decision about travel protection has been documented." },
  { title: "Client documents collected", description: "Required client documents have been collected or reviewed." },
  { title: "Supplier confirmations added", description: "Supplier confirmation numbers and booking details have been added." },
  { title: "Final payment reminder sent", description: "Client has been reminded about the final payment due date." },
  { title: "Final payment paid", description: "Trip is paid in full or balance has been resolved." },
  { title: "Travel documents sent", description: "Final travel documents, confirmations, or vouchers have been sent." },
  { title: "7-day pre-travel email sent", description: "Pre-travel readiness email has been sent to the client." },
  { title: "Client returned", description: "Client has returned from travel." },
  { title: "Post-trip follow-up sent", description: "Post-travel follow-up has been sent." },
  { title: "Review requested", description: "Client has been asked to share feedback or leave a review." },
  { title: "Trip complete", description: "All trip servicing, follow-up, and internal wrap-up items are complete." },
];

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
};

type HotelLibraryOption = HotelLibraryRow;

type ClientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ClientOption = ClientInfo;

type CommissionRow = {
  id: string;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
};

type TripPaymentLedgerRow = {
  id: string;
  trip_id: string;
  entry_type: string;
  amount: number | null;
  entry_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string | null;
};

type TripMilestoneRow = {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_completed: boolean | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ClientDocumentRow = {
  id: string;
  document_type: string | null;
  document_title: string | null;
  file_name: string | null;
  created_at: string | null;
};

type TripAttachedDocumentRow = {
  id: string;
  client_document_id: string | null;
  created_at: string | null;
};

type TripMemberClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripMemberRow = {
  id: string;
  trip_id: string;
  client_account_id: string | null;
  invite_email: string | null;
  invite_name: string | null;
  role: "owner" | "contributor" | "viewer" | string;
  invite_status: "active" | "invited" | "declined" | "removed" | string;
  invited_by_type: string | null;
  can_view_trip: boolean | null;
  can_view_shared_documents: boolean | null;
  can_join_group_messages: boolean | null;
  can_upload_own_documents: boolean | null;
  can_manage_companions: boolean | null;
  created_at: string | null;
  client_accounts: TripMemberClientAccount | TripMemberClientAccount[] | null;
};

type TripMessageThreadRow = {
  id: string;
  client_account_id: string;
  trip_id: string | null;
  subject: string;
  status: string;
  priority: string | null;
  thread_type: "private" | "trip_group" | string | null;
  admin_unread_count: number | null;
  client_unread_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
};

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getClientDisplayName(client: ClientInfo | null) {
  if (!client) return "Client not linked";

  return (
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
    "Unnamed Client"
  );
}

function getTripMemberClient(member: TripMemberRow) {
  if (Array.isArray(member.client_accounts)) {
    return member.client_accounts[0] ?? null;
  }

  return member.client_accounts ?? null;
}

function getTripMemberDisplayName(member: TripMemberRow) {
  const client = getTripMemberClient(member);

  if (client) {
    return (
      `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
      client.email ||
      "Unnamed Companion"
    );
  }

  return member.invite_name || member.invite_email || "Invited Companion";
}

function getTripMemberEmail(member: TripMemberRow) {
  const client = getTripMemberClient(member);
  return client?.email ?? member.invite_email ?? "Not provided";
}

function getTripMemberRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "owner":
      return "Owner";
    case "contributor":
      return "Contributor";
    case "viewer":
      return "Viewer";
    default:
      return role ?? "Viewer";
  }
}

function formatDate(value: string | null | undefined, fallback = "") {
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

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isTripEligibleForDeletion(trip: {
  trip_status?: string | null;
  total_paid?: number | null;
  balance_due?: number | null;
  return_date?: string | null;
}) {
  const status = (trip.trip_status ?? "").toLowerCase();
  if (["draft", "cancelled", "canceled"].includes(status)) {
    return { allowed: true, reason: "Draft or cancelled trip" };
  }

  const totalPaid = Number(trip.total_paid ?? 0);
  const balanceDue = Number(trip.balance_due ?? 0);
  if (totalPaid <= 0 && balanceDue <= 0) {
    return { allowed: true, reason: "No payment records on file" };
  }

  if (trip.return_date) {
    const returnDate = new Date(`${trip.return_date}T23:59:59`);
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    if (!Number.isNaN(returnDate.getTime()) && returnDate < tenDaysAgo) {
      return { allowed: true, reason: "More than 10 days post travel" };
    }
  }

  return { allowed: false, reason: "Active trip with payments is retained" };
}

function calculateExpectedCommission(
  fullCommissionAmount: number | null | undefined,
  agencyCommissionPercent: number | null | undefined,
) {
  const fullCommission = Number(fullCommissionAmount ?? 0);
  const percentage = Number(agencyCommissionPercent ?? 90);

  return Math.round(fullCommission * (percentage / 100) * 100) / 100;
}

function getExpectedCommission(row: CommissionRow) {
  return (
    Number(row.expected_commission_amount ?? 0) ||
    calculateExpectedCommission(
      row.full_commission_amount,
      row.agency_commission_percent,
    )
  );
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function requireAllowedValue(
  value: string,
  allowedValues: string[],
  fallback: string,
) {
  if (!value) return fallback;

  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid value submitted: ${value}`);
  }

  return value;
}

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function getUploadedFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex).toLowerCase();
}

function validateComponentDocumentFile(file: File) {
  if (file.size === 0) {
    throw new Error("Selected file is empty.");
  }

  if (file.size > MAX_COMPONENT_DOCUMENT_SIZE_BYTES) {
    throw new Error("File is too large. Maximum upload size is 15MB.");
  }

  const extension = getUploadedFileExtension(file.name);
  const mimeType = file.type || "";
  const hasAllowedExtension = allowedComponentDocumentExtensions.includes(extension);
  const hasAllowedMimeType = mimeType
    ? allowedComponentDocumentMimeTypes.includes(mimeType)
    : false;

  if (!hasAllowedExtension || (mimeType && !hasAllowedMimeType)) {
    throw new Error(
      "Invalid file type. Allowed files: PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, and XLSX.",
    );
  }
}

function buildSubmittedAddress(formData: FormData, prefix: string) {
  const addressLine1 = cleanText(formData, `${prefix}_address_line_1`);
  const addressLine2 = cleanText(formData, `${prefix}_address_line_2`);
  const city = cleanText(formData, `${prefix}_city`);
  const state = cleanText(formData, `${prefix}_state`);
  const postalCode = cleanText(formData, `${prefix}_postal_code`);
  const country = cleanText(formData, `${prefix}_country`);

  const cityStatePostal = [city, state, postalCode].filter(Boolean).join(", ");
  const formattedAddress = [addressLine1, addressLine2, cityStatePostal, country]
    .filter(Boolean)
    .join("\n");

  return {
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    formattedAddress: formattedAddress || null,
  };
}

function toMoneyNumber(value: FormDataEntryValue | null, fallback = 0) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return fallback;

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid number submitted.");
  }

  return numberValue;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function applyPaymentLedgerEntry(
  trip: { total_paid?: number | null; balance_due?: number | null },
  entryType: string,
  amount: number,
) {
  let totalPaid = Number(trip.total_paid ?? 0);
  let balanceDue = Number(trip.balance_due ?? 0);

  if (entryType === "payment") {
    totalPaid += amount;
    balanceDue -= amount;
  } else if (entryType === "refund") {
    totalPaid -= amount;
    balanceDue += amount;
  } else if (entryType === "credit") {
    balanceDue -= amount;
  } else if (entryType === "fee") {
    balanceDue += amount;
  } else if (entryType === "adjustment") {
    balanceDue += amount;
  }

  return {
    total_paid: Math.max(0, roundMoney(totalPaid)),
    balance_due: Math.max(0, roundMoney(balanceDue)),
  };
}

function reversePaymentLedgerEntry(
  trip: { total_paid?: number | null; balance_due?: number | null },
  entryType: string,
  amount: number,
) {
  let totalPaid = Number(trip.total_paid ?? 0);
  let balanceDue = Number(trip.balance_due ?? 0);

  if (entryType === "payment") {
    totalPaid -= amount;
    balanceDue += amount;
  } else if (entryType === "refund") {
    totalPaid += amount;
    balanceDue -= amount;
  } else if (entryType === "credit") {
    balanceDue += amount;
  } else if (entryType === "fee") {
    balanceDue -= amount;
  } else if (entryType === "adjustment") {
    balanceDue -= amount;
  }

  return {
    total_paid: Math.max(0, roundMoney(totalPaid)),
    balance_due: Math.max(0, roundMoney(balanceDue)),
  };
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid number submitted.");
  }

  return numberValue;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
        overflow: "visible",
        position: "relative",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "14px 16px",
          fontWeight: 800,
          background: "#f8fafc",
          color: "var(--accent-dark)",
          borderBottom: "1px solid #e2e8f0",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      >
        {title}
      </summary>

      <div
        className="card stack"
        style={{
          border: "none",
          borderRadius: 0,
          overflow: "visible",
          position: "relative",
        }}
      >
        {children}
      </div>
    </details>
  );
}

function SupplierSelect({
  name,
  label = "Saved Supplier",
  suppliers,
  defaultValue,
}: {
  name: string;
  label?: string;
  suppliers: SupplierOption[];
  defaultValue?: string | null;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="select" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">No supplier selected</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.supplier_name}
            {supplier.supplier_type ? ` — ${supplier.supplier_type}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildCommissionHref({
  tripId,
  componentId,
  supplierId,
  bookingNumber,
  commissionName,
  grossBookingAmount,
  fullCommissionAmount,
}: {
  tripId: string;
  componentId?: string | null;
  supplierId?: string | null;
  bookingNumber?: string | null;
  commissionName?: string | null;
  grossBookingAmount?: string | number | null;
  fullCommissionAmount?: string | number | null;
}) {
  const params = new URLSearchParams();

  params.set("tripId", tripId);

  if (componentId) params.set("componentId", componentId);
  if (supplierId) params.set("supplierId", supplierId);
  if (bookingNumber) params.set("bookingNumber", bookingNumber);
  if (commissionName) params.set("commissionName", commissionName);

  if (
    grossBookingAmount !== null &&
    grossBookingAmount !== undefined &&
    grossBookingAmount !== ""
  ) {
    params.set("grossBookingAmount", String(grossBookingAmount));
  }

  if (
    fullCommissionAmount !== null &&
    fullCommissionAmount !== undefined &&
    fullCommissionAmount !== ""
  ) {
    params.set("fullCommissionAmount", String(fullCommissionAmount));
  }

  return `/admin/commissions/new?${params.toString()}`;
}

function ComponentCommissionLink({
  tripId,
  componentId,
  supplierId,
  bookingNumber,
  commissionName,
  grossBookingAmount,
  fullCommissionAmount,
}: {
  tripId: string;
  componentId?: string | null;
  supplierId?: string | null;
  bookingNumber?: string | null;
  commissionName: string;
  grossBookingAmount?: string | number | null;
  fullCommissionAmount?: string | number | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        padding: "12px",
        borderRadius: 12,
        background: "#f7fbfc",
        border: "1px solid #e6f0f2",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 800 }}>Commission Tracking</p>
      </div>

      <Link
        href={buildCommissionHref({
          tripId,
          componentId,
          supplierId,
          bookingNumber,
          commissionName,
          grossBookingAmount,
          fullCommissionAmount,
        })}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--accent-dark)",
          color: "white",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Create Commission
      </Link>
    </div>
  );
}

function AiWritingToolButton({
  componentType,
  disabled = false,
}: {
  componentType: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="card stack"
      style={{
        background: "#f7fbfc",
        border: "1px solid #d9ecf2",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
          AI Writing Assistant
        </p>
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 13 }}>
          Generates client-facing descriptions and supplier terms summaries from the saved component details. Review before relying on supplier policy language.
        </p>
      </div>
      <button
        type="submit"
        formAction={generateTripComponentWriting.bind(null, componentType)}
        className="btn btn-outline"
        disabled={disabled}
        style={{
          alignSelf: "flex-start",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Generate & Save AI Copy
      </button>
      {disabled ? (
        <p style={{ margin: 0, color: "#92400e", fontSize: 12 }}>
          Save this component first, then generate copy.
        </p>
      ) : null}
    </div>
  );
}

function ComponentDocumentUploadCard({
  formId,
  componentLabel,
  componentType,
  componentId,
}: {
  formId: string;
  componentLabel: string;
  componentType: string;
  componentId?: string | null;
}) {
  const disabled = !componentId;

  return (
    <div
      className="card stack"
      style={{
        background: "#f8fafc",
        border: "1px solid #dbeafe",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
          Booking Documents
        </p>
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 13 }}>
          Upload a PDF or image confirmation to extract details directly into this {componentLabel.toLowerCase()} component.
        </p>
      </div>

      {disabled ? (
        <p style={{ margin: 0, color: "#92400e", fontSize: 13, fontWeight: 700 }}>
          Upload a PDF or image now to create this component and fill its fields from the document.
        </p>
      ) : null}

      <>
        <input type="hidden" name="component_id" value={componentId ?? ""} form={formId} />
        <input type="hidden" name="component_type" value={componentType} form={formId} />
        <label className="stack-sm">
          <span className="label">Document File</span>
          <input
            className="input"
            type="file"
            name="file"
            form={formId}
            required
            accept=".pdf,.jpg,.jpeg,.png,.webp"
          />
        </label>

        <label className="stack-sm">
          <span className="label">Visibility</span>
          <select className="select" name="visibility" defaultValue="internal" form={formId}>
            <option value="internal">Agent Only</option>
            <option value="client">Client & Agent</option>
            <option value="travel_circle">Travel Circle & Agent</option>
          </select>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            fontWeight: 800,
          }}
        >
          <input type="checkbox" name="attach_to_commission" form={formId} />
          Attach this document to the component commission
        </label>

        <ComponentDocumentUploadSubmitButton formId={formId} componentLabel={componentLabel} />
      </>
    </div>
  );
}

function TripMilestoneProgress({ milestones }: { milestones: TripMilestoneRow[] }) {
  const total = milestones.length;
  const completed = milestones.filter((milestone) => milestone.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="card stack" style={{ background: "#f7fbfc" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <span className="label">Milestone Progress</span>
          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800 }}>
            {completed} of {total} complete
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 12px",
            background: percentage === 100 ? "#ecfdf3" : "#fff7ed",
            color: percentage === 100 ? "#027a48" : "#c2410c",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {percentage}% Complete
        </span>
      </div>

      <div
        aria-label="Trip milestone progress"
        style={{
          width: "100%",
          height: 12,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: percentage + "%",
            height: "100%",
            borderRadius: 999,
            background: percentage === 100 ? "#16a34a" : "var(--accent-dark)",
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}

function MilestoneStatusBadge({ isCompleted }: { isCompleted: boolean | null }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isCompleted ? "#ecfdf3" : "#fff7ed",
        color: isCompleted ? "#027a48" : "#c2410c",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {isCompleted ? "complete" : "open"}
    </span>
  );
}

function SectionTitleWithBadge({
  title,
  badge,
  tone = "neutral",
}: {
  title: string;
  badge: string;
  tone?: "good" | "warning" | "danger" | "neutral";
}) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    danger: { background: "#fef2f2", color: "#b42318" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        width: "100%",
      }}
    >
      <span>{title}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          padding: "4px 10px",
          background: styles.background,
          color: styles.color,
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {badge}
      </span>
    </span>
  );
}

function MilestoneChecklist({ milestones }: { milestones: TripMilestoneRow[] }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {milestones.map((milestone) => (
        <div
          key={milestone.id}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "12px",
            borderRadius: 14,
            border: "1px solid #e6f0f2",
            background: milestone.is_completed ? "#f0fdf4" : "#ffffff",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: milestone.is_completed ? "#16a34a" : "#e2e8f0",
              color: milestone.is_completed ? "#ffffff" : "#64748b",
              fontWeight: 900,
            }}
          >
            {milestone.is_completed ? "✓" : "○"}
          </div>

          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <p style={{ margin: 0, fontWeight: 900 }}>{milestone.title}</p>
              <MilestoneStatusBadge isCompleted={milestone.is_completed} />
            </div>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              {milestone.description ?? "Not provided"}
            </p>
            {milestone.title === insuranceOfferedMilestoneTitle ? (
              <p style={{ margin: "5px 0 0", color: "#9a3412", fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
                Marking this complete shows the insurance accept/decline prompt on the client trip page.
              </p>
            ) : null}
            {milestone.completed_at ? (
              <p style={{ margin: "5px 0 0", color: "#667085", fontSize: 13 }}>
                Completed {formatDate(milestone.completed_at)}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            form="update-trip-milestone-status-form"
            name="milestone_id"
            value={milestone.id}
            className="btn btn-primary"
            style={{
              padding: "7px 11px",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {milestone.is_completed ? "Reopen" : "Mark Complete"}
          </button>
        </div>
      ))}
    </div>
  );
}

function StickyTripActionBar({
  clientId,
  tripId,
}: {
  clientId: string | null | undefined;
  tripId: string;
}) {
  const sectionLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 8,
        zIndex: 20,
        display: "grid",
        gap: 10,
        padding: "10px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/admin/trips" className="btn btn-primary">
            Back to Trips
          </Link>
          {clientId ? (
            <Link href={`/admin/clients/${clientId}`} className="btn btn-primary">
              Open Client
            </Link>
          ) : null}
          <Link href={`/admin/trips/${tripId}/client-documents`} className="btn btn-primary">
            Client Docs
          </Link>
          <Link href={`/admin/trips/${tripId}/documents`} className="btn btn-primary">
            Trip Docs
          </Link>
        </div>

        <button type="submit" className="btn btn-primary">
          Save Changes
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="label" style={{ marginRight: 2 }}>
          Jump to
        </span>
        <a href="#trip-timeline" style={sectionLinkStyle}>
          Checklist
        </a>
        <a href="#trip-overview" style={sectionLinkStyle}>
          Overview
        </a>
        <a href="#hotel-component" style={sectionLinkStyle}>
          Components
        </a>
        <a href="#trip-payments" style={sectionLinkStyle}>
          Payments
        </a>
        <a href="#commissions" style={sectionLinkStyle}>
          Commissions
        </a>
        <a href="#travel-companions" style={sectionLinkStyle}>
          Booking People
        </a>
        <a href="#document-readiness" style={sectionLinkStyle}>
          Documents
        </a>
        <a href="#trip-messages" style={sectionLinkStyle}>
          Messages
        </a>
        <a href="#trip-notes" style={sectionLinkStyle}>
          Notes
        </a>
      </div>
    </div>
  );
}

function CommandStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        minHeight: 98,
      }}
    >
      <span className="label">{label}</span>
      <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
        {value}
      </p>
      {helper ? (
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.4 }}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function CommandStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "warning" | "danger" | "neutral";
}) {
  const styles = {
    good: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#c2410c" },
    danger: { background: "#fef2f2", color: "#b42318" },
    neutral: { background: "#f0f7f8", color: "var(--accent-dark)" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 12px",
        background: styles.background,
        color: styles.color,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function TripMemberRoleBadge({ role }: { role: string | null | undefined }) {
  const tone = role === "owner" ? "good" : role === "contributor" ? "neutral" : "warning";

  return <CommandStatusBadge tone={tone}>{getTripMemberRoleLabel(role)}</CommandStatusBadge>;
}

function getTripMemberStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Active Companion";
    case "invited":
      return "Legacy Pending Access";
    case "declined":
      return "Declined Access";
    case "removed":
      return "Removed";
    default:
      return status ?? "Pending";
  }
}

function getTripMemberStatusTone(status: string | null | undefined): "good" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "active":
      return "good";
    case "invited":
      return "warning";
    case "declined":
    case "removed":
      return "danger";
    default:
      return "neutral";
  }
}

function getTripMemberHelperText(member: TripMemberRow) {
  if (member.role === "owner") {
    return "Main client for this booking.";
  }

  if (member.invite_status === "invited") {
    return `Access will activate when they log into Cozy Concierge using ${getTripMemberEmail(member)}. New Travel Circle additions are active immediately.`;
  }

  if (member.invite_status === "active") {
    return "Added to this booking.";
  }

  if (member.invite_status === "declined") {
    return "This access was declined. Add them again if they need access later.";
  }

  return "Booking access is managed from this section.";
}

function TripCompanionCard({ member }: { member: TripMemberRow }) {
  const isOwner = member.role === "owner";
  const isPendingInvite = member.invite_status === "invited";

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: isPendingInvite ? "1px solid #fed7aa" : "1px solid #e6f0f2",
        background: isOwner ? "#f0fdf4" : isPendingInvite ? "#fff7ed" : "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
            {getTripMemberDisplayName(member)}
          </p>
          <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>
            {getTripMemberEmail(member)}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <TripMemberRoleBadge role={member.role} />
          <CommandStatusBadge tone={getTripMemberStatusTone(member.invite_status)}>
            {getTripMemberStatusLabel(member.invite_status)}
          </CommandStatusBadge>
        </div>
      </div>

      <p style={{ margin: 0, color: isPendingInvite ? "#9a3412" : "#667085", lineHeight: 1.55 }}>
        {getTripMemberHelperText(member)}
      </p>

      {!isOwner ? (
        <button
          type="submit"
          form="remove-trip-companion-form"
          name="trip_member_id"
          value={member.id}
          className="btn btn-primary"
          style={{
            justifySelf: "start",
            padding: "7px 11px",
            fontSize: 13,
          }}
        >
          {isPendingInvite ? "Remove Pending Access" : "Remove Companion"}
        </button>
      ) : null}
    </div>
  );
}

function TripMessageSummaryCard({
  title,
  value,
  helper,
  href,
  cta,
  tone = "neutral",
}: {
  title: string;
  value: ReactNode;
  helper: ReactNode;
  href: string;
  cta: string;
  tone?: "good" | "warning" | "danger" | "neutral";
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>{title}</p>
        <CommandStatusBadge tone={tone}>{value}</CommandStatusBadge>
      </div>

      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>{helper}</p>

      <Link
        href={href}
        style={{
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--accent-dark)",
          color: "white",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

function WorkflowActionCard({
  title,
  description,
  href,
  cta = "Go",
}: {
  title: string;
  description: string;
  href: string;
  cta?: string;
}) {
  return (
    <a
      href={href}
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
          {title}
        </p>
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <span
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--accent-dark)",
          color: "white",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {cta}
      </span>
    </a>
  );
}

function SnapshotCard({
  title,
  status,
  href,
  children,
}: {
  title: string;
  status: ReactNode;
  href: string;
  children: ReactNode;
}) {
  return (
    <div
      className="card stack"
      style={{
        background: "#ffffff",
        border: "1px solid #e6f0f2",
        minHeight: 240,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div style={{ marginTop: 8 }}>{status}</div>
        </div>

        <a
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 10px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Edit
        </a>
      </div>

      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 10,
        alignItems: "baseline",
      }}
    >
      <span className="label">{label}</span>
      <span className="preserve-formatting" style={{ lineHeight: 1.45 }}>{value === null || value === undefined || value === "" ? "Not provided" : value}</span>
    </div>
  );
}

function DocumentReadinessCard({
  title,
  status,
  helper,
  tone,
  href,
  cta = "Open",
}: {
  title: string;
  status: string;
  helper: string;
  tone: "good" | "warning" | "danger" | "neutral";
  href: string;
  cta?: string;
}) {
  return (
    <a
      href={href}
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>{title}</p>
        <CommandStatusBadge tone={tone}>{status}</CommandStatusBadge>
      </div>

      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>{helper}</p>

      <span
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--accent-dark)",
          color: "white",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {cta}
      </span>
    </a>
  );
}

function SectionSaveButton({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        paddingTop: 8,
      }}
    >
      <button type="submit" name="save_section" value={label} className="btn btn-primary">
        Save {label}
      </button>
    </div>
  );
}

function getSavedSectionMessage(value: string | undefined) {
  if (!value) return null;
  if (value === "ai-itinerary") return "AI itinerary summary generated and saved.";
  if (value.startsWith("ai-")) {
    return `AI copy generated for ${value.replace("ai-", "")}.`;
  }
  if (value === "trip") return "Trip saved successfully.";
  return `${value} saved successfully.`;
}

function getSavedSectionAnchor(value: string | undefined) {
  switch (value) {
    case "Trip Overview": return "trip-overview";
    case "Proposal": return "proposal";
    case "Hotel Component": return "hotel-component";
    case "Air Component": return "air-component";
    case "Cruise Component": return "cruise-component";
    case "Transfer Component": return "transfer-component";
    case "Rental Car Component": return "rental_car-component";
    case "Activity Component": return "activity-component";
    case "Insurance Component": return "insurance-component";
    case "Notes": return "trip-notes";
    case "Commission":
    case "Commissions": return "commissions";
    case "trip": return "trip-overview";
    default:
      if (value?.startsWith("ai-")) {
        return `${value.replace("ai-", "")}-component`;
      }

      return "trip-overview";
  }
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("AI response did not include usable JSON.");
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

function stringifyForPrompt(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getGeneratedText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTripComponentType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const aliases: Record<string, string> = {
    accommodation: "hotel",
    accommodations: "hotel",
    flight: "air",
    flights: "air",
    airfare: "air",
    airline: "air",
    transportation: "transfer",
    transport: "transfer",
    ground_transportation: "transfer",
    ground_transfer: "transfer",
    excursion: "activity",
    excursions: "activity",
    tour: "activity",
    tours: "activity",
    travel_insurance: "insurance",
    protection: "insurance",
  };

  return aliases[normalized] ?? normalized;
}

function getTripComponentTypeLabel(componentType: string) {
  return tripComponentTypeLabels[componentType] ?? componentType;
}

function cleanExtractedText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function cleanExtractedArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanExtractedText(item))
    .filter(Boolean) as string[];
}

function cleanExtractedObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function compactExtractedPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function parseExtractedAmount(value: unknown) {
  const text = cleanExtractedText(value);
  if (!text) return null;

  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function combineExtractedDateAndTime(date: string | null, time: string | null) {
  if (!date) return null;
  return time ? `${date} ${time}` : date;
}

function getExtractedString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanExtractedText(record[key]);
    if (value) return value;
  }

  return null;
}

function cleanExtractedAirportCode(value: string | null) {
  if (!value) return null;
  const codeMatch = value.toUpperCase().match(/\b[A-Z]{3,4}\b/);
  return codeMatch ? codeMatch[0] : value.toUpperCase();
}

function parseExtractedRouteAirports(value: string | null) {
  if (!value) return [null, null] as const;
  const matches = value.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [];
  return [matches[0] ?? null, matches[1] ?? null] as const;
}

function normalizeExtractedFlightDirection(value: string | null, fallback: "outbound" | "return") {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("return") || normalized.includes("inbound")) return "return";
  if (normalized.includes("outbound") || normalized.includes("depart")) return "outbound";
  return fallback;
}

function combineExtractedFlightDateTime(
  datetime: string | null,
  date: string | null,
  time: string | null,
) {
  if (datetime) {
    const normalized = datetime.replace(" ", "T");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)
      ? normalized.slice(0, 16)
      : datetime;
  }

  if (!date) return null;
  if (!time) return date;

  const timeMatch = time.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  return `${date} ${timeMatch ? timeMatch[1] : time}`;
}

function getExtractedFlightSegment(
  value: unknown,
  index: number,
  fallbackDirection: "outbound" | "return",
) {
  const record = cleanExtractedObject(value);
  if (!record) return null;

  const route = getExtractedString(record, ["route", "location_or_route"]);
  const [routeDeparture, routeDestination] = parseExtractedRouteAirports(route);
  const direction = normalizeExtractedFlightDirection(
    getExtractedString(record, ["direction", "flight_direction", "segment_type"]),
    fallbackDirection,
  );
  const segmentOrderValue = Number(record.segment_order ?? record.order ?? index + 1);
  const segment = {
    direction,
    segment_order: Number.isFinite(segmentOrderValue) && segmentOrderValue > 0
      ? segmentOrderValue
      : index + 1,
    departure_airport_code: cleanExtractedAirportCode(
      getExtractedString(record, [
        "departure_airport_code",
        "origin_airport_code",
        "origin_code",
        "from_airport_code",
        "departure_airport",
        "origin",
        "from",
      ]) ?? routeDeparture,
    ),
    destination_airport_code: cleanExtractedAirportCode(
      getExtractedString(record, [
        "destination_airport_code",
        "arrival_airport_code",
        "arrival_code",
        "to_airport_code",
        "destination_airport",
        "arrival_airport",
        "destination",
        "to",
      ]) ?? routeDestination,
    ),
    departure_datetime: combineExtractedFlightDateTime(
      getExtractedString(record, ["departure_datetime", "departure_date_time"]),
      getExtractedString(record, ["departure_date"]),
      getExtractedString(record, ["departure_time"]),
    ),
    arrival_datetime: combineExtractedFlightDateTime(
      getExtractedString(record, ["arrival_datetime", "arrival_date_time"]),
      getExtractedString(record, ["arrival_date"]),
      getExtractedString(record, ["arrival_time"]),
    ),
    flight_number: getExtractedString(record, ["flight_number", "flight", "flight_no"]),
    carrier: getExtractedString(record, [
      "carrier",
      "airline",
      "airline_name",
      "operating_airline",
      "marketing_airline",
    ]),
    cabin_class: getExtractedString(record, ["cabin_class", "class", "fare_class", "rate_class"]),
    seat_assignment: getExtractedString(record, ["seat_assignment", "seat", "seats"]),
  };

  const hasSegmentValue = Object.entries(segment).some(
    ([key, segmentValue]) =>
      key !== "direction" &&
      key !== "segment_order" &&
      segmentValue !== null &&
      segmentValue !== undefined &&
      segmentValue !== "",
  );

  return hasSegmentValue ? segment : null;
}

function getExtractedFlightSegments(payload: Record<string, unknown>) {
  const rawSegments =
    (Array.isArray(payload.flight_segments) && payload.flight_segments) ||
    (Array.isArray(payload.flights) && payload.flights) ||
    (Array.isArray(payload.air_segments) && payload.air_segments) ||
    [];
  const segments = rawSegments
    .map((segment, index) =>
      getExtractedFlightSegment(segment, index, index === 0 ? "outbound" : "return"),
    )
    .filter(Boolean) as Array<NonNullable<ReturnType<typeof getExtractedFlightSegment>>>;

  if (segments.length > 0) return segments;

  const [routeDeparture, routeDestination] = parseExtractedRouteAirports(
    getExtractedString(payload, ["location_or_route", "route"]),
  );
  const outbound = getExtractedFlightSegment(
    {
      direction: "outbound",
      departure_airport_code: getExtractedString(payload, ["departure_airport_code", "origin_airport_code", "origin"]) ?? routeDeparture,
      destination_airport_code: getExtractedString(payload, ["destination_airport_code", "arrival_airport_code", "destination"]) ?? routeDestination,
      departure_date: getExtractedString(payload, ["start_date", "departure_date"]),
      departure_time: getExtractedString(payload, ["start_time", "departure_time"]),
      arrival_date: getExtractedString(payload, ["end_date", "arrival_date"]),
      arrival_time: getExtractedString(payload, ["end_time", "arrival_time"]),
      flight_number: getExtractedString(payload, ["flight_number"]),
      carrier: getExtractedString(payload, ["supplier_name", "carrier", "airline"]),
      cabin_class: getExtractedString(payload, ["room_or_cabin_or_service", "cabin_class", "rate_class"]),
    },
    0,
    "outbound",
  );
  const returnSegment = getExtractedFlightSegment(
    {
      direction: "return",
      departure_airport_code: getExtractedString(payload, ["return_departure_airport_code", "return_origin_airport_code"]),
      destination_airport_code: getExtractedString(payload, ["return_destination_airport_code", "return_arrival_airport_code"]),
      departure_datetime: getExtractedString(payload, ["return_departure_datetime"]),
      arrival_datetime: getExtractedString(payload, ["return_arrival_datetime"]),
      flight_number: getExtractedString(payload, ["return_flight_number"]),
      carrier: getExtractedString(payload, ["return_carrier", "supplier_name", "airline"]),
      cabin_class: getExtractedString(payload, ["return_cabin_class", "room_or_cabin_or_service"]),
    },
    1,
    "return",
  );

  return [outbound, returnSegment].filter(Boolean) as Array<
    NonNullable<ReturnType<typeof getExtractedFlightSegment>>
  >;
}

async function upsertExtractedFlightSegment(
  supabase: any,
  componentId: string,
  airlineLocator: string | null,
  segment: NonNullable<ReturnType<typeof getExtractedFlightSegment>>,
) {
  const segmentPayload = compactExtractedPayload({
    departure_airport_code: segment.departure_airport_code,
    destination_airport_code: segment.destination_airport_code,
    departure_datetime: segment.departure_datetime,
    arrival_datetime: segment.arrival_datetime,
    flight_number: segment.flight_number,
    carrier: segment.carrier,
    airline_locator: airlineLocator,
    cabin_class: segment.cabin_class,
    seat_assignment: segment.seat_assignment,
  });

  if (Object.keys(segmentPayload).length === 0) return;

  const { data: existingSegment, error: existingSegmentError } = await supabase
    .from("flight_segments")
    .select("id")
    .eq("air_component_id", componentId)
    .eq("direction", segment.direction)
    .eq("segment_order", segment.segment_order)
    .maybeSingle();

  if (existingSegmentError) throw new Error(existingSegmentError.message);

  if (existingSegment) {
    const { error } = await supabase
      .from("flight_segments")
      .update(segmentPayload)
      .eq("id", existingSegment.id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("flight_segments")
    .insert({
      air_component_id: componentId,
      direction: segment.direction,
      segment_order: segment.segment_order,
      ...segmentPayload,
    });

  if (error) throw new Error(error.message);
}

function formatExtractedBookingSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  const parts = [
    payload.supplier_name ? `Supplier: ${String(payload.supplier_name)}` : null,
    payload.confirmation_number
      ? `Confirmation: ${String(payload.confirmation_number)}`
      : null,
    payload.start_date || payload.end_date
      ? `Dates: ${String(payload.start_date ?? "unknown")} to ${String(payload.end_date ?? "unknown")}`
      : null,
    payload.total_amount ? `Total: ${String(payload.total_amount)}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "Booking details extracted for review.";
}

async function upsertExtractedComponentDetail(
  supabase: any,
  tableName: string,
  componentId: string,
  payload: Record<string, unknown>,
) {
  const compacted = compactExtractedPayload(payload);
  if (Object.keys(compacted).length === 0) return;

  const { data: existingDetail, error: existingDetailError } = await supabase
    .from(tableName)
    .select("component_id")
    .eq("component_id", componentId)
    .maybeSingle();

  if (existingDetailError) throw new Error(existingDetailError.message);

  if (existingDetail) {
    const { error } = await supabase
      .from(tableName)
      .update(compacted)
      .eq("component_id", componentId);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from(tableName)
    .insert({ component_id: componentId, ...compacted });

  if (error) throw new Error(error.message);
}

async function applyExtractedBookingDetailsToTripComponent(
  supabase: any,
  component: {
    id: string;
    component_type: string;
  },
  payload: any,
) {
  const componentType = component.component_type;
  const supplierName = cleanExtractedText(payload.supplier_name);
  const confirmationNumber = cleanExtractedText(payload.confirmation_number);
  const startDate = cleanExtractedText(payload.start_date);
  const endDate = cleanExtractedText(payload.end_date);
  const startTime = cleanExtractedText(payload.start_time);
  const locationOrRoute = cleanExtractedText(payload.location_or_route);
  const roomOrService = cleanExtractedText(payload.room_or_cabin_or_service);
  const totalAmount = parseExtractedAmount(payload.total_amount);
  const finalPaymentDueDate = cleanExtractedText(payload.final_payment_due_date);
  const cancellationTerms = cleanExtractedText(payload.cancellation_terms);
  const paymentTerms = cleanExtractedText(payload.payment_terms);
  const notes = cleanExtractedArray(payload.important_notes);
  const notesText = notes.join("\n") || null;
  const displayName = roomOrService || supplierName || getTripComponentTypeLabel(componentType);

  const componentPayload = compactExtractedPayload({
    display_name: displayName,
    supplier_name: supplierName,
    booking_status: confirmationNumber ? "reserved" : null,
    confirmation_number: confirmationNumber,
    total_price: totalAmount,
    final_payment_due_date: finalPaymentDueDate,
    terms_and_conditions: paymentTerms,
    cancellation_policy: cancellationTerms,
  });

  if (Object.keys(componentPayload).length > 0) {
    const { error } = await supabase
      .from("trip_components")
      .update(componentPayload)
      .eq("id", component.id);

    if (error) throw new Error(error.message);
  }

  if (componentType === "hotel") {
    await upsertExtractedComponentDetail(supabase, "hotel_components", component.id, {
      hotel_name: supplierName || displayName,
      check_in_date: startDate,
      check_out_date: endDate,
      room_category: roomOrService,
      hotel_description: notesText,
    });
  } else if (componentType === "air") {
    const flightSegments = getExtractedFlightSegments(payload);

    await upsertExtractedComponentDetail(supabase, "air_components", component.id, {
      flight_type:
        flightSegments.length > 0 && !flightSegments.some((segment) => segment.direction === "return")
          ? "one_way"
          : "round_trip",
      traveler_count: 1,
      airline_locator: confirmationNumber,
      rate_class: roomOrService,
      flight_terms_and_conditions: paymentTerms,
      flight_cancellation_policy: cancellationTerms,
    });

    for (const segment of flightSegments) {
      await upsertExtractedFlightSegment(supabase, component.id, confirmationNumber, segment);
    }
  } else if (componentType === "cruise") {
    await upsertExtractedComponentDetail(supabase, "cruise_components", component.id, {
      cruise_line: supplierName,
      sailing_date: startDate,
      return_date: endDate,
      cabin_category: roomOrService,
      departure_port: locationOrRoute,
      cruise_description: notesText,
    });
  } else if (componentType === "transfer") {
    await upsertExtractedComponentDetail(supabase, "transfer_components", component.id, {
      supplier_name: supplierName,
      pickup_datetime: combineExtractedDateAndTime(startDate, startTime),
      pickup_location: locationOrRoute,
      vehicle_type: roomOrService,
      transfer_notes: notesText,
    });
  } else if (componentType === "rental_car") {
    await upsertExtractedComponentDetail(supabase, "rental_car_components", component.id, {
      rental_company: supplierName,
      pickup_datetime: combineExtractedDateAndTime(startDate, startTime),
      return_datetime: combineExtractedDateAndTime(endDate, cleanExtractedText(payload.end_time)),
      pickup_location: locationOrRoute,
      return_location: cleanExtractedText(payload.return_location) || locationOrRoute,
      vehicle_class: roomOrService,
      rental_notes: notesText,
    });
  } else if (componentType === "activity") {
    await upsertExtractedComponentDetail(supabase, "activity_components", component.id, {
      activity_name: roomOrService || displayName,
      supplier_name: supplierName,
      activity_datetime: combineExtractedDateAndTime(startDate, startTime),
      location: locationOrRoute,
      activity_notes: notesText,
    });
  } else if (componentType === "insurance") {
    await upsertExtractedComponentDetail(supabase, "insurance_components", component.id, {
      provider_name: supplierName,
      plan_name: roomOrService,
      policy_number: confirmationNumber,
      coverage_start_date: startDate,
      coverage_end_date: endDate,
      premium_amount: totalAmount,
      insurance_notes: notesText,
    });
  }
}

async function extractBookingDetailsFromUploadedComponentDocument({
  fileName,
  mimeType,
  bytes,
}: {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Booking extraction is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const openAiFile = await toFile(
    bytes,
    fileName,
    { type: mimeType || "application/octet-stream" },
  );

  const uploadedFile = await client.files.create({
    file: openAiFile,
    purpose: "user_data",
  });

  try {
    const fileInput =
      mimeType?.startsWith("image/")
        ? {
            type: "input_image" as const,
            file_id: uploadedFile.id,
            detail: "high" as const,
          }
        : {
            type: "input_file" as const,
            file_id: uploadedFile.id,
            detail: "high" as const,
          };

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            "You extract booking details for a travel agency CRM.",
            "Only use information visible in the uploaded document.",
            "Do not guess, invent, or calculate missing values.",
            "Return only valid JSON. No markdown.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract booking details from this travel document.",
                "Return this JSON shape:",
                "{",
                '  "component_type": "hotel | air | cruise | transfer | rental_car | activity | insurance | unknown",',
                '  "supplier_name": string | null,',
                '  "confirmation_number": string | null,',
                '  "traveler_names": string[],',
                '  "start_date": "YYYY-MM-DD" | null,',
                '  "end_date": "YYYY-MM-DD" | null,',
                '  "start_time": string | null,',
                '  "end_time": string | null,',
                '  "location_or_route": string | null,',
                '  "room_or_cabin_or_service": string | null,',
                '  "flight_segments": [',
                "    {",
                '      "direction": "outbound | return",',
                '      "segment_order": number,',
                '      "carrier": string | null,',
                '      "flight_number": string | null,',
                '      "departure_airport_code": string | null,',
                '      "destination_airport_code": string | null,',
                '      "departure_date": "YYYY-MM-DD" | null,',
                '      "departure_time": string | null,',
                '      "departure_datetime": "YYYY-MM-DDTHH:mm" | null,',
                '      "arrival_date": "YYYY-MM-DD" | null,',
                '      "arrival_time": string | null,',
                '      "arrival_datetime": "YYYY-MM-DDTHH:mm" | null,',
                '      "cabin_class": string | null,',
                '      "seat_assignment": string | null',
                "    }",
                "  ],",
                '  "total_amount": string | null,',
                '  "currency": string | null,',
                '  "deposit_amount": string | null,',
                '  "final_payment_due_date": "YYYY-MM-DD" | null,',
                '  "cancellation_terms": string | null,',
                '  "payment_terms": string | null,',
                '  "important_notes": string[],',
                '  "missing_or_unclear_fields": string[]',
                "}",
              ].join("\n"),
            },
            fileInput,
          ],
        },
      ],
      temperature: 0.1,
    });

    return extractJsonObject(response.output_text || "");
  } finally {
    await client.files.delete(uploadedFile.id).catch(() => {});
  }
}

function getComponentLabel(componentType: string) {
  switch (componentType) {
    case "hotel": return "Hotel";
    case "air": return "Air";
    case "cruise": return "Cruise";
    case "transfer": return "Transfer";
    case "activity": return "Activity";
    case "insurance": return "Insurance";
    default: return componentType;
  }
}

async function generateAiJson(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. AI writing tools are not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "You are an admin-side travel writing assistant for Cozy Adventure Vacations.",
          "Write polished, client-friendly travel copy in a warm, professional voice.",
          "Do not invent official supplier rules, legal terms, prices, amenities, or guarantees.",
          "When writing terms or cancellation language, make it a clear advisor summary and include that official supplier terms, invoices, tickets, vouchers, or confirmations control.",
          "Return only valid JSON. No markdown.",
        ].join("\n"),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return extractJsonObject(response.output_text || "");
}

async function loadTripComponentContext(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tripId: string,
  componentType: string,
) {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_name, destinations, departure_date, return_date, occasion, trip_status")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found or access denied.");

  const { data: component, error: componentError } = await supabase
    .from("trip_components")
    .select("*")
    .eq("trip_id", tripId)
    .eq("component_type", componentType)
    .maybeSingle();

  if (componentError) throw new Error(componentError.message);
  if (!component) {
    throw new Error(`Save the ${getComponentLabel(componentType)} component before generating AI copy.`);
  }

  const detailTableByType: Record<string, string> = {
    hotel: "hotel_components",
    air: "air_components",
    cruise: "cruise_components",
    transfer: "transfer_components",
    rental_car: "rental_car_components",
    activity: "activity_components",
    insurance: "insurance_components",
  };

  const detailTable = detailTableByType[componentType];
  let details: Record<string, unknown> | null = null;

  if (detailTable) {
    const { data: detailData, error: detailError } = await supabase
      .from(detailTable as any)
      .select("*")
      .eq("component_id", component.id)
      .maybeSingle();

    if (detailError) throw new Error(detailError.message);
    details = (detailData ?? null) as Record<string, unknown> | null;
  }

  return { trip, component: component as Record<string, unknown>, details };
}

async function addTripCompanion(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const companionClientAccountId = String(formData.get("companion_client_account_id") ?? "").trim();
  const role = requireAllowedValue(
    String(formData.get("companion_role") ?? "viewer").trim(),
    ["viewer", "contributor"],
    "viewer",
  );

  if (!tripId) throw new Error("Missing trip ID.");
  if (!companionClientAccountId) throw new Error("Choose a registered client to add.");

  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, destinations, departure_date")
    .eq("id", tripId)
    .single();

  if (tripError || !tripRow) {
    throw new Error(tripError?.message ?? "Trip not found.");
  }

  const { data: existingClient, error: clientError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email, notify_travel_circle_invites")
    .eq("id", companionClientAccountId)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);
  if (!existingClient?.id || !existingClient.email) {
    throw new Error("The selected client account could not be found.");
  }

  if (existingClient?.id === tripRow.client_account_id) {
    return;
  }

  const rolePermissions = {
    can_view_trip: true,
    can_view_shared_documents: true,
    can_join_group_messages: true,
    can_upload_own_documents: role === "contributor",
    can_manage_companions: false,
  };

  const payload = {
    trip_id: tripId,
    client_account_id: existingClient.id,
    invite_email: existingClient.email,
    invite_name:
      `${existingClient.first_name ?? ""} ${existingClient.last_name ?? ""}`.trim() || null,
    role,
    invite_status: "active",
    invited_by_type: "admin",
    ...rolePermissions,
    updated_at: new Date().toISOString(),
  };

  let existingMemberQuery: any = supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .neq("invite_status", "removed");

  existingMemberQuery = existingMemberQuery.eq("client_account_id", existingClient.id);

  const { data: existingMember, error: existingMemberError } = await existingMemberQuery.maybeSingle();

  if (existingMemberError) throw new Error(existingMemberError.message);

  if (existingMember) {
    const { error } = await supabase
      .from("trip_members" as any)
      .update(payload)
      .eq("id", existingMember.id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("trip_members" as any).insert(payload);

    if (error) throw new Error(error.message);
  }

  if (existingClient.notify_travel_circle_invites !== false) {
    await sendTravelCircleInviteEmail({
      to: existingClient.email,
      inviteName: `${existingClient.first_name ?? ""} ${existingClient.last_name ?? ""}`.trim() || null,
      role,
      tripName: tripRow.trip_name ?? "Your Trip",
      destinations: tripRow.destinations,
      departureDate: tripRow.departure_date,
    });
  }

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function removeTripCompanion(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const tripMemberId = String(formData.get("trip_member_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!tripMemberId) throw new Error("Missing companion ID.");

  const { data: member, error: loadError } = await supabase
    .from("trip_members" as any)
    .select("id, role")
    .eq("id", tripMemberId)
    .eq("trip_id", tripId)
    .single();

  if (loadError || !member) {
    throw new Error(loadError?.message ?? "Travel companion not found.");
  }

  if (member.role === "owner") {
    throw new Error("The trip owner cannot be removed from this section.");
  }

  const { error } = await supabase
    .from("trip_members" as any)
    .update({
      invite_status: "removed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripMemberId)
    .eq("trip_id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
}

async function generateTripComponentWriting(componentTypeArg: string, formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const componentType = normalizeTripComponentType(
    componentTypeArg || String(formData.get("component_type") ?? ""),
  );

  if (!tripId) throw new Error("Missing trip ID.");
  if (!billableTripComponentTypes.includes(componentType)) {
    throw new Error("Unknown trip component type.");
  }

  const { supabase } = await requireAdmin();
  const { trip, component, details } = await loadTripComponentContext(supabase, tripId, componentType);

  const generated = await generateAiJson([
    `Generate admin-reviewed client-facing copy for this ${getComponentLabel(componentType)} trip component.`,
    "",
    "Return JSON with these exact keys:",
    "{",
    '  "summary_description": "short polished component description or null",',
    '  "room_description": "hotel room description only when relevant, otherwise null",',
    '  "terms_and_conditions": "plain-language supplier terms summary",',
    '  "cancellation_policy": "plain-language cancellation/change summary"',
    "}",
    "",
    "Trip context:",
    stringifyForPrompt(trip),
    "",
    "Component context:",
    stringifyForPrompt(component),
    "",
    "Detail context:",
    stringifyForPrompt(details),
  ].join("\n"));

  const summaryDescription = getGeneratedText(generated, "summary_description");
  const roomDescription = getGeneratedText(generated, "room_description");
  const terms = getGeneratedText(generated, "terms_and_conditions");
  const cancellation = getGeneratedText(generated, "cancellation_policy");

  const componentUpdates: Record<string, string> = {};
  if (terms) componentUpdates.terms_and_conditions = terms;
  if (cancellation) componentUpdates.cancellation_policy = cancellation;

  if (Object.keys(componentUpdates).length > 0) {
    const { error } = await supabase
      .from("trip_components")
      .update(componentUpdates)
      .eq("id", component.id as string);

    if (error) throw new Error(error.message);
  }

  if (componentType === "hotel") {
    const hotelUpdates: Record<string, string> = {};
    if (summaryDescription) hotelUpdates.hotel_description = summaryDescription;
    if (roomDescription) hotelUpdates.room_description = roomDescription;

    if (Object.keys(hotelUpdates).length > 0) {
      const { error } = await supabase
        .from("hotel_components")
        .update(hotelUpdates)
        .eq("component_id", component.id as string);

      if (error) throw new Error(error.message);
    }
  }

  if (componentType === "cruise" && summaryDescription) {
    const { error } = await supabase
      .from("cruise_components")
      .update({ cruise_description: summaryDescription })
      .eq("component_id", component.id as string);

    if (error) throw new Error(error.message);
  }

  if (componentType === "transfer" && summaryDescription) {
    const { error } = await supabase
      .from("transfer_components")
      .update({ transfer_notes: summaryDescription })
      .eq("component_id", component.id as string);

    if (error) throw new Error(error.message);
  }

  if (componentType === "activity" && summaryDescription) {
    const { error } = await supabase
      .from("activity_components")
      .update({ activity_notes: summaryDescription })
      .eq("component_id", component.id as string);

    if (error) throw new Error(error.message);
  }

  if (componentType === "insurance" && summaryDescription) {
    const { error } = await supabase
      .from("insurance_components")
      .update({ insurance_notes: summaryDescription })
      .eq("component_id", component.id as string);

    if (error) throw new Error(error.message);
  }

  if (componentType === "air") {
    const airUpdates: Record<string, string> = {};
    if (terms) airUpdates.flight_terms_and_conditions = terms;
    if (cancellation) airUpdates.flight_cancellation_policy = cancellation;

    if (Object.keys(airUpdates).length > 0) {
      const { error } = await supabase
        .from("air_components")
        .update(airUpdates)
        .eq("component_id", component.id as string);

      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/admin/trips/${tripId}?saved=ai-${componentType}#${componentType}-component`);
}

async function generateTripItinerarySummary(formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { supabase } = await requireAdmin();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_name, destinations, departure_date, return_date, occasion, trip_status")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found or access denied.");

  const componentTypes = ["hotel", "air", "cruise", "transfer", "rental_car", "activity", "insurance"];
  const componentContexts = await Promise.all(
    componentTypes.map(async (componentType) => {
      const context = await loadTripComponentContext(supabase, tripId, componentType).catch(() => null);
      return context
        ? { componentType, component: context.component, details: context.details }
        : null;
    }),
  );

  const generated = await generateAiJson([
    "Create a polished client-facing itinerary overview for this trip using saved components only.",
    "Return JSON with exact keys:",
    "{",
    '  "client_note_title": "short title",',
    '  "client_note_content": "warm itinerary overview with bullets or short sections"',
    "}",
    "",
    "Do not invent missing bookings, confirmation numbers, supplier promises, inclusions, or live details.",
    "Mention that official supplier confirmations and final travel documents control.",
    "",
    "Trip context:",
    stringifyForPrompt(trip),
    "",
    "Saved component contexts:",
    stringifyForPrompt(componentContexts.filter(Boolean)),
  ].join("\n"));

  const title = getGeneratedText(generated, "client_note_title") || "Your Trip Itinerary Overview";
  const content = getGeneratedText(generated, "client_note_content");

  if (!content) throw new Error("AI did not return an itinerary summary.");

  const { data: existingNote, error: existingNoteError } = await supabase
    .from("trip_notes")
    .select("id")
    .eq("trip_id", tripId)
    .eq("note_type", "client")
    .maybeSingle();

  if (existingNoteError) throw new Error(existingNoteError.message);

  if (existingNote) {
    const { error } = await supabase
      .from("trip_notes")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", existingNote.id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("trip_notes")
      .insert({ trip_id: tripId, note_type: "client", title, content });

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/admin/trips/${tripId}?saved=ai-itinerary#trip-notes`);
}

async function uploadComponentDocument(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const componentId = String(formData.get("component_id") ?? "").trim();
  const submittedComponentType = normalizeTripComponentType(
    String(formData.get("component_type") ?? "").trim(),
  );
  const visibility = requireAllowedValue(
    String(formData.get("visibility") ?? "internal").trim(),
    ["internal", "client", "travel_circle"],
    "internal",
  );
  const attachToCommission = formData.get("attach_to_commission") === "on";
  const file = formData.get("file");

  if (!tripId) throw new Error("Missing trip ID.");
  if (!componentId && !billableTripComponentTypes.includes(submittedComponentType)) {
    throw new Error("Select a valid component type before uploading a document.");
  }
  if (!(file instanceof File)) throw new Error("File is required.");

  validateComponentDocumentFile(file);

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !userProfile) {
    throw new Error("User profile not found.");
  }

  let component: { id: string; trip_id: string; component_type: string };

  if (componentId) {
    const { data: selectedComponent, error: componentError } = await supabase
      .from("trip_components")
      .select("id, trip_id, component_type")
      .eq("id", componentId)
      .eq("trip_id", tripId)
      .single();

    if (componentError || !selectedComponent) {
      throw new Error("Selected trip component was not found.");
    }

    component = selectedComponent as { id: string; trip_id: string; component_type: string };
  } else {
    const { data: existingComponent, error: existingComponentError } =
      await supabase
        .from("trip_components")
        .select("id, trip_id, component_type")
        .eq("trip_id", tripId)
        .eq("component_type", submittedComponentType)
        .maybeSingle();

    if (existingComponentError) throw new Error(existingComponentError.message);

    if (existingComponent) {
      component = existingComponent as { id: string; trip_id: string; component_type: string };
    } else {
      const componentLabel = getTripComponentTypeLabel(submittedComponentType);
      const { data: insertedComponent, error: insertComponentError } =
        await supabase
          .from("trip_components")
          .insert({
            trip_id: tripId,
            component_type: submittedComponentType,
            display_name: `${componentLabel} from uploaded document`,
            booking_status: "quoted",
            commission_admin_only: 0,
          })
          .select("id, trip_id, component_type")
          .single();

      if (insertComponentError || !insertedComponent) {
        throw new Error(
          insertComponentError?.message ?? `Failed to create ${componentLabel} component.`,
        );
      }

      component = insertedComponent as { id: string; trip_id: string; component_type: string };
    }
  }

  const safeFileName =
    file.name
      .trim()
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .replace(/_+/g, "_") || "document";

  const storagePath = `${tripId}/components/${component.component_type}/${crypto.randomUUID()}-${safeFileName}`;
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("trip-documents")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: insertedDocument, error: insertError } = await supabase
    .from("trip_documents")
    .insert({
      trip_id: tripId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      visibility,
      component_id: component.id,
      component_type: component.component_type,
      attach_to_commission: attachToCommission,
      uploaded_by_user_profile_id: userProfile.id,
    })
    .select("id")
    .single();

  if (insertError || !insertedDocument) {
    await supabase.storage.from("trip-documents").remove([storagePath]);
    throw new Error(insertError?.message ?? "Could not save trip document.");
  }

  const mimeType = file.type || "";
  const canExtractBookingDetails =
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/");

  if (canExtractBookingDetails) {
    await supabase
      .from("trip_documents")
      .update({
        booking_extraction_status: "processing",
        booking_extraction_summary: null,
        booking_extraction_json: null,
        booking_extracted_at: null,
      })
      .eq("id", insertedDocument.id)
      .eq("trip_id", tripId);

    try {
      const extracted = await extractBookingDetailsFromUploadedComponentDocument({
        fileName: file.name,
        mimeType: mimeType || null,
        bytes: fileBuffer,
      });
      const summary = formatExtractedBookingSummary(extracted);

      await applyExtractedBookingDetailsToTripComponent(supabase, component, extracted);

      const { error: extractionUpdateError } = await supabase
        .from("trip_documents")
        .update({
          booking_extraction_status: "extracted",
          booking_extraction_json: extracted,
          booking_extraction_summary: summary,
          booking_extracted_at: new Date().toISOString(),
        })
        .eq("id", insertedDocument.id)
        .eq("trip_id", tripId);

      if (extractionUpdateError) throw new Error(extractionUpdateError.message);
    } catch (error) {
      const extractionError =
        error instanceof Error ? error.message : "Booking extraction failed.";

      await supabase
        .from("trip_documents")
        .update({
          booking_extraction_status: "failed",
          booking_extraction_summary: extractionError,
        })
        .eq("id", insertedDocument.id)
        .eq("trip_id", tripId);

      revalidatePath(`/admin/trips/${tripId}`);
      revalidatePath(`/admin/trips/${tripId}/documents`);
      revalidatePath(`/trips/${tripId}`);
      redirect(
        `/admin/trips/${tripId}?documentUploaded=1&extracted=failed&extractionError=${encodeURIComponent(extractionError)}#${component.component_type}-component`,
      );
    }
  }

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}/documents`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/admin/trips/${tripId}?documentUploaded=1&extracted=${canExtractBookingDetails ? "1" : "0"}#${component.component_type}-component`);
}

async function updateTrip(formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const savedSection = String(formData.get("save_section") ?? "trip").trim() || "trip";
  if (!tripId) throw new Error("Missing trip ID.");

  const { supabase } = await requireAdmin();

  const { data: existingTrip, error: existingTripError } = await supabase
    .from("trips")
    .select("id, client_account_id")
    .eq("id", tripId)
    .single();

  if (existingTripError || !existingTrip) {
    throw new Error("Trip not found or access denied.");
  }

  async function getSupplierName(supplierId: string | null) {
    if (!supplierId) return null;

    const { data } = await supabase
      .from("suppliers")
      .select("supplier_name")
      .eq("id", supplierId)
      .maybeSingle();

    return data?.supplier_name ?? null;
  }

  const tripStatus = requireAllowedValue(
    String(formData.get("trip_status") ?? "draft").trim(),
    allowedTripStatuses,
    "draft",
  );
  const mainClientAccountId = String(formData.get("client_account_id") ?? "").trim();

  if (!mainClientAccountId) {
    throw new Error("Choose a main client for this booking.");
  }

  const { data: mainClient, error: mainClientError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("id", mainClientAccountId)
    .maybeSingle();

  if (mainClientError) throw new Error(mainClientError.message);
  if (!mainClient?.id || !mainClient.email) {
    throw new Error("The selected main client could not be found.");
  }

  const tripUpdates = {
    client_account_id: mainClientAccountId,
    trip_name: String(formData.get("trip_name") ?? "").trim(),
    departure_date: String(formData.get("departure_date") ?? "").trim(),
    return_date: String(formData.get("return_date") ?? "").trim(),
    destinations: String(formData.get("destinations") ?? "").trim(),
    occasion: String(formData.get("occasion") ?? "").trim() || null,
    trip_status: tripStatus,
    total_paid: toMoneyNumber(formData.get("total_paid")),
    balance_due: toMoneyNumber(formData.get("balance_due")),
    final_payment_due_date:
      String(formData.get("final_payment_due_date") ?? "").trim() || null,
    deposit_amount: toMoneyNumber(formData.get("deposit_amount")),
    deposit_due_date:
      String(formData.get("deposit_due_date") ?? "").trim() || null,
    deposit_paid: formData.get("deposit_paid") === "true",
  };

  if (!tripUpdates.trip_name) throw new Error("Trip name is required.");
  if (!tripUpdates.departure_date) throw new Error("Departure date is required.");
  if (!tripUpdates.return_date) throw new Error("Return date is required.");
  if (!tripUpdates.destinations) throw new Error("Destinations are required.");

  const { error: tripError } = await supabase
    .from("trips")
    .update(tripUpdates)
    .eq("id", tripId);

  if (tripError) throw new Error(tripError.message);

  if (mainClientAccountId !== existingTrip.client_account_id) {
    await supabase
      .from("trip_members" as any)
      .update({
        invite_status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("trip_id", tripId)
      .eq("role", "owner")
      .neq("client_account_id", mainClientAccountId);
  }

  const ownerName = `${mainClient.first_name ?? ""} ${mainClient.last_name ?? ""}`.trim() || null;
  const ownerPayload = {
    trip_id: tripId,
    client_account_id: mainClient.id,
    invite_email: mainClient.email,
    invite_name: ownerName,
    role: "owner",
    invite_status: "active",
    invited_by_type: "admin",
    can_view_trip: true,
    can_view_shared_documents: true,
    can_join_group_messages: true,
    can_upload_own_documents: true,
    can_manage_companions: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existingOwnerMember, error: existingOwnerMemberError } = await supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_account_id", mainClient.id)
    .maybeSingle();

  if (existingOwnerMemberError) throw new Error(existingOwnerMemberError.message);

  if (existingOwnerMember?.id) {
    const { error: ownerUpdateError } = await supabase
      .from("trip_members" as any)
      .update(ownerPayload)
      .eq("id", existingOwnerMember.id);

    if (ownerUpdateError) throw new Error(ownerUpdateError.message);
  } else {
    const { error: ownerInsertError } = await supabase
      .from("trip_members" as any)
      .insert(ownerPayload);

    if (ownerInsertError) throw new Error(ownerInsertError.message);
  }

  const coverImage = formData.get("cover_image") as File | null;
  if (coverImage && coverImage.size > 0) {
    if (!coverImage.type.startsWith("image/")) {
      throw new Error("Trip cover image must be an image file.");
    }

    const ext = coverImage.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const coverImagePath = `trip-covers/${tripId}/cover-${Date.now()}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from("trip-documents")
      .upload(coverImagePath, coverImage, {
        upsert: true,
        contentType: coverImage.type || "image/jpeg",
      });

    if (uploadError) throw new Error(uploadError.message);

    const { error: coverUpdateError } = await supabase
      .from("trips")
      .update({ cover_image_path: coverImagePath })
      .eq("id", tripId);

    if (coverUpdateError) throw new Error(coverUpdateError.message);
  }

  const planningFee = toMoneyNumber(formData.get("planning_fee"));

  const proposalUpdates = {
    planning_fee: planningFee,
    total_price: 0,
    proposal_title: String(formData.get("proposal_title") ?? "").trim() || null,
    proposal_welcome_text:
      String(formData.get("proposal_welcome_text") ?? "").trim() || null,
    proposal_closing_text:
      String(formData.get("proposal_closing_text") ?? "").trim() || null,
  };

  const { data: existingProposal, error: existingProposalError } = await supabase
    .from("trip_proposals")
    .select("id")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (existingProposalError) throw new Error(existingProposalError.message);

  if (existingProposal) {
    const { error: proposalError } = await supabase
      .from("trip_proposals")
      .update(proposalUpdates)
      .eq("trip_id", tripId);

    if (proposalError) throw new Error(proposalError.message);
  } else {
    const { error: insertProposalError } = await supabase
      .from("trip_proposals")
      .insert({
        trip_id: tripId,
        commission_admin_only: 0,
        proposal_highlights: [],
        ...proposalUpdates,
      });

    if (insertProposalError) throw new Error(insertProposalError.message);
  }

  async function upsertTripComponent(
    componentType: string,
    hasAnyValue: unknown,
    componentPayload: Record<string, unknown>,
    detailTable: string,
    detailPayload: Record<string, unknown>,
  ) {
    if (!hasAnyValue) return;

    const { data: existingComponent, error: existingComponentError } =
      await supabase
        .from("trip_components")
        .select("id")
        .eq("trip_id", tripId)
        .eq("component_type", componentType)
        .maybeSingle();

    if (existingComponentError) throw new Error(existingComponentError.message);

    let componentId: string;

    if (existingComponent) {
      componentId = existingComponent.id;

      const { error: componentUpdateError } = await supabase
        .from("trip_components")
        .update(componentPayload)
        .eq("id", componentId);

      if (componentUpdateError) {
        throw new Error(
          getCruisePriceWatchSchemaErrorMessage(componentUpdateError) ??
            componentUpdateError.message,
        );
      }
    } else {
      const { data: insertedComponent, error: componentInsertError } =
        await supabase
          .from("trip_components")
          .insert({
            trip_id: tripId,
            component_type: componentType,
            ...componentPayload,
          })
          .select("id")
          .single();

      if (componentInsertError || !insertedComponent) {
        throw new Error(
          getCruisePriceWatchSchemaErrorMessage(componentInsertError) ??
            componentInsertError?.message ??
            `Failed to create ${componentType} component.`,
        );
      }

      componentId = insertedComponent.id;
    }

    const { data: existingDetail, error: existingDetailError } = await supabase
      .from(detailTable)
      .select("component_id")
      .eq("component_id", componentId)
      .maybeSingle();

    if (existingDetailError) throw new Error(existingDetailError.message);

    if (existingDetail) {
      const { error: detailUpdateError } = await supabase
        .from(detailTable)
        .update(detailPayload)
        .eq("component_id", componentId);

      if (detailUpdateError) throw new Error(detailUpdateError.message);
    } else {
      const { error: detailInsertError } = await supabase
        .from(detailTable)
        .insert({
          component_id: componentId,
          ...detailPayload,
        });

      if (detailInsertError) throw new Error(detailInsertError.message);
    }
  }

  // HOTEL
  const hotelSupplierId = cleanText(formData, "hotel_supplier_id");
  const hotelSupplierName = await getSupplierName(hotelSupplierId);
  const hotelName = String(formData.get("hotel_name") ?? "").trim();
  const hotelBookingStatus = requireAllowedValue(
    String(formData.get("hotel_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const hotelTotalPrice = toMoneyNumber(formData.get("hotel_total_price"));
  const hotelDepositDueDate =
    String(formData.get("hotel_deposit_due_date") ?? "").trim() || null;
  const hotelFinalPaymentDueDate =
    String(formData.get("hotel_final_payment_due_date") ?? "").trim() || null;
  const hotelConfirmationNumber =
    String(formData.get("hotel_confirmation_number") ?? "").trim() || null;
  const hotelTerms =
    String(formData.get("hotel_terms_and_conditions") ?? "").trim() || null;
  const hotelCancellation =
    String(formData.get("hotel_cancellation_policy") ?? "").trim() || null;
  const hotelAddress = buildSubmittedAddress(formData, "hotel");

  const hotelDetailPayload = {
    hotel_name: hotelName || null,
    hotel_address: hotelAddress.formattedAddress,
    hotel_star_rating: toOptionalNumber(formData.get("hotel_star_rating")),
    check_in_date: String(formData.get("hotel_check_in_date") ?? "").trim() || null,
    check_out_date: String(formData.get("hotel_check_out_date") ?? "").trim() || null,
    room_category: String(formData.get("hotel_room_category") ?? "").trim() || null,
    nightly_rate: toOptionalNumber(formData.get("hotel_nightly_rate")),
    room_description:
      String(formData.get("hotel_room_description") ?? "").trim() || null,
    hotel_description:
      String(formData.get("hotel_description") ?? "").trim() || null,
  };

  const hasAnyHotelValue =
    hotelSupplierId ||
    hotelName ||
    hotelTotalPrice > 0 ||
    hotelAddress.addressLine1 ||
    hotelDetailPayload.check_in_date ||
    hotelDetailPayload.check_out_date ||
    hotelDetailPayload.room_category ||
    hotelConfirmationNumber;

  await upsertTripComponent(
    "hotel",
    hasAnyHotelValue,
    {
      supplier_id: hotelSupplierId,
      display_name: hotelName || hotelSupplierName || "Hotel",
      supplier_name: hotelSupplierName || hotelName || null,
      booking_status: hotelBookingStatus,
      total_price: hotelTotalPrice,
      commission_admin_only: 0,
      deposit_due_date: hotelDepositDueDate,
      final_payment_due_date: hotelFinalPaymentDueDate,
      confirmation_number: hotelConfirmationNumber,
      address_line_1: hotelAddress.addressLine1,
      address_line_2: hotelAddress.addressLine2,
      city: hotelAddress.city,
      state: hotelAddress.state,
      postal_code: hotelAddress.postalCode,
      country: hotelAddress.country,
      terms_and_conditions: hotelTerms,
      cancellation_policy: hotelCancellation,
    },
    "hotel_components",
    hotelDetailPayload,
  );

  // AIR
  const airSupplierId = cleanText(formData, "air_supplier_id");
  const airSupplierName = await getSupplierName(airSupplierId);
  const airFlightType =
    String(formData.get("air_flight_type") ?? "").trim() || "round_trip";
  const airTravelerCount = toMoneyNumber(formData.get("air_traveler_count"), 1);
  const airRateClass = String(formData.get("air_rate_class") ?? "").trim() || null;
  const airAirlineLocator =
    String(formData.get("air_airline_locator") ?? "").trim() || null;
  const airBookingStatus = requireAllowedValue(
    String(formData.get("air_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const airTotalPrice = toMoneyNumber(formData.get("air_total_price"));
  const airDepositDueDate =
    String(formData.get("air_deposit_due_date") ?? "").trim() || null;
  const airFinalPaymentDueDate =
    String(formData.get("air_final_payment_due_date") ?? "").trim() || null;
  const airConfirmationNumber =
    String(formData.get("air_confirmation_number") ?? "").trim() || null;
  const airTerms =
    String(formData.get("air_terms_and_conditions") ?? "").trim() || null;
  const airCancellation =
    String(formData.get("air_cancellation_policy") ?? "").trim() || null;

  const outboundDepartureAirport =
    String(formData.get("outbound_departure_airport_code") ?? "").trim() || null;
  const outboundDestinationAirport =
    String(formData.get("outbound_destination_airport_code") ?? "").trim() || null;
  const outboundDepartureDatetime =
    String(formData.get("outbound_departure_datetime") ?? "").trim() || null;
  const outboundArrivalDatetime =
    String(formData.get("outbound_arrival_datetime") ?? "").trim() || null;
  const outboundFlightNumber =
    String(formData.get("outbound_flight_number") ?? "").trim() || null;
  const outboundCarrier =
    String(formData.get("outbound_carrier") ?? "").trim() || null;
  const outboundCabinClass =
    String(formData.get("outbound_cabin_class") ?? "").trim() || null;
  const outboundSeatAssignment =
    String(formData.get("outbound_seat_assignment") ?? "").trim() || null;

  const returnDepartureAirport =
    String(formData.get("return_departure_airport_code") ?? "").trim() || null;
  const returnDestinationAirport =
    String(formData.get("return_destination_airport_code") ?? "").trim() || null;
  const returnDepartureDatetime =
    String(formData.get("return_departure_datetime") ?? "").trim() || null;
  const returnArrivalDatetime =
    String(formData.get("return_arrival_datetime") ?? "").trim() || null;
  const returnFlightNumber =
    String(formData.get("return_flight_number") ?? "").trim() || null;
  const returnCarrier =
    String(formData.get("return_carrier") ?? "").trim() || null;
  const returnCabinClass =
    String(formData.get("return_cabin_class") ?? "").trim() || null;
  const returnSeatAssignment =
    String(formData.get("return_seat_assignment") ?? "").trim() || null;

  const hasAnyAirValue =
    airSupplierId ||
    airTotalPrice > 0 ||
    outboundDepartureAirport ||
    outboundDestinationAirport ||
    outboundDepartureDatetime ||
    outboundArrivalDatetime ||
    outboundFlightNumber ||
    returnDepartureAirport ||
    returnDestinationAirport ||
    returnDepartureDatetime ||
    returnArrivalDatetime ||
    returnFlightNumber ||
    airAirlineLocator ||
    airConfirmationNumber;

  if (hasAnyAirValue) {
    const { data: existingAirComponent, error: existingAirComponentError } =
      await supabase
        .from("trip_components")
        .select("id")
        .eq("trip_id", tripId)
        .eq("component_type", "air")
        .maybeSingle();

    if (existingAirComponentError) throw new Error(existingAirComponentError.message);

    let componentId: string;

    const componentPayload = {
      supplier_id: airSupplierId,
      display_name: airSupplierName || "Air",
      supplier_name: airSupplierName || outboundCarrier || returnCarrier || null,
      booking_status: airBookingStatus,
      total_price: airTotalPrice,
      commission_admin_only: 0,
      deposit_due_date: airDepositDueDate,
      final_payment_due_date: airFinalPaymentDueDate,
      confirmation_number: airConfirmationNumber,
      terms_and_conditions: airTerms,
      cancellation_policy: airCancellation,
    };

    if (existingAirComponent) {
      componentId = existingAirComponent.id;

      const { error } = await supabase
        .from("trip_components")
        .update(componentPayload)
        .eq("id", componentId);

      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("trip_components")
        .insert({
          trip_id: tripId,
          component_type: "air",
          ...componentPayload,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create air component.");
      }

      componentId = data.id;
    }

    const airDetailPayload = {
      flight_type: airFlightType,
      traveler_count: airTravelerCount,
      rate_class: airRateClass,
      airline_locator: airAirlineLocator,
      flight_terms_and_conditions: airTerms,
      flight_cancellation_policy: airCancellation,
    };

    const { data: existingAirDetail, error: existingAirDetailError } =
      await supabase
        .from("air_components")
        .select("component_id")
        .eq("component_id", componentId)
        .maybeSingle();

    if (existingAirDetailError) throw new Error(existingAirDetailError.message);

    if (existingAirDetail) {
      const { error } = await supabase
        .from("air_components")
        .update(airDetailPayload)
        .eq("component_id", componentId);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("air_components")
        .insert({ component_id: componentId, ...airDetailPayload });

      if (error) throw new Error(error.message);
    }

    const upsertSegment = async (
      direction: "outbound" | "return",
      values: {
        departure_airport_code: string | null;
        destination_airport_code: string | null;
        departure_datetime: string | null;
        arrival_datetime: string | null;
        flight_number: string | null;
        carrier: string | null;
        cabin_class: string | null;
        seat_assignment: string | null;
      },
    ) => {
      const hasSegment =
        values.departure_airport_code &&
        values.destination_airport_code &&
        values.departure_datetime &&
        values.arrival_datetime;

      if (!hasSegment) return;

      const { data: existingSegment, error: existingSegmentError } = await supabase
        .from("flight_segments")
        .select("id")
        .eq("air_component_id", componentId)
        .eq("direction", direction)
        .eq("segment_order", 1)
        .maybeSingle();

      if (existingSegmentError) throw new Error(existingSegmentError.message);

      const segmentPayload = {
        air_component_id: componentId,
        direction,
        segment_order: 1,
        departure_airport_code: values.departure_airport_code,
        destination_airport_code: values.destination_airport_code,
        departure_datetime: values.departure_datetime,
        arrival_datetime: values.arrival_datetime,
        flight_number: values.flight_number,
        carrier: values.carrier,
        airline_locator: airAirlineLocator,
        cabin_class: values.cabin_class,
        seat_assignment: values.seat_assignment,
      };

      if (existingSegment) {
        const { error } = await supabase
          .from("flight_segments")
          .update(segmentPayload)
          .eq("id", existingSegment.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("flight_segments").insert(segmentPayload);
        if (error) throw new Error(error.message);
      }
    };

    await upsertSegment("outbound", {
      departure_airport_code: outboundDepartureAirport,
      destination_airport_code: outboundDestinationAirport,
      departure_datetime: outboundDepartureDatetime,
      arrival_datetime: outboundArrivalDatetime,
      flight_number: outboundFlightNumber,
      carrier: outboundCarrier,
      cabin_class: outboundCabinClass,
      seat_assignment: outboundSeatAssignment,
    });

    if (airFlightType === "round_trip") {
      await upsertSegment("return", {
        departure_airport_code: returnDepartureAirport,
        destination_airport_code: returnDestinationAirport,
        departure_datetime: returnDepartureDatetime,
        arrival_datetime: returnArrivalDatetime,
        flight_number: returnFlightNumber,
        carrier: returnCarrier,
        cabin_class: returnCabinClass,
        seat_assignment: returnSeatAssignment,
      });
    }
  }

  // CRUISE
  const cruiseSupplierId = cleanText(formData, "cruise_supplier_id");
  const cruiseSupplierName = await getSupplierName(cruiseSupplierId);
  const cruiseLine = String(formData.get("cruise_line") ?? "").trim();
  const shipName = String(formData.get("ship_name") ?? "").trim();
  const cruiseBookingStatus = requireAllowedValue(
    String(formData.get("cruise_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const cruiseTotalPrice = toMoneyNumber(formData.get("cruise_total_price"));
  const cruiseDepositDueDate =
    String(formData.get("cruise_deposit_due_date") ?? "").trim() || null;
  const cruiseFinalPaymentDueDate =
    String(formData.get("cruise_final_payment_due_date") ?? "").trim() || null;
  const cruiseConfirmationNumber =
    String(formData.get("cruise_confirmation_number") ?? "").trim() || null;
  const cruiseTerms =
    String(formData.get("cruise_terms_and_conditions") ?? "").trim() || null;
  const cruiseCancellation =
    String(formData.get("cruise_cancellation_policy") ?? "").trim() || null;
  const cruisePriceWatchEnabled =
    formData.get("cruise_price_watch_enabled") === "on";
  const cruisePriceWatchPublicUrl =
    String(formData.get("cruise_price_watch_public_url") ?? "").trim() || null;
  const cruisePriceWatchMatchCode =
    String(formData.get("cruise_price_watch_match_code") ?? "").trim() || null;

  const cruiseDetailPayload = {
    cruise_line: cruiseLine || null,
    ship_name: shipName || null,
    sailing_date: String(formData.get("cruise_sailing_date") ?? "").trim() || null,
    return_date: String(formData.get("cruise_return_date") ?? "").trim() || null,
    departure_port: String(formData.get("cruise_departure_port") ?? "").trim() || null,
    arrival_port: String(formData.get("cruise_arrival_port") ?? "").trim() || null,
    cabin_category: String(formData.get("cruise_cabin_category") ?? "").trim() || null,
    cabin_number: String(formData.get("cruise_cabin_number") ?? "").trim() || null,
    dining_seating: String(formData.get("cruise_dining_seating") ?? "").trim() || null,
    cruise_description:
      String(formData.get("cruise_description") ?? "").trim() || null,
  };

  const hasAnyCruiseValue =
    cruiseSupplierId ||
    cruiseLine ||
    shipName ||
    cruiseTotalPrice > 0 ||
    cruiseDetailPayload.sailing_date ||
    cruiseDetailPayload.return_date ||
    cruiseDetailPayload.departure_port ||
    cruiseConfirmationNumber ||
    cruisePriceWatchEnabled ||
    cruisePriceWatchPublicUrl ||
    cruisePriceWatchMatchCode;

  await upsertTripComponent(
    "cruise",
    hasAnyCruiseValue,
    {
      supplier_id: cruiseSupplierId,
      display_name: shipName || cruiseLine || cruiseSupplierName || "Cruise",
      supplier_name: cruiseSupplierName || cruiseLine || null,
      booking_status: cruiseBookingStatus,
      total_price: cruiseTotalPrice,
      commission_admin_only: 0,
      deposit_due_date: cruiseDepositDueDate,
      final_payment_due_date: cruiseFinalPaymentDueDate,
      confirmation_number: cruiseConfirmationNumber,
      terms_and_conditions: cruiseTerms,
      cancellation_policy: cruiseCancellation,
      price_watch_enabled: cruisePriceWatchEnabled,
      price_watch_public_url: cruisePriceWatchPublicUrl,
      price_watch_match_code:
        cruisePriceWatchMatchCode || cruiseDetailPayload.cabin_category,
    },
    "cruise_components",
    cruiseDetailPayload,
  );

  // TRANSFER
  const transferSupplierId = cleanText(formData, "transfer_supplier_id");
  const savedTransferSupplierName = await getSupplierName(transferSupplierId);
  const transferSupplierName = String(
    formData.get("transfer_supplier_name") ?? "",
  ).trim();
  const transferPickupDatetime =
    String(formData.get("transfer_pickup_datetime") ?? "").trim() || null;
  const transferAddress = buildSubmittedAddress(formData, "transfer");
  const transferPickupLocation =
    transferAddress.formattedAddress ||
    String(formData.get("transfer_pickup_location") ?? "").trim() ||
    null;
  const transferDropoffLocation =
    String(formData.get("transfer_dropoff_location") ?? "").trim() || null;
  const transferPassengerCountRaw = String(
    formData.get("transfer_passenger_count") ?? "",
  ).trim();
  const transferVehicleType =
    String(formData.get("transfer_vehicle_type") ?? "").trim() || null;
  const transferBookingStatus = requireAllowedValue(
    String(formData.get("transfer_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const transferTotalPrice = toMoneyNumber(formData.get("transfer_total_price"));
  const transferDepositDueDate =
    String(formData.get("transfer_deposit_due_date") ?? "").trim() || null;
  const transferFinalPaymentDueDate =
    String(formData.get("transfer_final_payment_due_date") ?? "").trim() || null;
  const transferConfirmationNumber =
    String(formData.get("transfer_confirmation_number") ?? "").trim() || null;
  const transferNotes =
    String(formData.get("transfer_notes") ?? "").trim() || null;
  const transferTerms =
    String(formData.get("transfer_terms_and_conditions") ?? "").trim() || null;
  const transferCancellation =
    String(formData.get("transfer_cancellation_policy") ?? "").trim() || null;
  const transferCommissionAmountRaw = String(
    formData.get("transfer_commission_amount") ?? "",
  ).trim();
  const transferCommissionStatus =
    String(formData.get("transfer_commission_status") ?? "").trim() || null;
  const transferCommissionNotes =
    String(formData.get("transfer_commission_notes") ?? "").trim() || null;

  const transferCommissionAmount = transferCommissionAmountRaw
    ? toMoneyNumber(formData.get("transfer_commission_amount"))
    : null;

  const transferDetailPayload = {
    supplier_name: transferSupplierName || savedTransferSupplierName || null,
    pickup_datetime: transferPickupDatetime || null,
    pickup_location: transferPickupLocation,
    dropoff_location: transferDropoffLocation,
    passenger_count: transferPassengerCountRaw
      ? Number(transferPassengerCountRaw)
      : null,
    vehicle_type: transferVehicleType,
    transfer_notes: transferNotes,
    commission_amount: transferCommissionAmount,
    commission_status: transferCommissionStatus,
    commission_notes: transferCommissionNotes,
  };

  const hasAnyTransferValue =
    transferSupplierId ||
    transferSupplierName ||
    transferTotalPrice > 0 ||
    transferPickupDatetime ||
    transferPickupLocation ||
    transferDropoffLocation ||
    transferConfirmationNumber;

  await upsertTripComponent(
    "transfer",
    hasAnyTransferValue,
    {
      supplier_id: transferSupplierId,
      display_name: transferSupplierName || savedTransferSupplierName || "Transfer",
      supplier_name: savedTransferSupplierName || transferSupplierName || null,
      booking_status: transferBookingStatus,
      total_price: transferTotalPrice,
      commission_admin_only: transferCommissionAmount ?? 0,
      deposit_due_date: transferDepositDueDate,
      final_payment_due_date: transferFinalPaymentDueDate,
      confirmation_number: transferConfirmationNumber,
      address_line_1: transferAddress.addressLine1,
      address_line_2: transferAddress.addressLine2,
      city: transferAddress.city,
      state: transferAddress.state,
      postal_code: transferAddress.postalCode,
      country: transferAddress.country,
      terms_and_conditions: transferTerms,
      cancellation_policy: transferCancellation,
    },
    "transfer_components",
    transferDetailPayload,
  );

  // RENTAL CAR
  const rentalCarSupplierId = cleanText(formData, "rental_car_supplier_id");
  const savedRentalCarSupplierName = await getSupplierName(rentalCarSupplierId);
  const rentalCompany = String(formData.get("rental_car_company") ?? "").trim();
  const rentalCarPickupDatetime =
    String(formData.get("rental_car_pickup_datetime") ?? "").trim() || null;
  const rentalCarReturnDatetime =
    String(formData.get("rental_car_return_datetime") ?? "").trim() || null;
  const rentalCarPickupLocation =
    String(formData.get("rental_car_pickup_location") ?? "").trim() || null;
  const rentalCarReturnLocation =
    String(formData.get("rental_car_return_location") ?? "").trim() || null;
  const rentalCarVehicleClass =
    String(formData.get("rental_car_vehicle_class") ?? "").trim() || null;
  const rentalCarDriverCountRaw = String(
    formData.get("rental_car_driver_count") ?? "",
  ).trim();
  const rentalCarBookingStatus = requireAllowedValue(
    String(formData.get("rental_car_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const rentalCarTotalPrice = toMoneyNumber(formData.get("rental_car_total_price"));
  const rentalCarDepositDueDate =
    String(formData.get("rental_car_deposit_due_date") ?? "").trim() || null;
  const rentalCarFinalPaymentDueDate =
    String(formData.get("rental_car_final_payment_due_date") ?? "").trim() || null;
  const rentalCarConfirmationNumber =
    String(formData.get("rental_car_confirmation_number") ?? "").trim() || null;
  const rentalCarNotes =
    String(formData.get("rental_car_notes") ?? "").trim() || null;
  const rentalCarTerms =
    String(formData.get("rental_car_terms_and_conditions") ?? "").trim() || null;
  const rentalCarCancellation =
    String(formData.get("rental_car_cancellation_policy") ?? "").trim() || null;
  const rentalCarCommissionAmountRaw = String(
    formData.get("rental_car_commission_amount") ?? "",
  ).trim();
  const rentalCarCommissionStatus =
    String(formData.get("rental_car_commission_status") ?? "").trim() || null;
  const rentalCarCommissionNotes =
    String(formData.get("rental_car_commission_notes") ?? "").trim() || null;

  const rentalCarCommissionAmount = rentalCarCommissionAmountRaw
    ? toMoneyNumber(formData.get("rental_car_commission_amount"))
    : null;

  const rentalCarDetailPayload = {
    rental_company: rentalCompany || savedRentalCarSupplierName || null,
    pickup_datetime: rentalCarPickupDatetime,
    return_datetime: rentalCarReturnDatetime,
    pickup_location: rentalCarPickupLocation,
    return_location: rentalCarReturnLocation,
    vehicle_class: rentalCarVehicleClass,
    driver_count: rentalCarDriverCountRaw ? Number(rentalCarDriverCountRaw) : null,
    rental_notes: rentalCarNotes,
    commission_amount: rentalCarCommissionAmount,
    commission_status: rentalCarCommissionStatus,
    commission_notes: rentalCarCommissionNotes,
  };

  const hasAnyRentalCarValue =
    rentalCarSupplierId ||
    rentalCompany ||
    rentalCarTotalPrice > 0 ||
    rentalCarPickupDatetime ||
    rentalCarReturnDatetime ||
    rentalCarPickupLocation ||
    rentalCarReturnLocation ||
    rentalCarConfirmationNumber;

  await upsertTripComponent(
    "rental_car",
    hasAnyRentalCarValue,
    {
      supplier_id: rentalCarSupplierId,
      display_name: rentalCompany || savedRentalCarSupplierName || "Rental Car",
      supplier_name: savedRentalCarSupplierName || rentalCompany || null,
      booking_status: rentalCarBookingStatus,
      total_price: rentalCarTotalPrice,
      commission_admin_only: rentalCarCommissionAmount ?? 0,
      deposit_due_date: rentalCarDepositDueDate,
      final_payment_due_date: rentalCarFinalPaymentDueDate,
      confirmation_number: rentalCarConfirmationNumber,
      terms_and_conditions: rentalCarTerms,
      cancellation_policy: rentalCarCancellation,
    },
    "rental_car_components",
    rentalCarDetailPayload,
  );

  // ACTIVITY
  const activitySupplierId = cleanText(formData, "activity_supplier_id");
  const savedActivitySupplierName = await getSupplierName(activitySupplierId);
  const activityName = String(formData.get("activity_name") ?? "").trim();
  const activitySupplierName = String(
    formData.get("activity_supplier_name") ?? "",
  ).trim();
  const activityDatetime =
    String(formData.get("activity_datetime") ?? "").trim() || null;
  const activityAddress = buildSubmittedAddress(formData, "activity");
  const activityLocation =
    activityAddress.formattedAddress ||
    String(formData.get("activity_location") ?? "").trim() ||
    null;
  const activityParticipantCountRaw = String(
    formData.get("activity_participant_count") ?? "",
  ).trim();
  const activityBookingStatus = requireAllowedValue(
    String(formData.get("activity_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const activityTotalPrice = toMoneyNumber(formData.get("activity_total_price"));
  const activityDepositDueDate =
    String(formData.get("activity_deposit_due_date") ?? "").trim() || null;
  const activityFinalPaymentDueDate =
    String(formData.get("activity_final_payment_due_date") ?? "").trim() || null;
  const activityConfirmationNumber =
    String(formData.get("activity_confirmation_number") ?? "").trim() || null;
  const activityNotes =
    String(formData.get("activity_notes") ?? "").trim() || null;
  const activityTerms =
    String(formData.get("activity_terms_and_conditions") ?? "").trim() || null;
  const activityCancellation =
    String(formData.get("activity_cancellation_policy") ?? "").trim() || null;
  const activityCommissionAmountRaw = String(
    formData.get("activity_commission_amount") ?? "",
  ).trim();
  const activityCommissionStatus =
    String(formData.get("activity_commission_status") ?? "").trim() || null;
  const activityCommissionNotes =
    String(formData.get("activity_commission_notes") ?? "").trim() || null;

  const activityCommissionAmount = activityCommissionAmountRaw
    ? toMoneyNumber(formData.get("activity_commission_amount"))
    : null;

  const activityDetailPayload = {
    activity_name: activityName || null,
    supplier_name: activitySupplierName || savedActivitySupplierName || null,
    activity_datetime: activityDatetime || null,
    location: activityLocation,
    participant_count: activityParticipantCountRaw
      ? Number(activityParticipantCountRaw)
      : null,
    activity_notes: activityNotes,
    commission_amount: activityCommissionAmount,
    commission_status: activityCommissionStatus,
    commission_notes: activityCommissionNotes,
  };

  const hasAnyActivityValue =
    activitySupplierId ||
    activityName ||
    activitySupplierName ||
    activityTotalPrice > 0 ||
    activityDatetime ||
    activityLocation ||
    activityConfirmationNumber;

  await upsertTripComponent(
    "activity",
    hasAnyActivityValue,
    {
      supplier_id: activitySupplierId,
      display_name: activityName || "Activity",
      supplier_name: savedActivitySupplierName || activitySupplierName || null,
      booking_status: activityBookingStatus,
      total_price: activityTotalPrice,
      commission_admin_only: activityCommissionAmount ?? 0,
      deposit_due_date: activityDepositDueDate,
      final_payment_due_date: activityFinalPaymentDueDate,
      confirmation_number: activityConfirmationNumber,
      address_line_1: activityAddress.addressLine1,
      address_line_2: activityAddress.addressLine2,
      city: activityAddress.city,
      state: activityAddress.state,
      postal_code: activityAddress.postalCode,
      country: activityAddress.country,
      terms_and_conditions: activityTerms,
      cancellation_policy: activityCancellation,
    },
    "activity_components",
    activityDetailPayload,
  );

  // INSURANCE
  const insuranceSupplierId = cleanText(formData, "insurance_supplier_id");
  const savedInsuranceSupplierName = await getSupplierName(insuranceSupplierId);
  const insuranceProviderName = String(
    formData.get("insurance_provider_name") ?? "",
  ).trim();
  const insurancePlanName = String(formData.get("insurance_plan_name") ?? "").trim();
  const insurancePolicyNumber =
    String(formData.get("insurance_policy_number") ?? "").trim() || null;
  const insuranceCoverageStartDate =
    String(formData.get("insurance_coverage_start_date") ?? "").trim() || null;
  const insuranceCoverageEndDate =
    String(formData.get("insurance_coverage_end_date") ?? "").trim() || null;
  const insuranceInsuredTravelerCountRaw = String(
    formData.get("insurance_insured_traveler_count") ?? "",
  ).trim();
  const insurancePremiumAmountRaw = String(
    formData.get("insurance_premium_amount") ?? "",
  ).trim();
  const insuranceClaimPhone =
    String(formData.get("insurance_claim_phone") ?? "").trim() || null;
  const insuranceBookingStatus = requireAllowedValue(
    String(formData.get("insurance_booking_status") ?? "").trim(),
    allowedBookingStatuses,
    "quoted",
  );
  const insuranceTerms =
    String(formData.get("insurance_terms_and_conditions") ?? "").trim() || null;
  const insuranceCancellation =
    String(formData.get("insurance_cancellation_policy") ?? "").trim() || null;
  const insuranceNotes =
    String(formData.get("insurance_notes") ?? "").trim() || null;
  const insuranceCommissionAmountRaw = String(
    formData.get("insurance_commission_amount") ?? "",
  ).trim();
  const insuranceCommissionStatus =
    String(formData.get("insurance_commission_status") ?? "").trim() || null;
  const insuranceCommissionNotes =
    String(formData.get("insurance_commission_notes") ?? "").trim() || null;

  const insurancePremiumAmount = insurancePremiumAmountRaw
    ? toMoneyNumber(formData.get("insurance_premium_amount"))
    : null;

  const insuranceCommissionAmount = insuranceCommissionAmountRaw
    ? toMoneyNumber(formData.get("insurance_commission_amount"))
    : null;

  const insuranceDetailPayload = {
    provider_name: insuranceProviderName || savedInsuranceSupplierName || null,
    plan_name: insurancePlanName || null,
    policy_number: insurancePolicyNumber,
    coverage_start_date: insuranceCoverageStartDate,
    coverage_end_date: insuranceCoverageEndDate,
    insured_traveler_count: insuranceInsuredTravelerCountRaw
      ? Number(insuranceInsuredTravelerCountRaw)
      : null,
    premium_amount: insurancePremiumAmount,
    claim_phone: insuranceClaimPhone,
    insurance_notes: insuranceNotes,
    commission_amount: insuranceCommissionAmount,
    commission_status: insuranceCommissionStatus,
    commission_notes: insuranceCommissionNotes,
  };

  const hasAnyInsuranceValue =
    insuranceSupplierId ||
    insuranceProviderName ||
    insurancePlanName ||
    Number(insurancePremiumAmount ?? 0) > 0 ||
    insurancePolicyNumber ||
    insuranceCoverageStartDate ||
    insuranceCoverageEndDate;

  await upsertTripComponent(
    "insurance",
    hasAnyInsuranceValue,
    {
      supplier_id: insuranceSupplierId,
      display_name:
        insurancePlanName ||
        insuranceProviderName ||
        savedInsuranceSupplierName ||
        "Insurance",
      supplier_name: savedInsuranceSupplierName || insuranceProviderName || null,
      booking_status: insuranceBookingStatus,
      total_price: insurancePremiumAmount ?? 0,
      commission_admin_only: insuranceCommissionAmount ?? 0,
      deposit_due_date: null,
      final_payment_due_date: null,
      confirmation_number: insurancePolicyNumber,
      terms_and_conditions: insuranceTerms,
      cancellation_policy: insuranceCancellation,
    },
    "insurance_components",
    insuranceDetailPayload,
  );

  // NOTES
  const internalNoteTitle =
    String(formData.get("internal_note_title") ?? "").trim() || null;
  const internalNoteContent =
    String(formData.get("internal_note_content") ?? "").trim() || null;
  const clientNoteTitle =
    String(formData.get("client_note_title") ?? "").trim() || null;
  const clientNoteContent =
    String(formData.get("client_note_content") ?? "").trim() || null;
  const clientReminderTitle =
    String(formData.get("client_reminder_title") ?? "").trim() || null;
  const clientReminderContent =
    String(formData.get("client_reminder_content") ?? "").trim() || null;

  async function upsertTripNote(
    noteType: "internal" | "client" | "client_reminder",
    title: string | null,
    content: string | null,
  ) {
    const { data: existingNote, error: existingNoteError } = await supabase
      .from("trip_notes")
      .select("id")
      .eq("trip_id", tripId)
      .eq("note_type", noteType)
      .maybeSingle();

    if (existingNoteError) throw new Error(existingNoteError.message);

    const hasContent = title || content;
    if (!hasContent) return;

    if (existingNote) {
      const { error } = await supabase
        .from("trip_notes")
        .update({ title, content })
        .eq("id", existingNote.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("trip_notes").insert({
        trip_id: tripId,
        note_type: noteType,
        title,
        content,
      });

      if (error) throw new Error(error.message);
    }
  }

  await upsertTripNote("internal", internalNoteTitle, internalNoteContent);
  await upsertTripNote("client", clientNoteTitle, clientNoteContent);
  await upsertTripNote("client_reminder", clientReminderTitle, clientReminderContent);

  const { data: savedTripComponents, error: savedTripComponentsError } = await supabase
    .from("trip_components")
    .select("component_type, total_price")
    .eq("trip_id", tripId)
    .in("component_type", billableTripComponentTypes);

  if (savedTripComponentsError) throw new Error(savedTripComponentsError.message);

  const componentTotal = (savedTripComponents ?? []).reduce(
    (sum, component) => sum + Number(component.total_price ?? 0),
    0,
  );
  const calculatedTripTotal = roundMoney(componentTotal + planningFee);

  const { data: savedTripLedgerEntries, error: savedTripLedgerError } = await supabase
    .from("trip_payment_ledger" as any)
    .select("entry_type, amount")
    .eq("trip_id", tripId);

  if (savedTripLedgerError) throw new Error(savedTripLedgerError.message);

  const ledgerBalanceAdjustment = (savedTripLedgerEntries ?? []).reduce(
    (sum, entry) => {
      const amount = Number(entry.amount ?? 0);
      if (entry.entry_type === "credit") return sum - amount;
      if (entry.entry_type === "fee" || entry.entry_type === "adjustment") return sum + amount;
      return sum;
    },
    0,
  );
  const ledgerTotalPaid = (savedTripLedgerEntries ?? []).reduce(
    (sum, entry) => {
      const amount = Number(entry.amount ?? 0);
      if (entry.entry_type === "payment") return sum + amount;
      if (entry.entry_type === "refund") return sum - amount;
      return sum;
    },
    0,
  );
  const totalPaidForBalance =
    (savedTripLedgerEntries ?? []).length > 0
      ? Math.max(0, roundMoney(ledgerTotalPaid))
      : Number(tripUpdates.total_paid ?? 0);
  const recalculatedBalanceDue = Math.max(
    0,
    roundMoney(calculatedTripTotal - totalPaidForBalance + ledgerBalanceAdjustment),
  );

  const { error: proposalTotalError } = await supabase
    .from("trip_proposals")
    .update({ total_price: calculatedTripTotal })
    .eq("trip_id", tripId);

  if (proposalTotalError) throw new Error(proposalTotalError.message);

  const { error: tripPricingError } = await supabase
    .from("trips")
    .update({
      total_paid: totalPaidForBalance,
      balance_due: recalculatedBalanceDue,
    })
    .eq("id", tripId);

  if (tripPricingError) throw new Error(tripPricingError.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/admin/trips");
  redirect(`/admin/trips/${tripId}?saved=${encodeURIComponent(savedSection)}#${getSavedSectionAnchor(savedSection)}`);
}

async function markTripCommissionReceived(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const commissionId = String(formData.get("commission_id") ?? "").trim();
  const tripId = String(formData.get("trip_id") ?? "").trim();

  if (!commissionId) throw new Error("Missing commission ID.");
  if (!tripId) throw new Error("Missing trip ID.");

  const { data: commission, error: loadError } = await supabase
    .from("commissions")
    .select(
      "id, trip_id, full_commission_amount, agency_commission_percent, expected_commission_amount",
    )
    .eq("id", commissionId)
    .eq("trip_id", tripId)
    .single();

  if (loadError || !commission) {
    throw new Error(loadError?.message ?? "Commission not found for this trip.");
  }

  const calculatedExpectedAmount = calculateExpectedCommission(
    commission.full_commission_amount,
    commission.agency_commission_percent,
  );

  const receivedAmount =
    Number(commission.expected_commission_amount ?? 0) || calculatedExpectedAmount;

  const { error } = await supabase
    .from("commissions")
    .update({
      commission_status: "received",
      expected_commission_amount: receivedAmount,
      received_commission_amount: receivedAmount,
      received_payment_date: todayDateString(),
    })
    .eq("id", commissionId)
    .eq("trip_id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/admin/commissions/${commissionId}`);
  revalidatePath("/admin/commissions");
}

async function updateTripMilestoneStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const milestoneId = String(formData.get("milestone_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!milestoneId) throw new Error("Missing milestone ID.");

  const { data: milestone, error: loadError } = await supabase
    .from("trip_milestones" as any)
    .select("id, is_completed")
    .eq("id", milestoneId)
    .eq("trip_id", tripId)
    .single();

  if (loadError || !milestone) {
    throw new Error(loadError?.message ?? "Milestone not found for this trip.");
  }

  const isCompleted = !milestone.is_completed;

  const { error } = await supabase
    .from("trip_milestones" as any)
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", milestoneId)
    .eq("trip_id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/trips/" + tripId);
  revalidatePath("/trips/" + tripId);
  revalidatePath("/admin/trips");
}

async function softDeleteTripFromDetail(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_status, total_paid, balance_due, return_date, deleted_at")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");
  if (trip.deleted_at) throw new Error("Trip is already deleted.");

  const eligibility = isTripEligibleForDeletion(trip);
  if (!eligibility.allowed) throw new Error(`Cannot delete this trip: ${eligibility.reason}`);

  const { error } = await supabase
    .from("trips")
    .update({
      deleted_at: new Date().toISOString(),
      deletion_requested_at: null,
      deletion_requested_by: null,
    })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
}

async function deleteRowsByIds(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  table: string,
  column: string,
  ids: string[],
) {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from(table as any)
    .delete()
    .in(column, ids);

  if (error) throw new Error(error.message);
}

async function hardDeleteTripRecords(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tripId: string,
) {
  const tripIds = [tripId];

  const { data: componentRows, error: componentError } = await supabase
    .from("trip_components" as any)
    .select("id")
    .eq("trip_id", tripId);

  if (componentError) throw new Error(componentError.message);

  const componentIds = (componentRows ?? [])
    .map((component: { id?: string | null }) => component.id)
    .filter((id): id is string => Boolean(id));

  if (componentIds.length > 0) {
    await deleteRowsByIds(supabase, "flight_segments", "air_component_id", componentIds);
    await deleteRowsByIds(supabase, "air_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "hotel_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "cruise_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "transfer_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "rental_car_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "activity_components", "component_id", componentIds);
    await deleteRowsByIds(supabase, "insurance_components", "component_id", componentIds);
  }

  const { data: tripDocuments } = await supabase
    .from("trip_documents" as any)
    .select("storage_path")
    .eq("trip_id", tripId);

  const tripDocumentPaths = (tripDocuments ?? [])
    .map((document: { storage_path?: string | null }) => document.storage_path)
    .filter((path): path is string => Boolean(path));

  if (tripDocumentPaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("trip-documents")
      .remove(tripDocumentPaths);

    if (storageError) throw new Error(storageError.message);
  }

  await deleteRowsByIds(supabase, "messages", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "message_threads", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_member_invites", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_members", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "payment_requests", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "email_automation_log", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_payment_ledger", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_milestones", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_notes", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_client_documents", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_documents", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "commissions", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trip_components", "trip_id", tripIds);
  await deleteRowsByIds(supabase, "trips", "id", tripIds);
}

async function overrideHardDeleteTripFromDetail(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  const confirmation = String(formData.get("override_confirmation") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (confirmation !== "OVERRIDE DELETE TRIP") {
    throw new Error("Override delete requires typing OVERRIDE DELETE TRIP.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error("Trip not found.");

  await hardDeleteTripRecords(supabase, tripId);

  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
  redirect("/admin/trips?deleted=permanent");
}

async function addTripPaymentLedgerEntry(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  const entryType = requireAllowedValue(
    String(formData.get("entry_type") ?? "payment").trim(),
    ["payment", "refund", "credit", "fee", "adjustment"],
    "payment",
  );
  const amount = toMoneyNumber(formData.get("amount"));
  const entryDate = String(formData.get("entry_date") ?? "").trim() || todayDateString();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || null;
  const referenceNumber = String(formData.get("reference_number") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!tripId) throw new Error("Missing trip ID.");
  if (amount === 0) throw new Error("Payment ledger amount cannot be zero.");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, total_paid, balance_due")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error(tripError?.message ?? "Trip not found.");

  const { error: insertError } = await supabase
    .from("trip_payment_ledger" as any)
    .insert({
      trip_id: tripId,
      entry_type: entryType,
      amount,
      entry_date: entryDate,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      notes,
    });

  if (insertError) throw new Error(insertError.message);

  const updatedTotals = applyPaymentLedgerEntry(trip, entryType, amount);
  const { error: updateError } = await supabase
    .from("trips")
    .update(updatedTotals)
    .eq("id", tripId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
}

async function deleteTripPaymentLedgerEntry(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  const ledgerId = String(formData.get("ledger_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!ledgerId) throw new Error("Missing payment ledger entry ID.");

  const { data: entry, error: entryError } = await supabase
    .from("trip_payment_ledger" as any)
    .select("id, entry_type, amount")
    .eq("id", ledgerId)
    .eq("trip_id", tripId)
    .single();

  if (entryError || !entry) throw new Error(entryError?.message ?? "Payment ledger entry not found.");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, total_paid, balance_due")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error(tripError?.message ?? "Trip not found.");

  const { error: deleteError } = await supabase
    .from("trip_payment_ledger" as any)
    .delete()
    .eq("id", ledgerId)
    .eq("trip_id", tripId);

  if (deleteError) throw new Error(deleteError.message);

  const updatedTotals = reversePaymentLedgerEntry(trip, entry.entry_type, Number(entry.amount ?? 0));
  const { error: updateError } = await supabase
    .from("trips")
    .update(updatedTotals)
    .eq("id", tripId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
}

async function dismissTripDeletionRequestFromDetail(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { error } = await supabase
    .from("trips")
    .update({ deletion_requested_at: null, deletion_requested_by: null })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
}

async function restoreTripFromDetail(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { error } = await supabase
    .from("trips")
    .update({ deleted_at: null })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/dashboard");
}

export default async function AdminTripEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{
    saved?: string;
    documentUploaded?: string;
    extracted?: string;
    extractionError?: string;
  }>;
}) {
  const { tripId } = await params;
  const { saved, documentUploaded, extracted, extractionError } = await searchParams;
  const savedMessage = getSavedSectionMessage(saved);
  const { supabase } = await requireAdmin();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Editor" subtitle="We could not load this trip.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(tripError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const { data: clientAccount, error: clientAccountError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .eq("id", trip.client_account_id)
    .maybeSingle();

  if (clientAccountError) {
    return (
      <PageShell title="Trip Editor" subtitle="There was a problem loading the client.">
        <div className="card">
          <p>
            <strong>Error loading client:</strong>
          </p>
          <pre>{JSON.stringify(clientAccountError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientInfo = clientAccount as ClientInfo | null;

  const { data: clientOptions } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  const clientSelectOptions = (clientOptions ?? []) as ClientOption[];
  const registeredClientOptions = clientSelectOptions.filter((client) => client.id !== trip.client_account_id);

  const { data: proposal } = await supabase
    .from("trip_proposals")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_type")
    .order("supplier_name", { ascending: true });

  const supplierRows = (suppliers ?? []) as SupplierOption[];

  const { data: hotelLibrary } = await supabase
    .from("hotel_library")
    .select("id, hotel_name, address_line_1, address_line_2, city, state, postal_code, country, phone, website_url, google_place_id, google_maps_url")
    .order("hotel_name", { ascending: true });

  const savedHotelRows = (hotelLibrary ?? []) as HotelLibraryOption[];

  const loadComponent = async (type: string, detailTable: string) => {
    const { data: component } = await supabase
      .from("trip_components")
      .select("*")
      .eq("trip_id", tripId)
      .eq("component_type", type)
      .maybeSingle();

    let details: any = null;

    if (component) {
      const { data } = await supabase
        .from(detailTable)
        .select("*")
        .eq("component_id", component.id)
        .maybeSingle();

      details = data;
    }

    return { component, details };
  };

  const hotel = await loadComponent("hotel", "hotel_components");
  const air = await loadComponent("air", "air_components");
  const cruise = await loadComponent("cruise", "cruise_components");
  const transfer = await loadComponent("transfer", "transfer_components");
  const rentalCar = await loadComponent("rental_car", "rental_car_components");
  const activity = await loadComponent("activity", "activity_components");
  const insurance = await loadComponent("insurance", "insurance_components");

  let outboundSegment: any = null;
  let returnSegment: any = null;

  if (air.component) {
    const { data: loadedSegments } = await supabase
      .from("flight_segments")
      .select("*")
      .eq("air_component_id", air.component.id)
      .order("segment_order", { ascending: true });

    outboundSegment =
      loadedSegments?.find((segment) => segment.direction === "outbound") ?? null;
    returnSegment =
      loadedSegments?.find((segment) => segment.direction === "return") ?? null;
  }

  const { data: tripNotes } = await supabase
    .from("trip_notes")
    .select("*")
    .eq("trip_id", tripId);

  const internalNote =
    tripNotes?.find((note) => note.note_type === "internal") ?? null;
  const clientNote = tripNotes?.find((note) => note.note_type === "client") ?? null;
  const clientReminder =
    tripNotes?.find((note) => note.note_type === "client_reminder") ?? null;
  const insuranceWaiverNote =
    tripNotes?.find((note) => note.note_type === "insurance_waiver") ?? null;

  const { data: tripCommissions, error: tripCommissionsError } = await supabase
    .from("commissions")
    .select(
      "id, commission_name, booking_number, supplier_name_snapshot, full_commission_amount, agency_commission_percent, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date",
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const { data: tripPaymentLedger, error: tripPaymentLedgerError } = await supabase
    .from("trip_payment_ledger" as any)
    .select("id, trip_id, entry_type, amount, entry_date, payment_method, reference_number, notes, created_at")
    .eq("trip_id", tripId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: clientDocuments, error: clientDocumentsError } = await supabase
    .from("client_documents")
    .select("id, document_type, document_title, file_name, created_at")
    .eq("client_account_id", trip.client_account_id)
    .order("created_at", { ascending: false });

  const { data: attachedTripDocuments, error: attachedTripDocumentsError } = await supabase
    .from("trip_client_documents" as any)
    .select("id, client_document_id, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const { data: tripDocuments, error: tripDocumentsError } = await supabase
    .from("trip_documents")
    .select("id, file_name, component_type, visibility, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const { data: tripMembers, error: tripMembersError } = await supabase
    .from("trip_members" as any)
    .select("id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, invited_by_type, can_view_trip, can_view_shared_documents, can_join_group_messages, can_upload_own_documents, can_manage_companions, created_at, client_accounts!trip_members_client_account_id_fkey(id, first_name, last_name, email)")
    .eq("trip_id", tripId)
    .neq("invite_status", "removed")
    .order("created_at", { ascending: true });

  const { data: tripMessageThreads, error: tripMessageThreadsError } = await supabase
    .from("message_threads" as any)
    .select("id, client_account_id, trip_id, subject, status, priority, thread_type, admin_unread_count, client_unread_count, last_message_at, created_at")
    .eq("trip_id", tripId)
    .order("last_message_at", { ascending: false });

  const { data: existingMilestones, error: tripMilestonesError } = await supabase
    .from("trip_milestones" as any)
    .select("id, trip_id, title, description, sort_order, is_completed, completed_at, created_at, updated_at")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  let milestoneRows = (existingMilestones ?? []) as TripMilestoneRow[];

  if (!tripMilestonesError && milestoneRows.length === 0) {
    const { data: createdMilestones, error: createMilestonesError } = await supabase
      .from("trip_milestones" as any)
      .insert(
        defaultTripMilestones.map((milestone, index) => ({
          trip_id: tripId,
          title: milestone.title,
          description: milestone.description,
          sort_order: index + 1,
          is_completed: index <= 1,
          completed_at: index <= 1 ? new Date().toISOString() : null,
        })),
      )
      .select("id, trip_id, title, description, sort_order, is_completed, completed_at, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (!createMilestonesError) {
      milestoneRows = (createdMilestones ?? []) as TripMilestoneRow[];
    }
  }

  const commissionRows = (tripCommissions ?? []) as CommissionRow[];
  const tripPaymentLedgerRows = (tripPaymentLedger ?? []) as TripPaymentLedgerRow[];
  const clientDocumentRows = (clientDocuments ?? []) as ClientDocumentRow[];
  const attachedTripDocumentRows = (attachedTripDocuments ?? []) as TripAttachedDocumentRow[];
  const tripDocumentRows = (tripDocuments ?? []) as any[];
  const tripMemberRows = (tripMembers ?? []) as TripMemberRow[];
  const activeTripMemberRows = tripMemberRows.filter(
    (member) => member.invite_status !== "removed",
  );
  const ownerTripMembers = activeTripMemberRows.filter((member) => member.role === "owner");
  const invitedTripMembers = activeTripMemberRows.filter((member) => member.invite_status === "invited");
  const activeCompanionRows = activeTripMemberRows.filter((member) => member.role !== "owner");

  const tripMessageThreadRows = (tripMessageThreads ?? []) as TripMessageThreadRow[];
  const privateTripMessageThreads = tripMessageThreadRows.filter(
    (thread) => thread.thread_type !== "trip_group",
  );
  const tripMessageUnreadTotal = tripMessageThreadRows.reduce(
    (total, thread) => total + Number(thread.admin_unread_count ?? 0),
    0,
  );
  const mostRecentTripMessageThread = tripMessageThreadRows[0] ?? null;
  const mostRecentPrivateTripMessageThread = privateTripMessageThreads[0] ?? null;
  const tripMessagesHref = mostRecentTripMessageThread
    ? `/admin/messages?threadId=${mostRecentTripMessageThread.id}`
    : "/admin/messages";
  const privateTripMessagesHref = mostRecentPrivateTripMessageThread
    ? `/admin/messages?threadId=${mostRecentPrivateTripMessageThread.id}&type=private`
    : "/admin/messages?type=private";

  const hasPassportDocument = clientDocumentRows.some(
    (document) => document.document_type === "passport",
  );
  const hasInsuranceDocument = clientDocumentRows.some(
    (document) => document.document_type === "insurance",
  );
  const hasInsuranceTripDocument = tripDocumentRows.some(
    (document) => document.component_type === "insurance",
  );
  const hasAnsweredInsurance =
    hasInsuranceDecisionBeenAnswered(trip.insurance_decision, trip.insurance_decision_at) ||
    Boolean(insuranceWaiverNote);
  const hasMinorTravelDocument = clientDocumentRows.some(
    (document) =>
      document.document_type === "minor_permission" ||
      document.document_type === "minor_international_consent",
  );

  const commissionFullTotal = commissionRows.reduce(
    (sum, commission) => sum + Number(commission.full_commission_amount ?? 0),
    0,
  );

  const commissionExpectedTotal = commissionRows.reduce(
    (sum, commission) => sum + getExpectedCommission(commission),
    0,
  );

  const commissionReceivedTotal = commissionRows.reduce(
    (sum, commission) => sum + Number(commission.received_commission_amount ?? 0),
    0,
  );

  const commissionOutstandingTotal =
    commissionExpectedTotal - commissionReceivedTotal;

  const milestoneTotal = milestoneRows.length;
  const milestoneCompleted = milestoneRows.filter(
    (milestone) => milestone.is_completed,
  ).length;
  const milestonePercent = milestoneTotal
    ? Math.round((milestoneCompleted / milestoneTotal) * 100)
    : 0;

  const tripComponentSummaries = [
    { label: "Hotel", component: hotel.component },
    { label: "Air", component: air.component },
    { label: "Cruise", component: cruise.component },
    { label: "Transfer", component: transfer.component },
    { label: "Activity", component: activity.component },
    { label: "Insurance", component: insurance.component },
  ];

  const activeTripComponents = tripComponentSummaries.filter(
    (summary) => summary.component,
  );
  const componentPriceTotal = activeTripComponents.reduce(
    (sum, summary) => sum + Number(summary.component?.total_price ?? 0),
    0,
  );
  const proposalPlanningFee = Number(proposal?.planning_fee ?? 0);
  const calculatedProposalTotal = roundMoney(componentPriceTotal + proposalPlanningFee);
  const componentsWithConfirmations = activeTripComponents.filter(
    (summary) => summary.component?.confirmation_number,
  );
  const balanceDue = Number(trip.balance_due ?? 0);
  const totalPaid = Number(trip.total_paid ?? 0);

  const clientDocumentsCollectedMilestone = milestoneRows.find(
    (milestone) => milestone.title === "Client documents collected",
  );
  const travelDocumentsSentMilestone = milestoneRows.find(
    (milestone) => milestone.title === "Travel documents sent",
  );

  const documentReadinessItems = [
    {
      title: "Client document library",
      status: clientDocumentsError ? "Review" : `${clientDocumentRows.length} file${clientDocumentRows.length === 1 ? "" : "s"}`,
      helper: clientDocumentsError
        ? "Client documents could not be checked from this page."
        : clientDocumentRows.length > 0
          ? "Client has uploaded documents available for review."
          : "No client documents are currently on file.",
      tone: clientDocumentsError ? "warning" : clientDocumentRows.length > 0 ? "good" : "warning",
      href: clientInfo?.id ? `/admin/clients/${clientInfo.id}/documents` : "#trip-snapshot",
      cta: "View Client Docs",
    },
    {
      title: "Trip document files",
      status: tripDocumentsError ? "Review" : `${tripDocumentRows.length} file${tripDocumentRows.length === 1 ? "" : "s"}`,
      helper: tripDocumentsError
        ? "Trip documents could not be checked from this page."
        : tripDocumentRows.length > 0
          ? "Supplier confirmations, vouchers, waivers, and uploaded trip files are available."
          : "No trip-level documents have been uploaded yet.",
      tone: tripDocumentsError ? "warning" : tripDocumentRows.length > 0 ? "good" : "warning",
      href: `/admin/trips/${trip.id}/documents`,
      cta: "Open Trip Docs",
    },
    {
      title: "Attached to this trip",
      status: attachedTripDocumentsError ? "Review" : `${attachedTripDocumentRows.length} attached`,
      helper: attachedTripDocumentsError
        ? "Trip document attachments could not be checked from this page."
        : attachedTripDocumentRows.length > 0
          ? "Documents have been attached directly to this trip."
          : "No client documents are attached to this trip yet.",
      tone: attachedTripDocumentsError ? "warning" : attachedTripDocumentRows.length > 0 ? "good" : "warning",
      href: `/admin/trips/${trip.id}/client-documents`,
      cta: "Attach Client Docs",
    },
    {
      title: "Passport document",
      status: hasPassportDocument ? "On file" : "Missing",
      helper: hasPassportDocument
        ? "At least one passport document is available in the client document library."
        : "No passport document was found in the client document library.",
      tone: hasPassportDocument ? "good" : "warning",
      href: clientInfo?.id ? `/admin/clients/${clientInfo.id}/documents` : "#trip-snapshot",
      cta: "Review Docs",
    },
    {
      title: "Insurance documentation",
      status: insurance.component || hasInsuranceDocument || hasInsuranceTripDocument || hasAnsweredInsurance ? "Started" : "Missing",
      helper: insurance.component
        ? "Insurance details have been added as a trip component."
        : hasInsuranceDocument
          ? "Insurance document exists in the client document library."
          : hasInsuranceTripDocument
            ? "Insurance waiver or insurance document is attached to this trip."
            : hasAnsweredInsurance
              ? "The client has answered the travel insurance waiver."
              : "No insurance component or insurance document is currently attached.",
      tone: insurance.component || hasInsuranceDocument || hasInsuranceTripDocument || hasAnsweredInsurance ? "good" : "warning",
      href: insurance.component
        ? "#insurance-component"
        : hasInsuranceTripDocument
          ? `/admin/trips/${trip.id}/documents`
          : clientInfo?.id
            ? `/admin/clients/${clientInfo.id}/documents`
            : "#insurance-component",
      cta: insurance.component ? "Open Insurance" : "Review Docs",
    },
    {
      title: "Minor travel consent",
      status: hasMinorTravelDocument ? "On file" : "Optional",
      helper: hasMinorTravelDocument
        ? "A minor travel consent or permission document is available."
        : "Use this only when minors, guardians, or international consent forms apply.",
      tone: hasMinorTravelDocument ? "good" : "neutral",
      href: clientInfo?.id ? `/admin/clients/${clientInfo.id}/documents` : "#trip-snapshot",
      cta: "Review Docs",
    },
    {
      title: "Document milestones",
      status:
        clientDocumentsCollectedMilestone?.is_completed && travelDocumentsSentMilestone?.is_completed
          ? "Complete"
          : "Open",
      helper:
        clientDocumentsCollectedMilestone?.is_completed && travelDocumentsSentMilestone?.is_completed
          ? "Document collection and final travel document milestones are marked complete."
          : "Use the timeline to mark document collection and final travel documents when ready.",
      tone:
        clientDocumentsCollectedMilestone?.is_completed && travelDocumentsSentMilestone?.is_completed
          ? "good"
          : "warning",
      href: "#trip-timeline",
      cta: "Open Timeline",
    },
  ] as Array<{
    title: string;
    status: string;
    helper: string;
    tone: "good" | "warning" | "danger" | "neutral";
    href: string;
    cta: string;
  }>;

  const needsAttentionItems = [
    !trip.final_payment_due_date && balanceDue > 0
      ? "Final payment due date is missing while a balance is still open."
      : null,
    balanceDue > 0
      ? `Balance due is still ${formatMoney(balanceDue)}.`
      : null,
    !insurance.component
      ? "Travel insurance has not been added to this trip yet."
      : null,
    activeTripComponents.length === 0
      ? "No trip components have been added yet."
      : null,
    activeTripComponents.length > 0 && componentsWithConfirmations.length < activeTripComponents.length
      ? "One or more trip components are missing confirmation numbers."
      : null,
    milestoneTotal === 0
      ? "Trip milestone checklist has not been created yet."
      : null,
    commissionOutstandingTotal > 0
      ? `Outstanding commission balance is ${formatMoney(commissionOutstandingTotal)}.`
      : null,
    !clientDocumentsError && clientDocumentRows.length === 0
      ? "No client documents are currently on file."
      : null,
    !attachedTripDocumentsError && attachedTripDocumentRows.length === 0
      ? "No client documents are attached to this trip yet."
      : null,
    clientDocumentsCollectedMilestone && !clientDocumentsCollectedMilestone.is_completed
      ? "Client documents collected milestone is still open."
      : null,
    travelDocumentsSentMilestone && !travelDocumentsSentMilestone.is_completed
      ? "Travel documents sent milestone is still open."
      : null,
    !clientReminder
      ? "No client-facing trip reminder has been added yet."
      : null,
  ].filter(Boolean) as string[];

  const nextBestActions = [
    milestonePercent < 100
      ? {
          title: "Continue the timeline",
          description: "Review the milestone checklist and mark the next completed trip task.",
          href: "#trip-timeline",
          cta: "Open Timeline",
        }
      : null,
    !trip.final_payment_due_date && balanceDue > 0
      ? {
          title: "Set final payment due date",
          description: "A balance is still open, but the final payment due date is missing.",
          href: "#trip-overview",
          cta: "Edit Overview",
        }
      : null,
    !insurance.component && !hasInsuranceDocument && !hasInsuranceTripDocument && !hasAnsweredInsurance
      ? {
          title: "Review travel protection",
          description: "Add the insurance component or document that coverage was declined.",
          href: "#insurance-component",
          cta: "Open Insurance",
        }
      : null,
    activeTripComponents.length === 0
      ? {
          title: "Add trip components",
          description: "Start adding the hotel, air, cruise, transfer, activity, or insurance details.",
          href: "#hotel-component",
          cta: "Start Components",
        }
      : null,
    activeTripComponents.length > 0 && componentsWithConfirmations.length < activeTripComponents.length
      ? {
          title: "Check confirmation numbers",
          description: "At least one active component is missing a supplier confirmation number.",
          href: "#hotel-component",
          cta: "Review Components",
        }
      : null,
    commissionOutstandingTotal > 0
      ? {
          title: "Review commissions",
          description: "There is still outstanding commission expected for this trip.",
          href: "#commissions",
          cta: "Open Commissions",
        }
      : null,
    !attachedTripDocumentsError && attachedTripDocumentRows.length === 0
      ? {
          title: "Attach trip documents",
          description: "Client documents exist separately from the trip. Attach the needed files to this specific trip record.",
          href: "#document-readiness",
          cta: "Open Documents",
        }
      : null,
    !clientReminder
      ? {
          title: "Add client reminder",
          description: "Create a client-facing reminder or note so the next communication is documented.",
          href: "#trip-notes",
          cta: "Open Notes",
        }
      : null,
  ].filter(Boolean).slice(0, 4) as Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;

  let coverImagePreviewUrl: string | null = null;
  if (trip.cover_image_path) {
    const { data: coverPreviewData } = await supabase.storage
      .from("trip-documents")
      .createSignedUrl(trip.cover_image_path, 3600);
    coverImagePreviewUrl = coverPreviewData?.signedUrl ?? null;
  }
  const deletionRequested = Boolean(trip.deletion_requested_at);
  const tripDeleted = Boolean(trip.deleted_at);
  const deletionEligibility = isTripEligibleForDeletion(trip);

  return (
    <PageShell
      title={trip.trip_name ?? "Trip Command Center"}
      subtitle="Command center for this trip’s next steps, milestones, payments, components, commissions, and notes."
    >
      <form
        id="mark-trip-commission-received-form"
        action={markTripCommissionReceived}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="update-trip-milestone-status-form"
        action={updateTripMilestoneStatus}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="add-trip-companion-form"
        action={addTripCompanion}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="remove-trip-companion-form"
        action={removeTripCompanion}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="soft-delete-trip-detail-form"
        action={softDeleteTripFromDetail}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="dismiss-trip-deletion-request-detail-form"
        action={dismissTripDeletionRequestFromDetail}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="restore-trip-detail-form"
        action={restoreTripFromDetail}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="override-hard-delete-trip-detail-form"
        action={overrideHardDeleteTripFromDetail}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="add-trip-payment-ledger-entry-form"
        action={addTripPaymentLedgerEntry}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      <form
        id="delete-trip-payment-ledger-entry-form"
        action={deleteTripPaymentLedgerEntry}
        style={{ display: "none" }}
      >
        <input type="hidden" name="trip_id" value={trip.id} />
      </form>

      {[
        "hotel",
        "air",
        "cruise",
        "transfer",
        "rental_car",
        "activity",
        "insurance",
      ].map((componentType) => (
        <form
          key={componentType}
          id={`upload-${componentType}-document-form`}
          action={uploadComponentDocument}
          style={{ display: "none" }}
        >
          <input type="hidden" name="trip_id" value={trip.id} />
        </form>
      ))}

      <form action={updateTrip} className="stack">
        <input type="hidden" name="trip_id" value={trip.id} />

        {savedMessage ? (
          <div
            className="card"
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
            }}
          >
            <p style={{ margin: 0, fontWeight: 900 }}>{savedMessage}</p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              Your latest trip changes are saved.
            </p>
          </div>
        ) : null}

        {documentUploaded ? (
          <div
            className="card"
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
            }}
          >
            <p style={{ margin: 0, fontWeight: 900 }}>
              {extracted === "1"
                ? "Document uploaded and extracted."
                : extracted === "failed"
                  ? "Document uploaded, but extraction failed."
                  : "Document uploaded."}
            </p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              {extracted === "1"
                ? "The component fields were updated from the uploaded document. Review the details below before saving any manual edits."
                : extracted === "failed"
                  ? extractionError || "The file was saved to the component. Try Extract Booking Details from Trip Documents or upload a clearer PDF or image."
                  : "The file is saved to this component and will appear on the commission only if you checked that option."}
            </p>
          </div>
        ) : null}

        {!hasAnsweredInsurance ? (
          <div
            className="card"
            style={{
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              color: "#9a3412",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900 }}>Insurance Waiver Needed</p>
                <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
                  The primary client has not accepted or declined the travel insurance waiver yet. Ask them to open this trip in their portal and answer the Travel Insurance Waiver box near the top of the page.
                </p>
              </div>
              {clientInfo?.id ? (
                <Link
                  href={`/admin/clients/${clientInfo.id}#private-message`}
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: "8px 14px" }}
                >
                  Message Client
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <StickyTripActionBar clientId={clientInfo?.id} tripId={trip.id} />

        <div
          className="card stack"
          style={{
            border: "1px solid #e6f0f2",
            background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                }}
              >
                Trip Command Center
              </p>

              <h2 style={{ margin: "6px 0 0" }}>
                {trip.trip_name ?? "Unnamed Trip"}
              </h2>

              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
                {getClientDisplayName(clientInfo)} • {trip.destinations ?? "Destination not provided"} • {formatDate(trip.departure_date, "No departure date")} to {formatDate(trip.return_date, "No return date")}
              </p>
            </div>

            <div
              style={{
                minWidth: 220,
                padding: "12px",
                borderRadius: 14,
                background: "#ffffff",
                border: "1px solid #e6f0f2",
                color: "#667085",
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: 0, fontWeight: 800, color: "var(--accent-dark)" }}>
                Primary actions live in the sticky bar.
              </p>
              <p style={{ margin: "6px 0 0" }}>
                Use the jump links there to move through this trip without scrolling and hunting.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            <CommandStatCard
              label="Status"
              value={
                <CommandStatusBadge
                  tone={
                    trip.trip_status === "paid_in_full" || trip.trip_status === "travel_complete"
                      ? "good"
                      : trip.trip_status === "cancelled"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {trip.trip_status ?? "draft"}
                </CommandStatusBadge>
              }
              helper="Trip workflow"
            />

            <CommandStatCard
              label="Milestones"
              value={`${milestoneCompleted} / ${milestoneTotal}`}
              helper={`${milestonePercent}% complete`}
            />

            <CommandStatCard
              label="Balance"
              value={formatMoney(balanceDue)}
              helper={trip.final_payment_due_date ? `Due ${formatDate(trip.final_payment_due_date)}` : "No due date"}
            />

            <CommandStatCard
              label="Paid"
              value={formatMoney(totalPaid)}
              helper="Recorded payments"
            />

            <CommandStatCard
              label="Components"
              value={`${componentsWithConfirmations.length} / ${activeTripComponents.length}`}
              helper="Confirmations"
            />

            <CommandStatCard
              label="Commission"
              value={formatMoney(commissionOutstandingTotal)}
              helper={`${commissionRows.length} record${commissionRows.length === 1 ? "" : "s"}`}
            />

            <CommandStatCard
              label="Companions"
              value={tripMembersError ? "Review" : activeTripMemberRows.length}
              helper={`${invitedTripMembers.length} pending`}
            />

            <CommandStatCard
              label="Messages"
              value={tripMessageThreadsError ? "Review" : tripMessageThreadRows.length}
              helper={`${tripMessageUnreadTotal} unread`}
            />
          </div>
          <div
            className="card stack"
            style={{
              background: needsAttentionItems.length > 0 ? "#fff7ed" : "#ecfdf3",
              border: needsAttentionItems.length > 0 ? "1px solid #fed7aa" : "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Needs Attention</h3>
                <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                  Quick review items before this trip is considered buttoned up.
                </p>
              </div>

              <CommandStatusBadge tone={needsAttentionItems.length > 0 ? "warning" : "good"}>
                {needsAttentionItems.length > 0
                  ? `${needsAttentionItems.length} item${needsAttentionItems.length === 1 ? "" : "s"}`
                  : "All clear"}
              </CommandStatusBadge>
            </div>

            {needsAttentionItems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {needsAttentionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                No immediate workflow issues detected from the trip details currently entered.
              </p>
            )}
          </div>

          <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Recommended Next Steps</h3>
                <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                  Use these shortcuts to jump straight to the next part of the workflow.
                </p>
              </div>

              <CommandStatusBadge tone={nextBestActions.length > 0 ? "warning" : "good"}>
                {nextBestActions.length > 0 ? "Action plan ready" : "No urgent actions"}
              </CommandStatusBadge>
            </div>

            {nextBestActions.length > 0 ? (
              <div className="grid grid-2">
                {nextBestActions.map((action) => (
                  <WorkflowActionCard
                    key={action.title}
                    title={action.title}
                    description={action.description}
                    href={action.href}
                    cta={action.cta}
                  />
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                This trip is in good shape based on the details currently entered.
              </p>
            )}
          </div>
        </div>

        <span id="trip-timeline" />
        <CollapsibleSection title="Trip Timeline / Milestone Tracker" defaultOpen>
          {tripMilestonesError ? (
            <div className="card">
              <p>
                <strong>Error loading trip milestones:</strong>
              </p>
              <pre>{JSON.stringify(tripMilestonesError, null, 2)}</pre>
            </div>
          ) : milestoneRows.length === 0 ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
              }}
            >
              <p style={{ margin: 0 }}>
                No milestones found for this trip yet. Refresh this page after running
                the trip_milestones SQL setup if this message continues to appear.
              </p>
            </div>
          ) : (
            <>
              <TripMilestoneProgress milestones={milestoneRows} />

              <MilestoneChecklist milestones={milestoneRows} />
            </>
          )}
        </CollapsibleSection>

        <span id="trip-overview" />
        <CollapsibleSection title="Trip Overview">
          <div className="grid grid-2">
            <label>
              <span className="label">Trip Name</span>
              <input
                className="input"
                name="trip_name"
                defaultValue={trip.trip_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Main Client</span>
              <select
                className="select"
                name="client_account_id"
                defaultValue={trip.client_account_id ?? ""}
              >
                <option value="">Choose the main client...</option>
                {clientSelectOptions.map((client) => {
                  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
                  return (
                    <option key={client.id} value={client.id}>
                      {name || client.email || "Unnamed Client"}{client.email ? ` - ${client.email}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              <span className="label">Destinations</span>
              <input
                className="input"
                name="destinations"
                defaultValue={trip.destinations ?? ""}
              />
            </label>

            <LinkedDateRange
              startName="departure_date"
              endName="return_date"
              startLabel="Departure Date"
              endLabel="Return Date"
              startDefaultValue={trip.departure_date}
              endDefaultValue={trip.return_date}
            />

            <label>
              <span className="label">Occasion</span>
              <input
                className="input"
                name="occasion"
                defaultValue={trip.occasion ?? ""}
              />
            </label>

            <label>
              <span className="label">Trip Status</span>
              <select
                className="select"
                name="trip_status"
                defaultValue={trip.trip_status ?? "draft"}
              >
                <option value="draft">draft</option>
                <option value="quoted">quoted</option>
                <option value="reserved">reserved</option>
                <option value="confirmed">confirmed</option>
                <option value="pending_final_payment">pending_final_payment</option>
                <option value="paid_in_full">paid_in_full</option>
                <option value="travel_complete">travel_complete</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>

            <label>
              <span className="label">Total Paid</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="total_paid"
                defaultValue={trip.total_paid ?? 0}
              />
            </label>

            <label>
              <span className="label">Balance Due (Calculated)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="balance_due"
                defaultValue={trip.balance_due ?? 0}
                readOnly
                style={{ background: "#f7fbfc", color: "#64748b" }}
              />
              <span style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Auto-calculated from component prices plus planning fee, minus payments and credits.
              </span>
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="final_payment_due_date"
                defaultValue={trip.final_payment_due_date ?? ""}
              />
            </label>

              <label>
                <span className="label">Deposit Amount</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="deposit_amount"
                  defaultValue={trip.deposit_amount ?? 0}
                />
              </label>

              <label>
                <span className="label">Deposit Due Date</span>
                <input
                  className="input"
                  type="date"
                  name="deposit_due_date"
                  defaultValue={trip.deposit_due_date ?? ""}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  name="deposit_paid"
                  value="true"
                  defaultChecked={trip.deposit_paid === true}
                />
                <span className="label" style={{ margin: 0 }}>
                  Deposit Paid
                </span>
              </label>
          </div>
        

          <div className="stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>Trip Cover Image</h3>
                <p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                  This appears as the full-width banner at the top of the client trip page.
                </p>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 999,
                  padding: "6px 10px",
                  background: trip.cover_image_path ? "#ecfdf3" : "#fff7ed",
                  color: trip.cover_image_path ? "#027a48" : "#c2410c",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {trip.cover_image_path ? "Cover active" : "Needs cover"}
              </span>
            </div>

            {coverImagePreviewUrl ? (
              <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #dbeafe", background: "#ffffff" }}>
                <img
                  src={coverImagePreviewUrl}
                  alt={`${trip.trip_name ?? "Trip"} cover preview`}
                  style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                />
              </div>
            ) : (
              <div style={{ borderRadius: 14, border: "1px dashed #bfdbfe", background: "#ffffff", padding: 18, color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                No cover image is saved yet. Upload a destination photo to give the client trip page a more polished first impression.
              </div>
            )}

            <label className="stack-sm">
              <span className="label">Upload or Replace Cover Image</span>
              <input
                className="input"
                type="file"
                name="cover_image"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            {trip.cover_image_path && (
              <p style={{ margin: 0, color: "#027a48", fontSize: 12, fontWeight: 700 }}>
                Current file: {trip.cover_image_path}
              </p>
            )}
          </div>

          <SectionSaveButton label="Trip Overview" />
        </CollapsibleSection>

        <span id="hotel-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Hotel Component" badge={hotel.component ? "Added" : "Missing"} tone={hotel.component ? "good" : "warning"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={hotel.component?.id ?? ""}
            supplierId={hotel.component?.supplier_id ?? ""}
            bookingNumber={hotel.component?.confirmation_number ?? ""}
            commissionName={`${
              hotel.details?.hotel_name ??
              hotel.component?.supplier_name ??
              "Hotel"
            } Commission`}
            grossBookingAmount={hotel.component?.total_price ?? 0}
            fullCommissionAmount={hotel.component?.commission_admin_only ?? 0}
          />
          <AiWritingToolButton componentType="hotel" disabled={!hotel.component} />
          <ComponentDocumentUploadCard
            formId="upload-hotel-document-form"
            componentLabel="Hotel"
            componentType="hotel"
            componentId={hotel.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="hotel_supplier_id"
              suppliers={supplierRows}
              defaultValue={hotel.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="hotel_booking_status"
                defaultValue={hotel.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <HotelLibraryPicker
              savedHotels={savedHotelRows}
              fieldNames={{
                hotelName: "hotel_name",
                googlePlaceId: "hotel_google_place_id",
                addressLine1: "hotel_address_line_1",
                addressLine2: "hotel_address_line_2",
                city: "hotel_city",
                state: "hotel_state",
                postalCode: "hotel_postal_code",
                country: "hotel_country",
              }}
              defaults={{
                hotelName: hotel.details?.hotel_name ?? "",
                addressLine1: hotel.component?.address_line_1 ?? hotel.details?.hotel_address ?? "",
                addressLine2: hotel.component?.address_line_2 ?? "",
                city: hotel.component?.city ?? "",
                state: hotel.component?.state ?? "",
                postalCode: hotel.component?.postal_code ?? "",
                country: hotel.component?.country ?? "",
              }}
              title="Hotel Lookup"
            />

            <label>
              <span className="label">Stars</span>
              <input
                className="input"
                type="number"
                step="0.1"
                name="hotel_star_rating"
                defaultValue={hotel.details?.hotel_star_rating ?? ""}
              />
            </label>

            <LinkedDateRange
              startName="hotel_check_in_date"
              endName="hotel_check_out_date"
              startLabel="Check-in"
              endLabel="Check-out"
              startDefaultValue={hotel.details?.check_in_date}
              endDefaultValue={hotel.details?.check_out_date}
            />

            <label>
              <span className="label">Room Category</span>
              <input
                className="input"
                name="hotel_room_category"
                defaultValue={hotel.details?.room_category ?? ""}
              />
            </label>

            <label>
              <span className="label">Nightly Rate</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="hotel_nightly_rate"
                defaultValue={hotel.details?.nightly_rate ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="hotel_total_price"
                defaultValue={hotel.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="hotel_confirmation_number"
                defaultValue={hotel.component?.confirmation_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="hotel_deposit_due_date"
                defaultValue={hotel.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="hotel_final_payment_due_date"
                defaultValue={hotel.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Room Description</span>
            <textarea
              className="textarea"
              name="hotel_room_description"
              defaultValue={hotel.details?.room_description ?? ""}
            />
          </label>

          <label>
            <span className="label">Hotel Description</span>
            <textarea
              className="textarea"
              name="hotel_description"
              defaultValue={hotel.details?.hotel_description ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="hotel_terms_and_conditions"
              defaultValue={hotel.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="hotel_cancellation_policy"
              defaultValue={hotel.component?.cancellation_policy ?? ""}
            />
          </label>
        

          <SectionSaveButton label="Hotel Component" />
        </CollapsibleSection>

        <span id="air-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Air Component" badge={air.component ? "Added" : "Missing"} tone={air.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={air.component?.id ?? ""}
            supplierId={air.component?.supplier_id ?? ""}
            bookingNumber={air.component?.confirmation_number ?? ""}
            commissionName={`${air.component?.supplier_name ?? "Air"} Commission`}
            grossBookingAmount={air.component?.total_price ?? 0}
            fullCommissionAmount={air.component?.commission_admin_only ?? 0}
          />
          <AiWritingToolButton componentType="air" disabled={!air.component} />
          <ComponentDocumentUploadCard
            formId="upload-air-document-form"
            componentLabel="Air"
            componentType="air"
            componentId={air.component?.id}
          />

          <div className="grid grid-2">
            <SupplierSelect
              name="air_supplier_id"
              suppliers={supplierRows}
              defaultValue={air.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Flight Type</span>
              <select
                className="select"
                name="air_flight_type"
                defaultValue={air.details?.flight_type ?? "round_trip"}
              >
                <option value="round_trip">round_trip</option>
                <option value="one_way">one_way</option>
              </select>
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="air_booking_status"
                defaultValue={air.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Traveler Count</span>
              <input
                className="input"
                type="number"
                min="1"
                name="air_traveler_count"
                defaultValue={air.details?.traveler_count ?? 1}
              />
            </label>

            <label>
              <span className="label">Rate Class</span>
              <input
                className="input"
                name="air_rate_class"
                defaultValue={air.details?.rate_class ?? ""}
              />
            </label>

            <label>
              <span className="label">Airline Locator</span>
              <input
                className="input"
                name="air_airline_locator"
                defaultValue={air.details?.airline_locator ?? ""}
              />
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="air_confirmation_number"
                defaultValue={air.component?.confirmation_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="air_total_price"
                defaultValue={air.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="air_deposit_due_date"
                defaultValue={air.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="air_final_payment_due_date"
                defaultValue={air.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="air_terms_and_conditions"
              defaultValue={air.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="air_cancellation_policy"
              defaultValue={air.component?.cancellation_policy ?? ""}
            />
          </label>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Outbound Flight</h3>

            <div className="grid grid-2">
              <AirportPicker
                label="Departure Airport"
                name="outbound_departure_airport_code"
                defaultValue={outboundSegment?.departure_airport_code ?? ""}
              />

              <AirportPicker
                label="Destination Airport"
                name="outbound_destination_airport_code"
                defaultValue={outboundSegment?.destination_airport_code ?? ""}
              />

              <label>
                <span className="label">Departure Date & Time</span>
                <input
                  className="input"
                  type="datetime-local"
                  name="outbound_departure_datetime"
                  defaultValue={
                    outboundSegment?.departure_datetime
                      ? new Date(outboundSegment.departure_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>

              <label>
                <span className="label">Arrival Date & Time</span>
                <input
                  className="input"
                  type="datetime-local"
                  name="outbound_arrival_datetime"
                  defaultValue={
                    outboundSegment?.arrival_datetime
                      ? new Date(outboundSegment.arrival_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>

              <label>
                <span className="label">Flight Number</span>
                <input
                  className="input"
                  name="outbound_flight_number"
                  defaultValue={outboundSegment?.flight_number ?? ""}
                />
              </label>

              <AirlinePicker
                label="Carrier"
                name="outbound_carrier"
                defaultValue={outboundSegment?.carrier ?? ""}
              />

              <label>
                <span className="label">Cabin Class</span>
                <input
                  className="input"
                  name="outbound_cabin_class"
                  defaultValue={outboundSegment?.cabin_class ?? ""}
                />
              </label>

              <label>
                <span className="label">Seat Assignment</span>
                <input
                  className="input"
                  name="outbound_seat_assignment"
                  defaultValue={outboundSegment?.seat_assignment ?? ""}
                />
              </label>
            </div>
          </div>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Return Flight</h3>

            <div className="grid grid-2">
              <AirportPicker
                label="Departure Airport"
                name="return_departure_airport_code"
                defaultValue={returnSegment?.departure_airport_code ?? ""}
              />

              <AirportPicker
                label="Destination Airport"
                name="return_destination_airport_code"
                defaultValue={returnSegment?.destination_airport_code ?? ""}
              />

              <label>
                <span className="label">Departure Date & Time</span>
                <input
                  className="input"
                  type="datetime-local"
                  name="return_departure_datetime"
                  defaultValue={
                    returnSegment?.departure_datetime
                      ? new Date(returnSegment.departure_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>

              <label>
                <span className="label">Arrival Date & Time</span>
                <input
                  className="input"
                  type="datetime-local"
                  name="return_arrival_datetime"
                  defaultValue={
                    returnSegment?.arrival_datetime
                      ? new Date(returnSegment.arrival_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>

              <label>
                <span className="label">Flight Number</span>
                <input
                  className="input"
                  name="return_flight_number"
                  defaultValue={returnSegment?.flight_number ?? ""}
                />
              </label>

              <AirlinePicker
                label="Carrier"
                name="return_carrier"
                defaultValue={returnSegment?.carrier ?? ""}
              />

              <label>
                <span className="label">Cabin Class</span>
                <input
                  className="input"
                  name="return_cabin_class"
                  defaultValue={returnSegment?.cabin_class ?? ""}
                />
              </label>

              <label>
                <span className="label">Seat Assignment</span>
                <input
                  className="input"
                  name="return_seat_assignment"
                  defaultValue={returnSegment?.seat_assignment ?? ""}
                />
              </label>
            </div>
          </div>
        

          <SectionSaveButton label="Air Component" />
        </CollapsibleSection>

        <span id="cruise-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Cruise Component" badge={cruise.component ? "Added" : "Missing"} tone={cruise.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={cruise.component?.id ?? ""}
            supplierId={cruise.component?.supplier_id ?? ""}
            bookingNumber={cruise.component?.confirmation_number ?? ""}
            commissionName={`${
              cruise.details?.ship_name ??
              cruise.details?.cruise_line ??
              cruise.component?.supplier_name ??
              "Cruise"
            } Commission`}
            grossBookingAmount={cruise.component?.total_price ?? 0}
            fullCommissionAmount={cruise.component?.commission_admin_only ?? 0}
          />
          <AiWritingToolButton componentType="cruise" disabled={!cruise.component} />
          <ComponentDocumentUploadCard
            formId="upload-cruise-document-form"
            componentLabel="Cruise"
            componentType="cruise"
            componentId={cruise.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="cruise_supplier_id"
              suppliers={supplierRows}
              defaultValue={cruise.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Cruise Line</span>
              <input
                className="input"
                name="cruise_line"
                defaultValue={cruise.details?.cruise_line ?? ""}
              />
            </label>

            <label>
              <span className="label">Ship Name</span>
              <input
                className="input"
                name="ship_name"
                defaultValue={cruise.details?.ship_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="cruise_booking_status"
                defaultValue={cruise.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="cruise_confirmation_number"
                defaultValue={cruise.component?.confirmation_number ?? ""}
              />
            </label>

            <LinkedDateRange
              startName="cruise_sailing_date"
              endName="cruise_return_date"
              startLabel="Sailing Date"
              endLabel="Return Date"
              startDefaultValue={cruise.details?.sailing_date}
              endDefaultValue={cruise.details?.return_date}
            />

            <label>
              <span className="label">Departure Port</span>
              <input
                className="input"
                name="cruise_departure_port"
                defaultValue={cruise.details?.departure_port ?? ""}
              />
            </label>

            <label>
              <span className="label">Arrival Port</span>
              <input
                className="input"
                name="cruise_arrival_port"
                defaultValue={cruise.details?.arrival_port ?? ""}
              />
            </label>

            <label>
              <span className="label">Cabin Category</span>
              <input
                className="input"
                name="cruise_cabin_category"
                defaultValue={cruise.details?.cabin_category ?? ""}
              />
            </label>

            <label>
              <span className="label">Cabin Number</span>
              <input
                className="input"
                name="cruise_cabin_number"
                defaultValue={cruise.details?.cabin_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Dining Seating</span>
              <input
                className="input"
                name="cruise_dining_seating"
                defaultValue={cruise.details?.dining_seating ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="cruise_total_price"
                defaultValue={cruise.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="cruise_deposit_due_date"
                defaultValue={cruise.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="cruise_final_payment_due_date"
                defaultValue={cruise.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <div
            className="card stack"
            style={{
              border: cruise.component?.price_watch_last_status === "lower_price_found"
                ? "1px solid #fdba74"
                : "1px solid #dbeafe",
              background: cruise.component?.price_watch_last_status === "lower_price_found"
                ? "#fff7ed"
                : "#f7fbfc",
              borderRadius: 14,
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Cruise Price Watch</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.5 }}>
                  Track Royal Caribbean, Celebrity, Norwegian, and Disney public prices for the exact saved cabin code.
                </p>
              </div>
              {cruise.component?.price_watch_last_status ? (
                <span
                  style={{
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: cruise.component.price_watch_last_status === "lower_price_found" ? "#fed7aa" : "#e0f2fe",
                    color: cruise.component.price_watch_last_status === "lower_price_found" ? "#9a3412" : "#075985",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {String(cruise.component.price_watch_last_status).replace(/_/g, " ")}
                </span>
              ) : null}
            </div>

            <label
              className="row"
              style={{
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #e6f0f2",
              }}
            >
              <input
                type="checkbox"
                name="cruise_price_watch_enabled"
                defaultChecked={Boolean(cruise.component?.price_watch_enabled)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontWeight: 800 }}>Watch this cruise for public price drops of $100 or more, plus holiday and major sale-day review items</span>
            </label>

            <div className="grid grid-2">
              <label>
                <span className="label">Public Pricing URL</span>
                <input
                  className="input"
                  type="url"
                  name="cruise_price_watch_public_url"
                  placeholder="https://www.cruiseline.com/..."
                  defaultValue={cruise.component?.price_watch_public_url ?? ""}
                />
              </label>

              <label>
                <span className="label">Exact Cabin Category Code</span>
                <input
                  className="input"
                  name="cruise_price_watch_match_code"
                  placeholder="N4"
                  defaultValue={
                    cruise.component?.price_watch_match_code ??
                    cruise.details?.cabin_category ??
                    ""
                  }
                />
              </label>
            </div>

            {cruise.component?.price_watch_last_checked_at ? (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                Last checked {formatDate(cruise.component.price_watch_last_checked_at)}.
                {Number(cruise.component?.price_watch_last_found_price ?? 0) > 0
                  ? ` Last visible price: ${formatMoney(Number(cruise.component.price_watch_last_found_price))}.`
                  : ""}
                {cruise.component?.price_watch_last_promo_codes
                  ? ` Promo codes: ${cruise.component.price_watch_last_promo_codes}.`
                  : ""}
                {cruise.component?.price_watch_last_error
                  ? ` ${cruise.component.price_watch_last_error}`
                  : ""}
              </p>
            ) : (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                Save this cruise with a public pricing URL and cabin code, then the weekly check can compare it around holidays and major cruise sale days.
              </p>
            )}
          </div>

          <label>
            <span className="label">Cruise Description</span>
            <textarea
              className="textarea"
              name="cruise_description"
              defaultValue={cruise.details?.cruise_description ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="cruise_terms_and_conditions"
              defaultValue={cruise.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="cruise_cancellation_policy"
              defaultValue={cruise.component?.cancellation_policy ?? ""}
            />
          </label>
        

          <SectionSaveButton label="Cruise Component" />
        </CollapsibleSection>

        <span id="transfer-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Transfer Component" badge={transfer.component ? "Added" : "Missing"} tone={transfer.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={transfer.component?.id ?? ""}
            supplierId={transfer.component?.supplier_id ?? ""}
            bookingNumber={transfer.component?.confirmation_number ?? ""}
            commissionName={`${
              transfer.details?.supplier_name ??
              transfer.component?.supplier_name ??
              "Transfer"
            } Commission`}
            grossBookingAmount={transfer.component?.total_price ?? 0}
            fullCommissionAmount={
              transfer.details?.commission_amount ??
              transfer.component?.commission_admin_only ??
              0
            }
          />
          <AiWritingToolButton componentType="transfer" disabled={!transfer.component} />
          <ComponentDocumentUploadCard
            formId="upload-transfer-document-form"
            componentLabel="Transfer"
            componentType="transfer"
            componentId={transfer.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="transfer_supplier_id"
              suppliers={supplierRows}
              defaultValue={transfer.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Supplier / Manual Name</span>
              <input
                className="input"
                name="transfer_supplier_name"
                defaultValue={transfer.details?.supplier_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="transfer_booking_status"
                defaultValue={transfer.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Pickup Date & Time</span>
              <input
                className="input"
                type="datetime-local"
                name="transfer_pickup_datetime"
                defaultValue={
                  transfer.details?.pickup_datetime
                    ? new Date(transfer.details.pickup_datetime)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>

            <label>
              <span className="label">Passenger Count</span>
              <input
                className="input"
                type="number"
                min="1"
                name="transfer_passenger_count"
                defaultValue={transfer.details?.passenger_count ?? ""}
              />
            </label>

            <div className="stack" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: 0 }}>Pickup Address / Location</h3>
              <AddressAutocomplete
                addressLine1Default={transfer.component?.address_line_1 ?? transfer.details?.pickup_location ?? ""}
                addressLine2Default={transfer.component?.address_line_2 ?? ""}
                cityDefault={transfer.component?.city ?? ""}
                stateDefault={transfer.component?.state ?? ""}
                postalCodeDefault={transfer.component?.postal_code ?? ""}
                fieldNames={{
                  addressLine1: "transfer_address_line_1",
                  addressLine2: "transfer_address_line_2",
                  city: "transfer_city",
                  state: "transfer_state",
                  postalCode: "transfer_postal_code",
                }}
                addressLine1Label="Pickup Address Line 1"
                helperText="Start typing the pickup address or location, then choose the best match."
              />
              <label className="stack-sm">
                <span className="label">Pickup Country</span>
                <input
                  className="input"
                  name="transfer_country"
                  defaultValue={transfer.component?.country ?? ""}
                  placeholder="United States"
                  autoComplete="country-name"
                />
              </label>
            </div>

            <label>
              <span className="label">Dropoff Location</span>
              <input
                className="input"
                name="transfer_dropoff_location"
                defaultValue={transfer.details?.dropoff_location ?? ""}
              />
            </label>

            <label>
              <span className="label">Vehicle Type</span>
              <input
                className="input"
                name="transfer_vehicle_type"
                defaultValue={transfer.details?.vehicle_type ?? ""}
              />
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="transfer_confirmation_number"
                defaultValue={transfer.component?.confirmation_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="transfer_total_price"
                defaultValue={transfer.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="transfer_deposit_due_date"
                defaultValue={transfer.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="transfer_final_payment_due_date"
                defaultValue={transfer.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Transfer Notes</span>
            <textarea
              className="textarea"
              name="transfer_notes"
              defaultValue={transfer.details?.transfer_notes ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="transfer_terms_and_conditions"
              defaultValue={transfer.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="transfer_cancellation_policy"
              defaultValue={transfer.component?.cancellation_policy ?? ""}
            />
          </label>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Commissions</h3>

            <div className="grid grid-2">
              <label>
                <span className="label">Commission Amount</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="transfer_commission_amount"
                  defaultValue={transfer.details?.commission_amount ?? ""}
                />
              </label>

              <label>
                <span className="label">Commission Status</span>
                <input
                  className="input"
                  name="transfer_commission_status"
                  defaultValue={transfer.details?.commission_status ?? ""}
                />
              </label>
            </div>

            <label>
              <span className="label">Commission Notes</span>
              <textarea
                className="textarea"
                name="transfer_commission_notes"
                defaultValue={transfer.details?.commission_notes ?? ""}
              />
            </label>
          </div>
        

          <SectionSaveButton label="Transfer Component" />
        </CollapsibleSection>

        <span id="rental_car-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Rental Car Component" badge={rentalCar.component ? "Added" : "Missing"} tone={rentalCar.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={rentalCar.component?.id ?? ""}
            supplierId={rentalCar.component?.supplier_id ?? ""}
            bookingNumber={rentalCar.component?.confirmation_number ?? ""}
            commissionName={`${
              rentalCar.details?.rental_company ??
              rentalCar.component?.supplier_name ??
              "Rental Car"
            } Commission`}
            grossBookingAmount={rentalCar.component?.total_price ?? 0}
            fullCommissionAmount={
              rentalCar.details?.commission_amount ??
              rentalCar.component?.commission_admin_only ??
              0
            }
          />
          <AiWritingToolButton componentType="rental_car" disabled={!rentalCar.component} />
          <ComponentDocumentUploadCard
            formId="upload-rental_car-document-form"
            componentLabel="Rental Car"
            componentType="rental_car"
            componentId={rentalCar.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="rental_car_supplier_id"
              suppliers={supplierRows}
              defaultValue={rentalCar.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Rental Company / Manual Name</span>
              <input
                className="input"
                name="rental_car_company"
                defaultValue={rentalCar.details?.rental_company ?? ""}
              />
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="rental_car_booking_status"
                defaultValue={rentalCar.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="rental_car_confirmation_number"
                defaultValue={rentalCar.component?.confirmation_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Pickup Date & Time</span>
              <input
                className="input"
                type="datetime-local"
                name="rental_car_pickup_datetime"
                defaultValue={
                  rentalCar.details?.pickup_datetime
                    ? new Date(rentalCar.details.pickup_datetime)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>

            <label>
              <span className="label">Return Date & Time</span>
              <input
                className="input"
                type="datetime-local"
                name="rental_car_return_datetime"
                defaultValue={
                  rentalCar.details?.return_datetime
                    ? new Date(rentalCar.details.return_datetime)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>

            <label>
              <span className="label">Pickup Location</span>
              <input
                className="input"
                name="rental_car_pickup_location"
                defaultValue={rentalCar.details?.pickup_location ?? ""}
              />
            </label>

            <label>
              <span className="label">Return Location</span>
              <input
                className="input"
                name="rental_car_return_location"
                defaultValue={rentalCar.details?.return_location ?? ""}
              />
            </label>

            <label>
              <span className="label">Vehicle Class</span>
              <input
                className="input"
                name="rental_car_vehicle_class"
                defaultValue={rentalCar.details?.vehicle_class ?? ""}
                placeholder="Intermediate, SUV, minivan..."
              />
            </label>

            <label>
              <span className="label">Driver Count</span>
              <input
                className="input"
                type="number"
                min="1"
                name="rental_car_driver_count"
                defaultValue={rentalCar.details?.driver_count ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="rental_car_total_price"
                defaultValue={rentalCar.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="rental_car_deposit_due_date"
                defaultValue={rentalCar.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="rental_car_final_payment_due_date"
                defaultValue={rentalCar.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Rental Notes</span>
            <textarea
              className="textarea"
              name="rental_car_notes"
              defaultValue={rentalCar.details?.rental_notes ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="rental_car_terms_and_conditions"
              defaultValue={rentalCar.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="rental_car_cancellation_policy"
              defaultValue={rentalCar.component?.cancellation_policy ?? ""}
            />
          </label>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Commissions</h3>

            <div className="grid grid-2">
              <label>
                <span className="label">Commission Amount</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="rental_car_commission_amount"
                  defaultValue={rentalCar.details?.commission_amount ?? ""}
                />
              </label>

              <label>
                <span className="label">Commission Status</span>
                <input
                  className="input"
                  name="rental_car_commission_status"
                  defaultValue={rentalCar.details?.commission_status ?? ""}
                />
              </label>
            </div>

            <label>
              <span className="label">Commission Notes</span>
              <textarea
                className="textarea"
                name="rental_car_commission_notes"
                defaultValue={rentalCar.details?.commission_notes ?? ""}
              />
            </label>
          </div>

          <SectionSaveButton label="Rental Car Component" />
        </CollapsibleSection>

        <span id="activity-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Activity Component" badge={activity.component ? "Added" : "Missing"} tone={activity.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={activity.component?.id ?? ""}
            supplierId={activity.component?.supplier_id ?? ""}
            bookingNumber={activity.component?.confirmation_number ?? ""}
            commissionName={`${
              activity.details?.activity_name ??
              activity.component?.supplier_name ??
              "Activity"
            } Commission`}
            grossBookingAmount={activity.component?.total_price ?? 0}
            fullCommissionAmount={
              activity.details?.commission_amount ??
              activity.component?.commission_admin_only ??
              0
            }
          />
          <AiWritingToolButton componentType="activity" disabled={!activity.component} />
          <ComponentDocumentUploadCard
            formId="upload-activity-document-form"
            componentLabel="Activity"
            componentType="activity"
            componentId={activity.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="activity_supplier_id"
              suppliers={supplierRows}
              defaultValue={activity.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Activity Name</span>
              <input
                className="input"
                name="activity_name"
                defaultValue={activity.details?.activity_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Supplier / Manual Name</span>
              <input
                className="input"
                name="activity_supplier_name"
                defaultValue={activity.details?.supplier_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="activity_booking_status"
                defaultValue={activity.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Confirmation Number</span>
              <input
                className="input"
                name="activity_confirmation_number"
                defaultValue={activity.component?.confirmation_number ?? ""}
              />
            </label>

            <label>
              <span className="label">Activity Date & Time</span>
              <input
                className="input"
                type="datetime-local"
                name="activity_datetime"
                defaultValue={
                  activity.details?.activity_datetime
                    ? new Date(activity.details.activity_datetime)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>

            <div className="stack" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: 0 }}>Activity Address / Location</h3>
              <AddressAutocomplete
                addressLine1Default={activity.component?.address_line_1 ?? activity.details?.location ?? ""}
                addressLine2Default={activity.component?.address_line_2 ?? ""}
                cityDefault={activity.component?.city ?? ""}
                stateDefault={activity.component?.state ?? ""}
                postalCodeDefault={activity.component?.postal_code ?? ""}
                fieldNames={{
                  addressLine1: "activity_address_line_1",
                  addressLine2: "activity_address_line_2",
                  city: "activity_city",
                  state: "activity_state",
                  postalCode: "activity_postal_code",
                }}
                addressLine1Label="Activity Address Line 1"
                helperText="Start typing the activity address or location, then choose the best match."
              />
              <label className="stack-sm">
                <span className="label">Activity Country</span>
                <input
                  className="input"
                  name="activity_country"
                  defaultValue={activity.component?.country ?? ""}
                  placeholder="United States"
                  autoComplete="country-name"
                />
              </label>
            </div>

            <label>
              <span className="label">Participant Count</span>
              <input
                className="input"
                type="number"
                min="1"
                name="activity_participant_count"
                defaultValue={activity.details?.participant_count ?? ""}
              />
            </label>

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="activity_total_price"
                defaultValue={activity.component?.total_price ?? 0}
              />
            </label>

            <label>
              <span className="label">Deposit Due Date</span>
              <input
                className="input"
                type="date"
                name="activity_deposit_due_date"
                defaultValue={activity.component?.deposit_due_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Final Payment Due Date</span>
              <input
                className="input"
                type="date"
                name="activity_final_payment_due_date"
                defaultValue={activity.component?.final_payment_due_date ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Activity Notes</span>
            <textarea
              className="textarea"
              name="activity_notes"
              defaultValue={activity.details?.activity_notes ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="activity_terms_and_conditions"
              defaultValue={activity.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="activity_cancellation_policy"
              defaultValue={activity.component?.cancellation_policy ?? ""}
            />
          </label>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Commissions</h3>

            <div className="grid grid-2">
              <label>
                <span className="label">Commission Amount</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="activity_commission_amount"
                  defaultValue={activity.details?.commission_amount ?? ""}
                />
              </label>

              <label>
                <span className="label">Commission Status</span>
                <input
                  className="input"
                  name="activity_commission_status"
                  defaultValue={activity.details?.commission_status ?? ""}
                />
              </label>
            </div>

            <label>
              <span className="label">Commission Notes</span>
              <textarea
                className="textarea"
                name="activity_commission_notes"
                defaultValue={activity.details?.commission_notes ?? ""}
              />
            </label>
          </div>
        

          <SectionSaveButton label="Activity Component" />
        </CollapsibleSection>

        <span id="insurance-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Insurance Component" badge={insurance.component ? "Added" : "Missing"} tone={insurance.component ? "good" : "warning"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            componentId={insurance.component?.id ?? ""}
            supplierId={insurance.component?.supplier_id ?? ""}
            bookingNumber={
              insurance.component?.confirmation_number ??
              insurance.details?.policy_number ??
              ""
            }
            commissionName={`${
              insurance.details?.plan_name ??
              insurance.details?.provider_name ??
              insurance.component?.supplier_name ??
              "Insurance"
            } Commission`}
            grossBookingAmount={insurance.component?.total_price ?? 0}
            fullCommissionAmount={
              insurance.details?.commission_amount ??
              insurance.component?.commission_admin_only ??
              0
            }
          />
          <AiWritingToolButton componentType="insurance" disabled={!insurance.component} />
          <ComponentDocumentUploadCard
            formId="upload-insurance-document-form"
            componentLabel="Insurance"
            componentType="insurance"
            componentId={insurance.component?.id}
          />
          <div className="grid grid-2">
            <SupplierSelect
              name="insurance_supplier_id"
              suppliers={supplierRows}
              defaultValue={insurance.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Provider Name</span>
              <input
                className="input"
                name="insurance_provider_name"
                defaultValue={insurance.details?.provider_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Plan Name</span>
              <input
                className="input"
                name="insurance_plan_name"
                defaultValue={insurance.details?.plan_name ?? ""}
              />
            </label>

            <label>
              <span className="label">Booking Status</span>
              <select
                className="select"
                name="insurance_booking_status"
                defaultValue={insurance.component?.booking_status ?? "quoted"}
              >
                <option value="on_hold">on_hold</option>
                <option value="reserved">reserved</option>
                <option value="quoted">quoted</option>
              </select>
            </label>

            <label>
              <span className="label">Policy Number</span>
              <input
                className="input"
                name="insurance_policy_number"
                defaultValue={insurance.details?.policy_number ?? ""}
              />
            </label>

            <LinkedDateRange
              startName="insurance_coverage_start_date"
              endName="insurance_coverage_end_date"
              startLabel="Coverage Start Date"
              endLabel="Coverage End Date"
              startDefaultValue={insurance.details?.coverage_start_date}
              endDefaultValue={insurance.details?.coverage_end_date}
            />

            <label>
              <span className="label">Insured Traveler Count</span>
              <input
                className="input"
                type="number"
                min="1"
                name="insurance_insured_traveler_count"
                defaultValue={insurance.details?.insured_traveler_count ?? ""}
              />
            </label>

            <label>
              <span className="label">Premium Amount</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="insurance_premium_amount"
                defaultValue={insurance.details?.premium_amount ?? ""}
              />
            </label>

            <label>
              <span className="label">Claim Phone</span>
              <input
                className="input"
                name="insurance_claim_phone"
                defaultValue={insurance.details?.claim_phone ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Insurance Notes</span>
            <textarea
              className="textarea"
              name="insurance_notes"
              defaultValue={insurance.details?.insurance_notes ?? ""}
            />
          </label>

          <label>
            <span className="label">Terms and Conditions</span>
            <textarea
              className="textarea"
              name="insurance_terms_and_conditions"
              defaultValue={insurance.component?.terms_and_conditions ?? ""}
            />
          </label>

          <label>
            <span className="label">Cancellation Policy</span>
            <textarea
              className="textarea"
              name="insurance_cancellation_policy"
              defaultValue={insurance.component?.cancellation_policy ?? ""}
            />
          </label>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Commissions</h3>

            <div className="grid grid-2">
              <label>
                <span className="label">Commission Amount</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="insurance_commission_amount"
                  defaultValue={insurance.details?.commission_amount ?? ""}
                />
              </label>

              <label>
                <span className="label">Commission Status</span>
                <input
                  className="input"
                  name="insurance_commission_status"
                  defaultValue={insurance.details?.commission_status ?? ""}
                />
              </label>
            </div>

            <label>
              <span className="label">Commission Notes</span>
              <textarea
                className="textarea"
                name="insurance_commission_notes"
                defaultValue={insurance.details?.commission_notes ?? ""}
              />
            </label>
          </div>
        

          <SectionSaveButton label="Insurance Component" />
        </CollapsibleSection>

        <span id="trip-payments" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Payments & Adjustments" badge={`${tripPaymentLedgerRows.length} entries`} tone={tripPaymentLedgerRows.length > 0 ? "good" : "neutral"} />}>
          <div className="grid grid-3">
            <div className="card">
              <span className="label">Total Paid</span>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>{formatMoney(totalPaid)}</p>
            </div>
            <div className="card">
              <span className="label">Balance Due</span>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: balanceDue > 0 ? "#c2410c" : "#027a48" }}>{formatMoney(balanceDue)}</p>
            </div>
            <div className="card">
              <span className="label">Final Payment Due</span>
              <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 900 }}>{formatDate(trip.final_payment_due_date, "Not set")}</p>
            </div>
          </div>

          <div className="card stack" style={{ background: "#fbfdfe" }}>
            <div>
              <h3 style={{ margin: 0 }}>Record Payment, Refund, Credit, Fee, or Adjustment</h3>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                These entries update the trip&apos;s Total Paid and Balance Due automatically. Use the Trip Overview fields only for rare manual corrections.
              </p>
            </div>

            <div className="grid grid-3">
              <label>
                <span className="label">Entry Type</span>
                <select className="select" name="entry_type" form="add-trip-payment-ledger-entry-form" defaultValue="payment">
                  <option value="payment">Payment received</option>
                  <option value="refund">Refund issued</option>
                  <option value="credit">Credit applied</option>
                  <option value="fee">Fee added</option>
                  <option value="adjustment">Manual balance adjustment</option>
                </select>
              </label>
              <label>
                <span className="label">Amount</span>
                <input className="input" type="number" step="0.01" name="amount" form="add-trip-payment-ledger-entry-form" placeholder="0.00" />
              </label>
              <label>
                <span className="label">Entry Date</span>
                <input className="input" type="date" name="entry_date" form="add-trip-payment-ledger-entry-form" defaultValue={todayDateString()} />
              </label>
              <label>
                <span className="label">Payment Method</span>
                <input className="input" name="payment_method" form="add-trip-payment-ledger-entry-form" placeholder="Credit card, check, ACH, supplier portal..." />
              </label>
              <label>
                <span className="label">Reference #</span>
                <input className="input" name="reference_number" form="add-trip-payment-ledger-entry-form" placeholder="Receipt, authorization, or invoice #" />
              </label>
              <label>
                <span className="label">Notes</span>
                <input className="input" name="notes" form="add-trip-payment-ledger-entry-form" placeholder="Short internal note" />
              </label>
            </div>

            <button type="submit" form="add-trip-payment-ledger-entry-form" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              Add Payment Entry
            </button>
          </div>

          {tripPaymentLedgerError ? (
            <div className="card">
              <p><strong>Error loading payment ledger:</strong></p>
              <pre>{JSON.stringify(tripPaymentLedgerError, null, 2)}</pre>
            </div>
          ) : tripPaymentLedgerRows.length === 0 ? (
            <div style={{ padding: "12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2", color: "#64748b" }}>
              No payment ledger entries have been recorded yet.
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tripPaymentLedgerRows.map((entry) => {
                    const entryTypeLabel = entry.entry_type
                      .split("_")
                      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                      .join(" ");
                    const isPositiveBalanceType = entry.entry_type === "refund" || entry.entry_type === "fee";
                    const isReductionType = entry.entry_type === "payment" || entry.entry_type === "credit";
                    return (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.entry_date)}</td>
                        <td>
                          <span style={{ display: "inline-flex", borderRadius: 999, padding: "5px 10px", background: isReductionType ? "#ecfdf3" : isPositiveBalanceType ? "#fff7ed" : "#f0f7f8", color: isReductionType ? "#027a48" : isPositiveBalanceType ? "#c2410c" : "var(--accent-dark)", fontWeight: 800, fontSize: 12 }}>
                            {entryTypeLabel}
                          </span>
                        </td>
                        <td style={{ fontWeight: 900 }}>{formatMoney(entry.amount)}</td>
                        <td>{entry.payment_method ?? "Not provided"}</td>
                        <td>{entry.reference_number ?? "Not provided"}</td>
                        <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>{entry.notes ?? "Not provided"}</td>
                        <td>
                          <button
                            type="submit"
                            form="delete-trip-payment-ledger-entry-form"
                            name="ledger_id"
                            value={entry.id}
                            className="btn btn-outline"
                            style={{ fontSize: 13, padding: "5px 12px", color: "#be123c", borderColor: "#fecaca" }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>

        <span id="proposal" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Proposal" badge={proposal ? "Started" : "Empty"} tone={proposal ? "good" : "neutral"} />}>
          <div className="grid grid-2">
            <label>
              <span className="label">Planning Fee</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="planning_fee"
                defaultValue={proposal?.planning_fee ?? 0}
              />
            </label>

            <div
              style={{
                padding: "12px",
                border: "1px solid #e6f0f2",
                borderRadius: 12,
                background: "#f7fbfc",
              }}
            >
              <span className="label">Calculated Trip Total</span>
              <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>
                {formatMoney(calculatedProposalTotal)}
              </p>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Component prices ({formatMoney(componentPriceTotal)}) plus planning fee ({formatMoney(proposalPlanningFee)}). This total is calculated automatically.
              </p>
            </div>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="label">Proposal Title</span>
              <input
                className="input"
                name="proposal_title"
                defaultValue={proposal?.proposal_title ?? ""}
              />
            </label>
          </div>

          <label>
            <span className="label">Proposal Welcome Text</span>
            <textarea
              className="textarea"
              name="proposal_welcome_text"
              defaultValue={proposal?.proposal_welcome_text ?? ""}
            />
          </label>

          <label>
            <span className="label">Proposal Closing Text</span>
            <textarea
              className="textarea"
              name="proposal_closing_text"
              defaultValue={proposal?.proposal_closing_text ?? ""}
            />
          </label>
        

          <SectionSaveButton label="Proposal" />
        </CollapsibleSection>

        <span id="commissions" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Commissions for This Trip" badge={`${commissionRows.length} record${commissionRows.length === 1 ? "" : "s"}`} tone={commissionRows.length > 0 ? "good" : "neutral"} />}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Trip Commission Tracker</h3>
            </div>

            <Link
              href={`/admin/commissions/new?tripId=${trip.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--accent-dark)",
                color: "white",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Add Commission
            </Link>
          </div>

          {tripCommissionsError ? (
            <div className="card">
              <p>
                <strong>Error loading commissions:</strong>
              </p>
              <pre>{JSON.stringify(tripCommissionsError, null, 2)}</pre>
            </div>
          ) : commissionRows.length === 0 ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
              }}
            >
              <p style={{ margin: 0 }}>
                No commission records are linked to this trip yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-3">
                <div className="card">
                  <span className="label">Full Commission</span>
                  <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                    {formatMoney(commissionFullTotal)}
                  </p>
                </div>

                <div className="card">
                  <span className="label">Your Expected Commission</span>
                  <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                    {formatMoney(commissionExpectedTotal)}
                  </p>
                </div>

                <div className="card">
                  <span className="label">Received</span>
                  <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                    {formatMoney(commissionReceivedTotal)}
                  </p>
                </div>
              </div>

              <div className="card">
                <span className="label">Outstanding</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                  {formatMoney(commissionOutstandingTotal)}
                </p>
              </div>

              <div style={{ width: "100%", overflowX: "auto" }}>
                <table className="table" style={{ minWidth: 1120 }}>
                  <thead>
                    <tr>
                      <th>Commission</th>
                      <th>Supplier</th>
                      <th>Booking #</th>
                      <th>Status</th>
                      <th>Full</th>
                      <th>Your %</th>
                      <th>Your Expected</th>
                      <th>Received</th>
                      <th>Expected Date</th>
                      <th>Received Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {commissionRows.map((commission) => {
                      const expectedCommission = getExpectedCommission(commission);

                      return (
                        <tr key={commission.id}>
                          <td>{commission.commission_name}</td>
                          <td>{commission.supplier_name_snapshot ?? "Not provided"}</td>
                          <td>{commission.booking_number ?? "Not provided"}</td>
                          <td>{commission.commission_status ?? "expected"}</td>
                          <td>{formatMoney(commission.full_commission_amount)}</td>
                          <td>{commission.agency_commission_percent ?? 90}%</td>
                          <td>{formatMoney(expectedCommission)}</td>
                          <td>{formatMoney(commission.received_commission_amount)}</td>
                          <td>{formatDate(commission.expected_payment_date)}</td>
                          <td>{formatDate(commission.received_payment_date)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Link
                                href={`/admin/commissions/${commission.id}`}
                                style={{
                                  color: "var(--accent-dark)",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                Open
                              </Link>

                              {commission.commission_status !== "received" ? (
                                <button
                                  type="submit"
                                  form="mark-trip-commission-received-form"
                                  name="commission_id"
                                  value={commission.id}
                                  className="btn btn-primary"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 12,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  Mark Received
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CollapsibleSection>

        <div
          className="admin-trip-relationship-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div className="stack">
        <span id="trip-messages" />
        <div
          className="card stack"
          style={{
            border: "1px solid #e6f0f2",
            background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                }}
              >
                Trip Messages
              </p>
              <h2 style={{ margin: "6px 0 0" }}>Message activity for this trip</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                See private advisor threads tied to this trip.
              </p>
            </div>

            <Link href={tripMessagesHref} className="btn btn-primary">
              Open Trip Messages
            </Link>
          </div>

          {tripMessageThreadsError ? (
            <div className="card" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <p style={{ margin: 0, fontWeight: 800, color: "#c2410c" }}>
                Message summary needs review.
              </p>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(tripMessageThreadsError, null, 2)}</pre>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
                <TripMessageSummaryCard
                  title="Private Advisor Threads"
                  value={privateTripMessageThreads.length}
                  helper="One-on-one client/advisor conversations tied to this trip."
                  href={privateTripMessagesHref}
                  cta="Open Private Messages"
                  tone={privateTripMessageThreads.length > 0 ? "neutral" : "warning"}
                />

                <TripMessageSummaryCard
                  title="Unread for Admin"
                  value={tripMessageUnreadTotal}
                  helper="Client or companion messages waiting for your review."
                  href={tripMessagesHref}
                  cta="Review Inbox"
                  tone={tripMessageUnreadTotal > 0 ? "warning" : "good"}
                />
              </div>

              {mostRecentTripMessageThread ? (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    background: "#f7fbfc",
                    border: "1px solid #e6f0f2",
                    color: "#667085",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--accent-dark)" }}>Most recent:</strong>{" "}
                  {mostRecentTripMessageThread.subject} • {mostRecentTripMessageThread.thread_type === "trip_group" ? "Travel Circle" : "Private"} • {mostRecentTripMessageThread.status}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  No private advisor messages are tied to this trip yet.
                </p>
              )}
            </>
          )}
        </div>
          </div>

          <div className="stack">
        <span id="travel-companions" />
        <div
          className="card stack"
          style={{
            border: "1px solid #e6f0f2",
            background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                }}
              >
                Booking People
              </p>
              <h2 style={{ margin: "6px 0 0" }}>Main client and Travel Circle</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                Keep the booking assigned to one main client, then add registered clients who should have shared trip access.
              </p>
            </div>

            <CommandStatusBadge tone={tripMembersError ? "warning" : activeTripMemberRows.length > 0 ? "good" : "warning"}>
              {tripMembersError
                ? "Review"
                : `${activeTripMemberRows.length} member${activeTripMemberRows.length === 1 ? "" : "s"}`}
            </CommandStatusBadge>
          </div>

          {tripMembersError ? (
            <div className="card">
              <p>
                <strong>Error loading Travel Companions:</strong>
              </p>
              <pre>{JSON.stringify(tripMembersError, null, 2)}</pre>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
                <CommandStatCard
                  label="Main Client"
                  value={ownerTripMembers.length}
                  helper={getClientDisplayName(clientInfo)}
                />
                <CommandStatCard
                  label="Added People"
                  value={activeCompanionRows.length}
                  helper="Shared trip access"
                />
                <CommandStatCard
                  label="Pending"
                  value={invitedTripMembers.length}
                  helper="Legacy invited access"
                />
              </div>

              <div className="card stack" style={{ background: "#ffffff", border: "1px solid #e6f0f2" }}>
                <h3 style={{ margin: 0 }}>Add someone to the booking</h3>
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  Add a registered Cozy Concierge client. To change the main client, use Trip Overview.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <label>
                    <span className="label">Registered Client</span>
                    <select
                      className="select"
                      form="add-trip-companion-form"
                      name="companion_client_account_id"
                      defaultValue=""
                    >
                      <option value="">Choose a client...</option>
                      {registeredClientOptions.map((client) => {
                        const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
                        return (
                          <option key={client.id} value={client.id}>
                            {name || client.email || "Unnamed Client"}{client.email ? ` - ${client.email}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label>
                    <span className="label">Access Level</span>
                    <select
                      className="select"
                      form="add-trip-companion-form"
                      name="companion_role"
                      defaultValue="viewer"
                    >
                      <option value="viewer">Viewer — read only</option>
                      <option value="contributor">Contributor — shared participation</option>
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  form="add-trip-companion-form"
                  className="btn btn-primary"
                  style={{ alignSelf: "flex-start" }}
                >
                  Add to Booking
                </button>
              </div>

              {activeTripMemberRows.length === 0 ? (
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  No additional people are linked yet. The main client is assigned in Trip Overview.
                </p>
              ) : (
                <div className="stack">
                  {invitedTripMembers.length > 0 ? (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: 12,
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        color: "#9a3412",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Legacy pending access:</strong> Ask companions to create or log into Cozy Concierge with the invited email address. Their shared trip access will activate automatically.
                    </div>
                  ) : null}

                  <div className="grid grid-2">
                    {activeTripMemberRows.map((member) => (
                      <TripCompanionCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  lineHeight: 1.6,
                }}
              >
                <strong>Privacy note:</strong> Added people are for shared trip visibility only. Personal client documents like passports, traveler numbers, and loyalty data should remain private unless intentionally shared.
              </div>
            </>
          )}
        </div>
          </div>
        </div>

        <style>{"@media (max-width: 980px) { .admin-trip-relationship-grid { grid-template-columns: 1fr !important; } }"}</style>
        <span id="document-readiness" />
        <div
          className="card stack"
          style={{
            border: "1px solid #e6f0f2",
            background: "linear-gradient(135deg, #ffffff 0%, #f7fbfc 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                }}
              >
                Document Readiness
              </p>
              <h2 style={{ margin: "6px 0 0" }}>Trip document checklist</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                A quick check of client documents, trip attachments, passport files, insurance docs, and document-related milestones.
              </p>
            </div>

            <CommandStatusBadge
              tone={
                (attachedTripDocumentRows.length > 0 || tripDocumentRows.length > 0) &&
                (clientDocumentsCollectedMilestone?.is_completed || clientDocumentRows.length > 0 || tripDocumentRows.length > 0)
                  ? "good"
                  : "warning"
              }
            >
              {attachedTripDocumentRows.length > 0 || tripDocumentRows.length > 0 ? "Docs attached" : "Needs review"}
            </CommandStatusBadge>
          </div>

          <div className="grid grid-3">
            <CommandStatCard
              label="Client Documents"
              value={clientDocumentsError ? "Review" : clientDocumentRows.length}
              helper={clientDocumentsError ? "Could not check client documents" : "Files in client document library"}
            />

            <CommandStatCard
              label="Attached to Trip"
              value={attachedTripDocumentsError ? "Review" : attachedTripDocumentRows.length}
              helper={attachedTripDocumentsError ? "Could not check trip attachments" : "Client passports/docs linked to this trip"}
            />

            <CommandStatCard
              label="Trip Documents"
              value={tripDocumentsError ? "Review" : tripDocumentRows.length}
              helper={tripDocumentsError ? "Could not check trip documents" : "Advisor and generated files on this trip"}
            />

            <CommandStatCard
              label="Passport File"
              value={hasPassportDocument ? "Yes" : "No"}
              helper={hasPassportDocument ? "Passport document found" : "No passport document found"}
            />
          </div>

          <div className="grid grid-2">
            {documentReadinessItems.map((item) => (
              <DocumentReadinessCard
                key={item.title}
                title={item.title}
                status={item.status}
                helper={item.helper}
                tone={item.tone}
                href={item.href}
                cta={item.cta}
              />
            ))}
          </div>
        </div>

        <span id="trip-snapshot" />
        <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                }}
              >
                Trip Snapshot
              </p>
              <h2 style={{ margin: "6px 0 0" }}>Readable booking summary</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                A quick, read-only view of what is currently entered before you open the detailed edit sections.
              </p>
            </div>

            <CommandStatusBadge tone={activeTripComponents.length > 0 ? "neutral" : "warning"}>
              {activeTripComponents.length} active component{activeTripComponents.length === 1 ? "" : "s"}
            </CommandStatusBadge>
          </div>

          <div className="grid grid-2">
            <SnapshotCard
              title="Hotel"
              href="#hotel-component"
              status={
                <CommandStatusBadge tone={hotel.component ? "neutral" : "warning"}>
                  {hotel.component ? hotel.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Hotel" value={hotel.details?.hotel_name ?? hotel.component?.display_name ?? "Not provided"} />
              <SnapshotRow label="Check-in" value={formatDate(hotel.details?.check_in_date, "Not provided")} />
              <SnapshotRow label="Check-out" value={formatDate(hotel.details?.check_out_date, "Not provided")} />
              <SnapshotRow label="Room" value={hotel.details?.room_category ?? "Not provided"} />
              <SnapshotRow label="Confirm #" value={hotel.component?.confirmation_number ?? "Missing"} />
            </SnapshotCard>

            <SnapshotCard
              title="Air"
              href="#air-component"
              status={
                <CommandStatusBadge tone={air.component ? "neutral" : "warning"}>
                  {air.component ? air.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Supplier" value={air.component?.supplier_name ?? "Not provided"} />
              <SnapshotRow
                label="Outbound"
                value={
                  outboundSegment
                    ? `${outboundSegment.departure_airport_code ?? "???"} → ${outboundSegment.destination_airport_code ?? "???"}`
                    : "Not provided"
                }
              />
              <SnapshotRow
                label="Return"
                value={
                  returnSegment
                    ? `${returnSegment.departure_airport_code ?? "???"} → ${returnSegment.destination_airport_code ?? "???"}`
                    : "Not provided"
                }
              />
              <SnapshotRow label="Locator" value={air.details?.airline_locator ?? "Not provided"} />
              <SnapshotRow label="Confirm #" value={air.component?.confirmation_number ?? "Missing"} />
            </SnapshotCard>

            <SnapshotCard
              title="Cruise"
              href="#cruise-component"
              status={
                <CommandStatusBadge tone={cruise.component ? "neutral" : "warning"}>
                  {cruise.component ? cruise.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Line" value={cruise.details?.cruise_line ?? cruise.component?.supplier_name ?? "Not provided"} />
              <SnapshotRow label="Ship" value={cruise.details?.ship_name ?? "Not provided"} />
              <SnapshotRow label="Sailing" value={formatDate(cruise.details?.sailing_date, "Not provided")} />
              <SnapshotRow label="Return" value={formatDate(cruise.details?.return_date, "Not provided")} />
              <SnapshotRow label="Confirm #" value={cruise.component?.confirmation_number ?? "Missing"} />
            </SnapshotCard>

            <SnapshotCard
              title="Transfer"
              href="#transfer-component"
              status={
                <CommandStatusBadge tone={transfer.component ? "neutral" : "warning"}>
                  {transfer.component ? transfer.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Supplier" value={transfer.details?.supplier_name ?? transfer.component?.supplier_name ?? "Not provided"} />
              <SnapshotRow label="Pickup" value={transfer.details?.pickup_location ?? "Not provided"} />
              <SnapshotRow label="Drop-off" value={transfer.details?.dropoff_location ?? "Not provided"} />
              <SnapshotRow label="Vehicle" value={transfer.details?.vehicle_type ?? "Not provided"} />
              <SnapshotRow label="Confirm #" value={transfer.component?.confirmation_number ?? "Missing"} />
            </SnapshotCard>

            <SnapshotCard
              title="Activity"
              href="#activity-component"
              status={
                <CommandStatusBadge tone={activity.component ? "neutral" : "warning"}>
                  {activity.component ? activity.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Activity" value={activity.details?.activity_name ?? activity.component?.display_name ?? "Not provided"} />
              <SnapshotRow label="Supplier" value={activity.details?.supplier_name ?? activity.component?.supplier_name ?? "Not provided"} />
              <SnapshotRow label="Date/Time" value={activity.details?.activity_datetime ? formatDate(activity.details.activity_datetime) : "Not provided"} />
              <SnapshotRow label="Location" value={activity.details?.location ?? "Not provided"} />
              <SnapshotRow label="Confirm #" value={activity.component?.confirmation_number ?? "Missing"} />
            </SnapshotCard>

            <SnapshotCard
              title="Insurance"
              href="#insurance-component"
              status={
                <CommandStatusBadge tone={insurance.component ? "neutral" : "warning"}>
                  {insurance.component ? insurance.component.booking_status ?? "added" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Provider" value={insurance.details?.provider_name ?? insurance.component?.supplier_name ?? "Not provided"} />
              <SnapshotRow label="Plan" value={insurance.details?.plan_name ?? "Not provided"} />
              <SnapshotRow label="Policy #" value={insurance.details?.policy_number ?? insurance.component?.confirmation_number ?? "Missing"} />
              <SnapshotRow label="Premium" value={insurance.details?.premium_amount ? formatMoney(Number(insurance.details.premium_amount)) : "Not provided"} />
              <SnapshotRow label="Coverage" value={insurance.details?.coverage_start_date || insurance.details?.coverage_end_date ? `${formatDate(insurance.details?.coverage_start_date, "?")} to ${formatDate(insurance.details?.coverage_end_date, "?")}` : "Not provided"} />
            </SnapshotCard>

            <SnapshotCard
              title="Commissions"
              href="#commissions"
              status={
                <CommandStatusBadge tone={commissionOutstandingTotal > 0 ? "warning" : "good"}>
                  {commissionOutstandingTotal > 0 ? "outstanding" : "current"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Records" value={commissionRows.length} />
              <SnapshotRow label="Full" value={formatMoney(commissionFullTotal)} />
              <SnapshotRow label="Expected" value={formatMoney(commissionExpectedTotal)} />
              <SnapshotRow label="Received" value={formatMoney(commissionReceivedTotal)} />
              <SnapshotRow label="Outstanding" value={formatMoney(commissionOutstandingTotal)} />
            </SnapshotCard>

            <SnapshotCard
              title="Notes"
              href="#trip-notes"
              status={
                <CommandStatusBadge tone={internalNote || clientNote || clientReminder ? "neutral" : "warning"}>
                  {internalNote || clientNote || clientReminder ? "started" : "not added"}
                </CommandStatusBadge>
              }
            >
              <SnapshotRow label="Internal" value={internalNote?.title ?? "Not provided"} />
              <SnapshotRow label="Client Note" value={clientNote?.title ?? "Not provided"} />
              <SnapshotRow label="Reminder" value={clientReminder?.title ?? "Not provided"} />
              <SnapshotRow label="Client" value={getClientDisplayName(clientInfo)} />
              <SnapshotRow label="Email" value={clientInfo?.email ?? "Not provided"} />
            </SnapshotCard>
          </div>
        </div>

        <span id="trip-notes" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Notes" badge={clientReminder ? "Reminder added" : "Needs reminder"} tone={clientReminder ? "good" : "warning"} />}>
          <div
            className="card stack"
            style={{
              background: "#f7fbfc",
              border: "1px solid #d9ecf2",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
                AI Itinerary Summary
              </p>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 13 }}>
                Generates a polished client note from saved hotel, air, cruise, transfer, activity, and insurance components.
              </p>
            </div>
            <button
              type="submit"
              formAction={generateTripItinerarySummary}
              className="btn btn-outline"
              style={{ alignSelf: "flex-start" }}
            >
              Generate Client Itinerary Summary
            </button>
          </div>

          {insuranceWaiverNote ? (
            <div
              className="card stack"
              style={{
                background: "#eff6ff",
                border: "1px solid #dbeafe",
                color: "#1e3a8a",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>{insuranceWaiverNote.title ?? "Travel Insurance Waiver"}</h3>
                <p style={{ margin: "6px 0 0", color: "#1e40af", fontSize: 13 }}>
                  Saved when the client answered the travel insurance question.
                </p>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {insuranceWaiverNote.content}
              </p>
            </div>
          ) : null}

          <div className="card stack" style={{ background: "#fffaf0" }}>
            <h3 style={{ margin: 0 }}>Internal Notes</h3>

            <label>
              <span className="label">Title</span>
              <input
                className="input"
                name="internal_note_title"
                defaultValue={internalNote?.title ?? ""}
              />
            </label>

            <label>
              <span className="label">Content</span>
              <textarea
                className="textarea"
                name="internal_note_content"
                defaultValue={internalNote?.content ?? ""}
              />
            </label>
          </div>

          <div className="card stack" style={{ background: "#f7fbfc" }}>
            <h3 style={{ margin: 0 }}>Client Notes</h3>

            <label>
              <span className="label">Title</span>
              <input
                className="input"
                name="client_note_title"
                defaultValue={clientNote?.title ?? ""}
              />
            </label>

            <label>
              <span className="label">Content</span>
              <textarea
                className="textarea"
                name="client_note_content"
                defaultValue={clientNote?.content ?? ""}
              />
            </label>
          </div>

          <div className="card stack" style={{ background: "#f0f7f8" }}>
            <h3 style={{ margin: 0 }}>Important Client Reminders</h3>

            <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>
              These reminders will appear near the top of the client-facing trip page.
              Use this for trip-specific reminders like passport validity, printed
              vouchers, cruise documents, resort requirements, or minor travel consent
              notes.
            </p>

            <label>
              <span className="label">Reminder Title</span>
              <input
                className="input"
                name="client_reminder_title"
                defaultValue={clientReminder?.title ?? ""}
                placeholder="Example: Important Reminders Before You Travel"
              />
            </label>

            <label>
              <span className="label">Reminder Content</span>
              <textarea
                className="textarea"
                name="client_reminder_content"
                defaultValue={clientReminder?.content ?? ""}
                placeholder="Example: Please confirm passport validity, bring your cruise boarding documents, and keep your transfer voucher handy."
              />
            </label>
          </div>
        

          <SectionSaveButton label="Notes" />
        </CollapsibleSection>

        <div
          className="card stack"
          style={{
            border: "1px solid #fecaca",
            background: "#fff7f7",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 900, color: "#be123c" }}>
              Trip Deletion Controls
            </p>
            <p style={{ margin: "6px 0 0", color: "#7f1d1d", lineHeight: 1.6 }}>
              This section is intentionally at the bottom so trip editing stays focused.
              Normal delete is a recoverable soft delete. Override delete permanently
              removes the trip and its trip-only records.
            </p>
          </div>

          {(deletionRequested || tripDeleted) ? (
            <div
              className="card"
              style={{
                border: tripDeleted ? "1px solid #fecaca" : "1px solid #fed7aa",
                background: tripDeleted ? "#fef2f2" : "#fff7ed",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 900, color: tripDeleted ? "#b42318" : "#9a3412" }}>
                    {tripDeleted ? "Trip is soft deleted" : "Client requested trip deletion"}
                  </p>
                  <p style={{ margin: "5px 0 0", color: tripDeleted ? "#b42318" : "#9a3412", fontSize: 13, lineHeight: 1.5 }}>
                    {tripDeleted
                      ? `Deleted on ${formatDate(trip.deleted_at, "an unknown date")}. Restore it if this trip should return to active records.`
                      : `Requested by ${trip.deletion_requested_by ?? "client"} on ${formatDate(trip.deletion_requested_at, "an unknown date")}. ${deletionEligibility.reason}.`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tripDeleted ? (
                    <button type="submit" form="restore-trip-detail-form" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>
                      Restore Trip
                    </button>
                  ) : (
                    <>
                      {deletionEligibility.allowed ? (
                        <button type="submit" form="soft-delete-trip-detail-form" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px", background: "#be123c" }}>
                          Approve Soft Delete
                        </button>
                      ) : null}
                      <button type="submit" form="dismiss-trip-deletion-request-detail-form" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>
                        Dismiss Request
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!tripDeleted && deletionEligibility.allowed ? (
            <button
              type="submit"
              form="soft-delete-trip-detail-form"
              className="btn btn-outline"
              style={{ color: "#be123c", borderColor: "#fecaca", alignSelf: "flex-start" }}
            >
              Soft Delete Trip
            </button>
          ) : null}

          {(tripDeleted || !deletionEligibility.allowed) ? (
            <div
              className="card stack"
              style={{
                border: "1px solid #fecaca",
                background: "#fff1f2",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#be123c" }}>Override Permanent Delete</h3>
                <p style={{ margin: "6px 0 0", color: "#9f1239", lineHeight: 1.6 }}>
                  {tripDeleted
                    ? "This permanently removes the soft-deleted trip from the database."
                    : `Normal deletion is blocked because this trip has protected activity: ${deletionEligibility.reason}.`}
                  {" "}Use this only for clearing test data before launch. It deletes trip messages,
                  Travel Circle access, trip documents, payment records, components,
                  commissions, notes, milestones, and the trip record itself. Client
                  passports and client documents are not deleted; only their trip links
                  are removed.
                </p>
              </div>

              <label className="stack-sm" style={{ maxWidth: 420 }}>
                <span className="label" style={{ color: "#9f1239" }}>
                  Type OVERRIDE DELETE TRIP
                </span>
                <input
                  className="input"
                  name="override_confirmation"
                  form="override-hard-delete-trip-detail-form"
                  placeholder="OVERRIDE DELETE TRIP"
                />
              </label>

              <button
                type="submit"
                form="override-hard-delete-trip-detail-form"
                className="btn btn-outline"
                style={{ color: "#be123c", borderColor: "#fecaca", alignSelf: "flex-start" }}
              >
                Override and Permanently Delete Trip
              </button>
            </div>
          ) : null}
        </div>

        <div className="row">
          <button type="submit" name="save_section" value="trip" className="btn btn-primary">
            Save Trip
          </button>

          <Link href={`/admin/trips/${trip.id}/documents`} className="btn btn-primary">
            Manage Documents
          </Link>

          <Link href="/admin/trips" className="btn btn-primary">
            Back to Trips
          </Link>
        </div>
      </form>
    </PageShell>
  );
}






