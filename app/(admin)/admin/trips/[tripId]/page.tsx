import type { ReactNode } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { AirportPicker } from "@/components/forms/airport-picker";
import { AirlinePicker } from "@/components/forms/airline-picker";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";

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

const allowedBookingStatuses = ["on_hold", "reserved", "quoted"];

const defaultTripMilestones = [
  { title: "Quote requested", description: "Initial client request or inquiry has been received." },
  { title: "Trip created", description: "Trip record has been created in Cozy Concierge." },
  { title: "Deposit paid", description: "Client deposit has been paid or marked as not required." },
  { title: "Travel insurance offered", description: "Travel protection has been offered and documented." },
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

type ClientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

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

function toMoneyNumber(value: FormDataEntryValue | null, fallback = 0) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return fallback;

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid number submitted.");
  }

  return numberValue;
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
  supplierId,
  bookingNumber,
  commissionName,
  grossBookingAmount,
  fullCommissionAmount,
}: {
  tripId: string;
  supplierId?: string | null;
  bookingNumber?: string | null;
  commissionName?: string | null;
  grossBookingAmount?: string | number | null;
  fullCommissionAmount?: string | number | null;
}) {
  const params = new URLSearchParams();

  params.set("tripId", tripId);

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
  supplierId,
  bookingNumber,
  commissionName,
  grossBookingAmount,
  fullCommissionAmount,
}: {
  tripId: string;
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
            Attach Client Docs
          </Link>
          <Link href={`/admin/trips/${tripId}/documents`} className="btn btn-primary">
            View Trip Docs
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
          Timeline
        </a>
        <a href="#trip-snapshot" style={sectionLinkStyle}>
          Snapshot
        </a>
        <a href="#document-readiness" style={sectionLinkStyle}>
          Documents
        </a>
        <a href="#travel-companions" style={sectionLinkStyle}>
          Companions
        </a>
        <a href="#trip-messages" style={sectionLinkStyle}>
          Messages
        </a>
        <a href="#trip-overview" style={sectionLinkStyle}>
          Overview
        </a>
        <a href="#commissions" style={sectionLinkStyle}>
          Money
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
      return "Pending Invitation";
    case "declined":
      return "Declined Invitation";
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
    return "Primary trip owner. This access is tied to the lead client for the trip.";
  }

  if (member.invite_status === "invited") {
    return `Invite pending. Ask them to create or log into Cozy Concierge using ${getTripMemberEmail(member)}, then open Travel Invitations to accept shared trip access.`;
  }

  if (member.invite_status === "active") {
    return "Active access. This companion can open shared trip details, shared documents, and Travel Circle messages based on their role.";
  }

  if (member.invite_status === "declined") {
    return "This invitation was declined. Add them again if they need access later.";
  }

  return "Travel Circle access is managed from this section.";
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {member.can_join_group_messages ? (
          <CommandStatusBadge tone="neutral">Group messages</CommandStatusBadge>
        ) : null}
        {member.can_view_shared_documents ? (
          <CommandStatusBadge tone="neutral">Shared docs</CommandStatusBadge>
        ) : null}
        {member.can_upload_own_documents ? (
          <CommandStatusBadge tone="neutral">Can upload own docs</CommandStatusBadge>
        ) : null}
      </div>

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
          {isPendingInvite ? "Cancel Invitation" : "Remove Companion"}
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
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
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

      <a
        href={href}
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
      </a>
    </div>
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
      <span style={{ lineHeight: 1.45 }}>{value === null || value === undefined || value === "" ? "Not provided" : value}</span>
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
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid #e6f0f2",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>{title}</p>
        <CommandStatusBadge tone={tone}>{status}</CommandStatusBadge>
      </div>

      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>{helper}</p>

      <a
        href={href}
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
      </a>
    </div>
  );
}

async function addTripCompanion(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const email = String(formData.get("companion_email") ?? "").trim().toLowerCase();
  const inviteName = String(formData.get("companion_name") ?? "").trim() || null;
  const role = requireAllowedValue(
    String(formData.get("companion_role") ?? "viewer").trim(),
    ["viewer", "contributor"],
    "viewer",
  );

  if (!tripId) throw new Error("Missing trip ID.");
  if (!email) throw new Error("Companion email is required.");

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
    .select("id, first_name, last_name, email")
    .ilike("email", email)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);

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
    client_account_id: existingClient?.id ?? null,
    invite_email: existingClient?.email ?? email,
    invite_name:
      inviteName ||
      (existingClient
        ? `${existingClient.first_name ?? ""} ${existingClient.last_name ?? ""}`.trim() || null
        : null),
    role,
    invite_status: existingClient ? "active" : "invited",
    invited_by_type: "admin",
    ...rolePermissions,
    updated_at: new Date().toISOString(),
  };

  let existingMemberQuery: any = supabase
    .from("trip_members" as any)
    .select("id")
    .eq("trip_id", tripId)
    .neq("invite_status", "removed");

  if (existingClient?.id) {
    existingMemberQuery = existingMemberQuery.eq("client_account_id", existingClient.id);
  } else {
    existingMemberQuery = existingMemberQuery.ilike("invite_email", email);
  }

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

  if (!existingClient) {
    await sendTravelCircleInviteEmail({
      to: email,
      inviteName,
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

async function updateTrip(formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const { supabase } = await requireAdmin();

  const { data: existingTrip, error: existingTripError } = await supabase
    .from("trips")
    .select("id")
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

  const tripUpdates = {
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

  const proposalUpdates = {
    planning_fee: toMoneyNumber(formData.get("planning_fee")),
    total_price: toMoneyNumber(formData.get("total_price")),
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

      if (componentUpdateError) throw new Error(componentUpdateError.message);
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

  const hotelDetailPayload = {
    hotel_name: hotelName || null,
    hotel_address: String(formData.get("hotel_address") ?? "").trim() || null,
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
    hotelDetailPayload.hotel_address ||
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
    cruiseDetailPayload.sailing_date ||
    cruiseDetailPayload.return_date ||
    cruiseDetailPayload.departure_port ||
    cruiseConfirmationNumber;

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
  const transferPickupLocation =
    String(formData.get("transfer_pickup_location") ?? "").trim() || null;
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
      terms_and_conditions: transferTerms,
      cancellation_policy: transferCancellation,
    },
    "transfer_components",
    transferDetailPayload,
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
  const activityLocation =
    String(formData.get("activity_location") ?? "").trim() || null;
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

  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/admin/trips");
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

export default async function AdminTripEditorPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
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

  const { data: tripCommissions, error: tripCommissionsError } = await supabase
    .from("commissions")
    .select(
      "id, commission_name, booking_number, supplier_name_snapshot, full_commission_amount, agency_commission_percent, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date",
    )
    .eq("trip_id", tripId)
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
  const clientDocumentRows = (clientDocuments ?? []) as ClientDocumentRow[];
  const attachedTripDocumentRows = (attachedTripDocuments ?? []) as TripAttachedDocumentRow[];
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
  const travelCircleMessageThreads = tripMessageThreadRows.filter(
    (thread) => thread.thread_type === "trip_group",
  );
  const tripMessageUnreadTotal = tripMessageThreadRows.reduce(
    (total, thread) => total + Number(thread.admin_unread_count ?? 0),
    0,
  );
  const mostRecentTripMessageThread = tripMessageThreadRows[0] ?? null;
  const mostRecentPrivateTripMessageThread = privateTripMessageThreads[0] ?? null;
  const mostRecentTravelCircleMessageThread = travelCircleMessageThreads[0] ?? null;
  const tripMessagesHref = mostRecentTripMessageThread
    ? `/admin/messages?threadId=${mostRecentTripMessageThread.id}`
    : "/admin/messages";
  const privateTripMessagesHref = mostRecentPrivateTripMessageThread
    ? `/admin/messages?threadId=${mostRecentPrivateTripMessageThread.id}&type=private`
    : "/admin/messages?type=private";
  const travelCircleMessagesHref = mostRecentTravelCircleMessageThread
    ? `/admin/messages?threadId=${mostRecentTravelCircleMessageThread.id}&type=trip_group`
    : "/admin/messages?type=trip_group";

  const hasPassportDocument = clientDocumentRows.some(
    (document) => document.document_type === "passport",
  );
  const hasInsuranceDocument = clientDocumentRows.some(
    (document) => document.document_type === "insurance",
  );
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
      status: insurance.component || hasInsuranceDocument ? "Started" : "Missing",
      helper: insurance.component
        ? "Insurance details have been added as a trip component."
        : hasInsuranceDocument
          ? "Insurance document exists in the client document library."
          : "No insurance component or insurance document is currently attached.",
      tone: insurance.component || hasInsuranceDocument ? "good" : "warning",
      href: insurance.component ? "#insurance-component" : clientInfo?.id ? `/admin/clients/${clientInfo.id}/documents` : "#insurance-component",
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
    !insurance.component
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

      <form action={updateTrip} className="stack">
        <input type="hidden" name="trip_id" value={trip.id} />

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

          <div className="grid grid-3">
            <CommandStatCard
              label="Trip Status"
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
              helper="Current trip workflow status"
            />

            <CommandStatCard
              label="Milestones"
              value={`${milestoneCompleted} / ${milestoneTotal}`}
              helper={`${milestonePercent}% complete`}
            />

            <CommandStatCard
              label="Balance Due"
              value={formatMoney(balanceDue)}
              helper={trip.final_payment_due_date ? `Final due ${formatDate(trip.final_payment_due_date)}` : "No final due date"}
            />
          </div>

          <div className="grid grid-3">
            <CommandStatCard
              label="Trip Components"
              value={`${activeTripComponents.length} active`}
              helper={`${componentsWithConfirmations.length} with confirmations`}
            />

            <CommandStatCard
              label="Commission Outstanding"
              value={formatMoney(commissionOutstandingTotal)}
              helper={`${commissionRows.length} commission record${commissionRows.length === 1 ? "" : "s"}`}
            />

            <CommandStatCard
              label="Total Paid"
              value={formatMoney(totalPaid)}
              helper="Recorded client payments"
            />
          </div>

          <div className="grid grid-3">
            <CommandStatCard
              label="Travel Companions"
              value={tripMembersError ? "Review" : activeTripMemberRows.length}
              helper={
                tripMembersError
                  ? "Could not load companions"
                  : `${activeCompanionRows.length} companion${activeCompanionRows.length === 1 ? "" : "s"}, ${ownerTripMembers.length} owner${ownerTripMembers.length === 1 ? "" : "s"}`
              }
            />

            <CommandStatCard
              label="Pending Invites"
              value={tripMembersError ? "Review" : invitedTripMembers.length}
              helper="Travel Circle invitations not yet connected"
            />

            <CommandStatCard
              label="Trip Messages"
              value={tripMessageThreadsError ? "Review" : tripMessageThreadRows.length}
              helper={
                tripMessageThreadsError
                  ? "Could not load message summary"
                  : `${privateTripMessageThreads.length} private, ${travelCircleMessageThreads.length} Travel Circle, ${tripMessageUnreadTotal} unread`
              }
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
                See private advisor threads and Travel Circle group conversations tied to this trip.
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
              <div className="grid grid-3">
                <TripMessageSummaryCard
                  title="Private Advisor Threads"
                  value={privateTripMessageThreads.length}
                  helper="One-on-one client/advisor conversations tied to this trip."
                  href={privateTripMessagesHref}
                  cta="Open Private Messages"
                  tone={privateTripMessageThreads.length > 0 ? "neutral" : "warning"}
                />

                <TripMessageSummaryCard
                  title="Travel Circle Threads"
                  value={travelCircleMessageThreads.length}
                  helper="Shared group conversations visible to approved companions."
                  href={travelCircleMessagesHref}
                  cta="Open Travel Circle"
                  tone={travelCircleMessageThreads.length > 0 ? "good" : "warning"}
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
                  No messages are tied to this trip yet. Once clients use the private or Travel Circle buttons, activity will appear here.
                </p>
              )}
            </>
          )}
        </div>

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
                Travel Companions
              </p>
              <h2 style={{ margin: "6px 0 0" }}>Your Travel Circle</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
                Manage who can access shared details for this trip. Viewer access is read-only;
                contributor access is ready for future shared uploads and group messaging.
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
              <div className="grid grid-3">
                <CommandStatCard
                  label="Owners"
                  value={ownerTripMembers.length}
                  helper="Lead client access"
                />
                <CommandStatCard
                  label="Companions"
                  value={activeCompanionRows.length}
                  helper="Viewer or contributor access"
                />
                <CommandStatCard
                  label="Pending Invites"
                  value={invitedTripMembers.length}
                  helper="Invited by email"
                />
              </div>

              <div className="card stack" style={{ background: "#ffffff", border: "1px solid #e6f0f2" }}>
                <h3 style={{ margin: 0 }}>Add a Travel Companion</h3>
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  Add an existing client by email, or invite someone by email for later account setup.
                  If the email does not already belong to a client account, the invite will stay pending until they register or log in with that same email and open Travel Invitations.
                </p>

                <div className="grid grid-3">
                  <label>
                    <span className="label">Companion Email</span>
                    <input
                      className="input"
                      form="add-trip-companion-form"
                      name="companion_email"
                      type="email"
                      placeholder="traveler@example.com"
                    />
                  </label>

                  <label>
                    <span className="label">Name / Label</span>
                    <input
                      className="input"
                      form="add-trip-companion-form"
                      name="companion_name"
                      placeholder="Optional display name"
                    />
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
                  Add Travel Companion
                </button>
              </div>

              {activeTripMemberRows.length === 0 ? (
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  No Travel Companions are linked yet. The SQL setup should automatically create an owner row for the primary client.
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
                      <strong>Pending invitation next step:</strong> Ask invited companions to create or log into Cozy Concierge with the invited email address, then open <strong>Travel Invitations</strong> from their client dashboard or navigation.
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
                <strong>Privacy note:</strong> Travel Companions are for shared trip visibility, shared trip documents,
                and future group messaging. Personal client documents like passports, traveler numbers, and loyalty data
                should remain private unless intentionally shared.
              </div>
            </>
          )}
        </div>

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
                attachedTripDocumentRows.length > 0 &&
                (clientDocumentsCollectedMilestone?.is_completed || clientDocumentRows.length > 0)
                  ? "good"
                  : "warning"
              }
            >
              {attachedTripDocumentRows.length > 0 ? "Docs attached" : "Needs review"}
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
              helper={attachedTripDocumentsError ? "Could not check trip attachments" : "Client docs linked to this trip"}
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
        <CollapsibleSection title="Trip Overview" defaultOpen>
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
              <span className="label">Destinations</span>
              <input
                className="input"
                name="destinations"
                defaultValue={trip.destinations ?? ""}
              />
            </label>

            <label>
              <span className="label">Departure Date</span>
              <input
                className="input"
                type="date"
                name="departure_date"
                defaultValue={trip.departure_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Return Date</span>
              <input
                className="input"
                type="date"
                name="return_date"
                defaultValue={trip.return_date ?? ""}
              />
            </label>

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
              <span className="label">Balance Due</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="balance_due"
                defaultValue={trip.balance_due ?? 0}
              />
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
          </div>
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

            <label>
              <span className="label">Total Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                name="total_price"
                defaultValue={proposal?.total_price ?? 0}
              />
            </label>

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

        <span id="hotel-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Hotel Component" badge={hotel.component ? "Added" : "Missing"} tone={hotel.component ? "good" : "warning"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
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
          <div className="grid grid-2">
            <SupplierSelect
              name="hotel_supplier_id"
              suppliers={supplierRows}
              defaultValue={hotel.component?.supplier_id ?? ""}
            />

            <label>
              <span className="label">Hotel Name</span>
              <input
                className="input"
                name="hotel_name"
                defaultValue={hotel.details?.hotel_name ?? ""}
              />
            </label>

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

            <label>
              <span className="label">Hotel Address</span>
              <input
                className="input"
                name="hotel_address"
                defaultValue={hotel.details?.hotel_address ?? ""}
              />
            </label>

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

            <label>
              <span className="label">Check-in</span>
              <input
                className="input"
                type="date"
                name="hotel_check_in_date"
                defaultValue={hotel.details?.check_in_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Check-out</span>
              <input
                className="input"
                type="date"
                name="hotel_check_out_date"
                defaultValue={hotel.details?.check_out_date ?? ""}
              />
            </label>

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
        </CollapsibleSection>

        <span id="air-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Air Component" badge={air.component ? "Added" : "Missing"} tone={air.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
            supplierId={air.component?.supplier_id ?? ""}
            bookingNumber={air.component?.confirmation_number ?? ""}
            commissionName={`${air.component?.supplier_name ?? "Air"} Commission`}
            grossBookingAmount={air.component?.total_price ?? 0}
            fullCommissionAmount={air.component?.commission_admin_only ?? 0}
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
        </CollapsibleSection>

        <span id="cruise-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Cruise Component" badge={cruise.component ? "Added" : "Missing"} tone={cruise.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
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

            <label>
              <span className="label">Sailing Date</span>
              <input
                className="input"
                type="date"
                name="cruise_sailing_date"
                defaultValue={cruise.details?.sailing_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Return Date</span>
              <input
                className="input"
                type="date"
                name="cruise_return_date"
                defaultValue={cruise.details?.return_date ?? ""}
              />
            </label>

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
        </CollapsibleSection>

        <span id="transfer-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Transfer Component" badge={transfer.component ? "Added" : "Missing"} tone={transfer.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
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

            <label>
              <span className="label">Pickup Location</span>
              <input
                className="input"
                name="transfer_pickup_location"
                defaultValue={transfer.details?.pickup_location ?? ""}
              />
            </label>

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
        </CollapsibleSection>

        <span id="activity-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Activity Component" badge={activity.component ? "Added" : "Missing"} tone={activity.component ? "good" : "neutral"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
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

            <label>
              <span className="label">Location</span>
              <input
                className="input"
                name="activity_location"
                defaultValue={activity.details?.location ?? ""}
              />
            </label>

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
        </CollapsibleSection>

        <span id="insurance-component" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Insurance Component" badge={insurance.component ? "Added" : "Missing"} tone={insurance.component ? "good" : "warning"} />}>
          <ComponentCommissionLink
            tripId={trip.id}
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

            <label>
              <span className="label">Coverage Start Date</span>
              <input
                className="input"
                type="date"
                name="insurance_coverage_start_date"
                defaultValue={insurance.details?.coverage_start_date ?? ""}
              />
            </label>

            <label>
              <span className="label">Coverage End Date</span>
              <input
                className="input"
                type="date"
                name="insurance_coverage_end_date"
                defaultValue={insurance.details?.coverage_end_date ?? ""}
              />
            </label>

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
        </CollapsibleSection>

        <span id="trip-notes" />
        <CollapsibleSection title={<SectionTitleWithBadge title="Notes" badge={clientReminder ? "Reminder added" : "Needs reminder"} tone={clientReminder ? "good" : "warning"} />}>
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
        </CollapsibleSection>

        <div className="row">
          <button type="submit" className="btn btn-primary">
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
