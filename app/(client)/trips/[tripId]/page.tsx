import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/layout/page-shell";
import { ClientLinkedDocuments } from "@/components/trips/client-linked-documents";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendTravelCircleInviteEmail } from "@/lib/email/travel-circle-invite";

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

function formatTimelineDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDate(value, fallback);
  }

  return formatDateTime(value, fallback);
}

function getTimelineDateKey(value: string | null | undefined) {
  if (!value) return "unknown";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

type ClientAccountRow = {
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
  can_view_trip: boolean | null;
  can_view_shared_documents: boolean | null;
  can_join_group_messages: boolean | null;
  can_upload_own_documents: boolean | null;
  can_manage_companions: boolean | null;
  created_at: string | null;
  client_accounts:
    | ClientAccountRow
    | ClientAccountRow[]
    | null;
};

type TripRow = {
  id: string;
  client_account_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  final_payment_due_date: string | null;
  occasion?: string | null;
};

type ProposalRow = {
  id: string;
  trip_id: string;
  proposal_title: string | null;
  proposal_welcome_text: string | null;
  proposal_closing_text: string | null;
  planning_fee: number | null;
  total_price: number | null;
};

type TripNoteRow = {
  id: string;
  trip_id: string;
  note_type: string;
  title: string | null;
  content: string | null;
};

type TripComponentRecord = {
  id: string;
  trip_id?: string | null;
  component_type?: string | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  booking_status?: string | null;
  confirmation_number?: string | null;
  total_price?: number | null;
};

type SupplierRecord = {
  id: string;
  supplier_name: string | null;
  supplier_type: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
};

type ComponentDetailsRecord = {
  component_id?: string | null;

  hotel_name?: string | null;
  hotel_address?: string | null;
  hotel_star_rating?: string | number | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  room_category?: string | null;
  room_description?: string | null;
  hotel_description?: string | null;
  nightly_rate?: number | null;

  flight_type?: string | null;
  traveler_count?: number | null;
  rate_class?: string | null;
  airline_locator?: string | null;

  cruise_line?: string | null;
  ship_name?: string | null;
  sailing_date?: string | null;
  return_date?: string | null;
  departure_port?: string | null;
  arrival_port?: string | null;
  cabin_category?: string | null;
  cabin_number?: string | null;
  dining_seating?: string | null;
  cruise_description?: string | null;

  supplier_name?: string | null;
  pickup_datetime?: string | null;
  passenger_count?: number | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  vehicle_type?: string | null;
  transfer_notes?: string | null;

  activity_name?: string | null;
  activity_datetime?: string | null;
  location?: string | null;
  participant_count?: number | null;
  activity_notes?: string | null;

  provider_name?: string | null;
  plan_name?: string | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  insured_traveler_count?: number | null;
  claim_phone?: string | null;
  insurance_notes?: string | null;
};

type FlightSegmentRow = {
  id: string;
  air_component_id?: string | null;
  direction: string | null;
  segment_order?: number | null;
  carrier: string | null;
  flight_number: string | null;
  departure_airport_code: string | null;
  destination_airport_code: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  cabin_class: string | null;
  seat_assignment: string | null;
};

type TripDocumentRow = {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string | null;
};

type TripDocumentWithSignedUrl = TripDocumentRow & {
  signedUrl: string | null;
};

type LoadedTripComponent = {
  component: TripComponentRecord | null;
  details: ComponentDetailsRecord | null;
  supplier: SupplierRecord | null;
  error: unknown | null;
};

type TimelineEvent = {
  dateValue: string;
  icon: string;
  title: string;
  details: string;
};

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

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
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
      user,
      clientAccount: clientAccountByEmail as ClientAccountRow,
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
    user,
    clientAccount: clientAccountByProfile as ClientAccountRow,
  };
}

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function cleanEmail(value: string | null) {
  if (!value) return null;
  return value.trim().toLowerCase() || null;
}

async function requireTripCircleManager(tripId: string) {
  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id, trip_name, destinations, departure_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error("Trip not found or access denied.");
  }

  const isPrimaryClient = trip.client_account_id === clientAccount.id;

  if (isPrimaryClient) {
    return { supabase, clientAccount, trip };
  }

  const { data: managerAccess, error: managerAccessError } = await supabase
    .from("trip_members" as any)
    .select("id, can_manage_companions, invite_status")
    .eq("trip_id", tripId)
    .eq("client_account_id", clientAccount.id)
    .eq("invite_status", "active")
    .maybeSingle();

  if (managerAccessError) {
    throw new Error(managerAccessError.message);
  }

  if (!managerAccess || managerAccess.can_manage_companions !== true) {
    throw new Error("You do not have permission to manage Travel Companions for this trip.");
  }

  return { supabase, clientAccount, trip };
}

async function inviteTravelCompanion(formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!tripId) throw new Error("Missing trip ID.");

  const inviteName = cleanText(formData, "invite_name");
  const inviteEmail = cleanEmail(cleanText(formData, "invite_email"));
  const requestedRole = String(formData.get("role") ?? "viewer").trim();
  const role = requestedRole === "contributor" ? "contributor" : "viewer";

  if (!inviteEmail) {
    throw new Error("Travel Companion email is required.");
  }

  const { supabase, clientAccount, trip } = await requireTripCircleManager(tripId);

  if (inviteEmail === clientAccount.email?.trim().toLowerCase()) {
    throw new Error("You are already connected to this trip.");
  }

  const { data: existingClient, error: existingClientError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, email")
    .ilike("email", inviteEmail)
    .maybeSingle();

  if (existingClientError) {
    throw new Error(existingClientError.message);
  }

  if (existingClient?.id === trip.client_account_id) {
    return;
  }

  let existingMemberQuery = supabase
    .from("trip_members" as any)
    .select("id, invite_status")
    .eq("trip_id", tripId)
    .neq("invite_status", "removed");

  if (existingClient?.id) {
    existingMemberQuery = existingMemberQuery.or(
      `client_account_id.eq.${existingClient.id},invite_email.ilike.${inviteEmail}`,
    );
  } else {
    existingMemberQuery = existingMemberQuery.ilike("invite_email", inviteEmail);
  }

  const { data: existingMembers, error: existingMemberError } = await existingMemberQuery.limit(1);

  if (existingMemberError) {
    throw new Error(existingMemberError.message);
  }

  if ((existingMembers ?? []).length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("trip_members" as any).insert({
    trip_id: tripId,
    client_account_id: existingClient?.id ?? null,
    invite_email: inviteEmail,
    invite_name: inviteName,
    role,
    invite_status: existingClient ? "active" : "invited",
    invited_by_type: "client",
    invited_by_client_account_id: clientAccount.id,
    can_view_trip: true,
    can_view_shared_documents: true,
    can_join_group_messages: true,
    can_upload_own_documents: role === "contributor",
    can_manage_companions: false,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (!existingClient) {
    await sendTravelCircleInviteEmail({
      to: inviteEmail,
      inviteName,
      role,
      tripName: trip.trip_name ?? "Your Trip",
      destinations: trip.destinations,
      departureDate: trip.departure_date,
    });
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}`);
}

async function removeTravelCompanion(formData: FormData) {
  "use server";

  const tripId = String(formData.get("trip_id") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();

  if (!tripId) throw new Error("Missing trip ID.");
  if (!memberId) throw new Error("Missing Travel Companion ID.");

  const { supabase } = await requireTripCircleManager(tripId);

  const { data: member, error: memberError } = await supabase
    .from("trip_members" as any)
    .select("id, role")
    .eq("id", memberId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return;
  }

  if (member.role === "owner") {
    throw new Error("The trip owner cannot be removed from the Travel Circle here.");
  }

  const { error: updateError } = await supabase
    .from("trip_members" as any)
    .update({ invite_status: "removed", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("trip_id", tripId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/admin/trips/${tripId}`);
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      {eyebrow ? (
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </p>
      ) : null}

      <h2 style={{ margin: 0 }}>{title}</h2>

      {subtitle ? (
        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  title,
  eyebrow,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid #e6f0f2",
        borderRadius: 16,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "14px 16px",
          background: "#f7fbfc",
          borderBottom: "1px solid #e6f0f2",
          color: "var(--accent-dark)",
          fontWeight: 800,
        }}
      >
        {eyebrow ? (
          <span
            style={{
              display: "block",
              marginBottom: 4,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </span>
        ) : null}

        {title}

        {subtitle ? (
          <span
            style={{
              display: "block",
              marginTop: 4,
              color: "#667085",
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </summary>

      <div className="card stack" style={{ border: "none", borderRadius: 0 }}>
        {children}
      </div>
    </details>
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
      <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
        {value === null || value === undefined || value === ""
          ? "Not provided"
          : value}
      </p>
    </div>
  );
}

function PriceItem({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return <InfoItem label={label} value={formatMoney(value)} />;
}

function getSupplierDisplayName(
  loadedComponent: LoadedTripComponent,
  fallback?: string | null,
) {
  return (
    loadedComponent.supplier?.supplier_name ??
    loadedComponent.component?.supplier_name ??
    fallback ??
    "Not provided"
  );
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
      }}
    >
      {status ?? "draft"}
    </span>
  );
}

function TravelCompanionBadge({ role }: { role: string | null | undefined }) {
  const normalizedRole = role ?? "viewer";
  const tone =
    normalizedRole === "owner"
      ? { background: "#ecfdf3", color: "#027a48" }
      : normalizedRole === "contributor"
        ? { background: "#f0f7f8", color: "var(--accent-dark)" }
        : { background: "#f8fafc", color: "#475569" };

  const label =
    normalizedRole === "owner"
      ? "Owner"
      : normalizedRole === "contributor"
        ? "Contributor"
        : "Viewer";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: tone.background,
        color: tone.color,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function getTripMemberAccount(member: TripMemberRow) {
  if (Array.isArray(member.client_accounts)) {
    return member.client_accounts[0] ?? null;
  }

  return member.client_accounts ?? null;
}

function getTripMemberDisplayName(member: TripMemberRow) {
  const account = getTripMemberAccount(member);

  if (account) {
    const name = `${account.first_name ?? ""} ${account.last_name ?? ""}`.trim();
    return name || account.email || "Travel Companion";
  }

  return member.invite_name || member.invite_email || "Invited Companion";
}

function getTripMemberEmail(member: TripMemberRow) {
  const account = getTripMemberAccount(member);
  return account?.email ?? member.invite_email ?? null;
}

function ActionLink({
  href,
  className,
  children,
  target,
  rel,
}: {
  href: string;
  className: string;
  children: ReactNode;
  target?: string;
  rel?: string;
}) {
  const sharedStyle = {
    display: "inline-flex",
    flex: "0 0 auto",
    width: "auto",
    minWidth: "unset",
    textAlign: "center" as const,
    justifyContent: "center",
    alignItems: "center",
    whiteSpace: "nowrap" as const,
    lineHeight: 1.25,
  };

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} style={sharedStyle}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      style={sharedStyle}
    >
      {children}
    </a>
  );
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          minWidth: 22,
          borderRadius: 999,
          background: "#f0f7f8",
          color: "var(--accent-dark)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 13,
          marginTop: 1,
        }}
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function TimelineItem({
  icon,
  title,
  date,
  details,
}: {
  icon: string;
  title: string;
  date: string;
  details?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "42px 1fr",
        gap: 12,
        alignItems: "start",
        padding: "12px",
        border: "1px solid #eef2f5",
        borderRadius: 14,
        background: "#fbfdfe",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          background: "#f0f7f8",
          color: "var(--accent-dark)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        {icon}
      </div>

      <div>
        <p style={{ margin: 0, fontWeight: 800 }}>{title}</p>
        <p
          style={{
            margin: "4px 0 0",
            color: "var(--accent-dark)",
            fontWeight: 700,
          }}
        >
          {date}
        </p>
        {details ? (
          <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5 }}>
            {details}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { supabase, clientAccount } = await getCurrentClientAccount();
  const supabaseAdmin = createSupabaseAdminClient();

  const advisorEmail = "jeremyb@cozyadventurevacations.com";
  const agencyWebsite = "https://www.cozyadventurevacations.com";

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Detail" subtitle="We could not load this trip.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>Trip not found or access denied.</p>
        </div>
      </PageShell>
    );
  }

  const tripRow = trip as TripRow;

  const isPrimaryClient = tripRow.client_account_id === clientAccount.id;

  let currentMemberAccess: TripMemberRow | null = null;

  if (!isPrimaryClient) {
    const { data: memberAccess, error: memberAccessError } = await supabase
      .from("trip_members" as any)
      .select("id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, can_view_trip, can_view_shared_documents, can_join_group_messages, can_upload_own_documents, can_manage_companions, created_at")
      .eq("trip_id", tripId)
      .eq("client_account_id", clientAccount.id)
      .eq("invite_status", "active")
      .maybeSingle();

    if (memberAccessError) {
      return (
        <PageShell title="Trip Detail" subtitle="We could not confirm your trip access.">
          <div className="card">
            <p>
              <strong>Error:</strong>
            </p>
            <pre>{JSON.stringify(memberAccessError, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }

    currentMemberAccess = memberAccess as TripMemberRow | null;

    if (!currentMemberAccess || currentMemberAccess.can_view_trip === false) {
      return (
        <PageShell title="Trip Detail" subtitle="We could not load this trip.">
          <div className="card">
            <p>
              <strong>Error:</strong>
            </p>
            <p>Trip not found or access denied.</p>
          </div>
        </PageShell>
      );
    }
  }

  const emailSubject = encodeURIComponent(
    `Question about ${tripRow.trip_name ?? "my trip"}`,
  );

  const travelCircleSubject = encodeURIComponent(
    `${tripRow.trip_name ?? "Trip"} — Travel Circle`,
  );

  const emailBody = encodeURIComponent(
    `Hi Jeremy,\n\nI have a question about my trip: ${tripRow.trip_name ?? ""}\n\n`,
  );

  const { data: proposal, error: proposalError } = await supabase
    .from("trip_proposals")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (proposalError) {
    return (
      <PageShell title="Trip Detail" subtitle="There was a problem loading the proposal.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(proposalError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const proposalRow = proposal as ProposalRow | null;

  async function loadComponent(
    type: string,
    detailTable: string,
  ): Promise<LoadedTripComponent> {
    const { data: component, error: componentError } = await supabase
      .from("trip_components")
      .select("*")
      .eq("trip_id", tripId)
      .eq("component_type", type)
      .maybeSingle();

    if (componentError) {
      return {
        component: null,
        details: null,
        supplier: null,
        error: componentError,
      };
    }

    const componentRow = component as TripComponentRecord | null;

    let details: ComponentDetailsRecord | null = null;
    let supplier: SupplierRecord | null = null;

    if (componentRow) {
      const { data, error } = await supabase
        .from(detailTable)
        .select("*")
        .eq("component_id", componentRow.id)
        .maybeSingle();

      if (error) {
        return {
          component: componentRow,
          details: null,
          supplier: null,
          error,
        };
      }

      details = data as ComponentDetailsRecord | null;

      if (componentRow.supplier_id) {
        const { data: supplierData } = await supabase
          .from("suppliers")
          .select("id, supplier_name, supplier_type, contact_phone, contact_email, website_url")
          .eq("id", componentRow.supplier_id)
          .maybeSingle();

        supplier = supplierData as SupplierRecord | null;
      }
    }

    return {
      component: componentRow,
      details,
      supplier,
      error: null,
    };
  }

  const hotel = await loadComponent("hotel", "hotel_components");
  const air = await loadComponent("air", "air_components");
  const cruise = await loadComponent("cruise", "cruise_components");
  const transfer = await loadComponent("transfer", "transfer_components");
  const activity = await loadComponent("activity", "activity_components");
  const insurance = await loadComponent("insurance", "insurance_components");

  for (const loadedComponent of [hotel, air, cruise, transfer, activity, insurance]) {
    if (loadedComponent.error) {
      return (
        <PageShell
          title="Trip Detail"
          subtitle="There was a problem loading a trip component."
        >
          <div className="card">
            <p>
              <strong>Error:</strong>
            </p>
            <pre>{JSON.stringify(loadedComponent.error, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }
  }

  let outboundSegment: FlightSegmentRow | null = null;
  let returnSegment: FlightSegmentRow | null = null;

  if (air.component) {
    const { data: loadedSegments, error: segmentsError } = await supabase
      .from("flight_segments")
      .select("*")
      .eq("air_component_id", air.component.id)
      .order("segment_order", { ascending: true });

    if (segmentsError) {
      return (
        <PageShell
          title="Trip Detail"
          subtitle="There was a problem loading flight segments."
        >
          <div className="card">
            <p>
              <strong>Error:</strong>
            </p>
            <pre>{JSON.stringify(segmentsError, null, 2)}</pre>
          </div>
        </PageShell>
      );
    }

    const segmentRows = (loadedSegments ?? []) as FlightSegmentRow[];

    outboundSegment =
      segmentRows.find((segment) => segment.direction === "outbound") ?? null;
    returnSegment =
      segmentRows.find((segment) => segment.direction === "return") ?? null;
  }

  const { data: clientNote, error: clientNoteError } = await supabase
    .from("trip_notes")
    .select("*")
    .eq("trip_id", tripId)
    .eq("note_type", "client")
    .maybeSingle();

  if (clientNoteError) {
    return (
      <PageShell title="Trip Detail" subtitle="There was a problem loading trip notes.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(clientNoteError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientNoteRow = clientNote as TripNoteRow | null;

  const { data: clientReminder, error: clientReminderError } = await supabase
    .from("trip_notes")
    .select("*")
    .eq("trip_id", tripId)
    .eq("note_type", "client_reminder")
    .maybeSingle();

  if (clientReminderError) {
    return (
      <PageShell
        title="Trip Detail"
        subtitle="There was a problem loading trip reminders."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(clientReminderError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const clientReminderRow = clientReminder as TripNoteRow | null;

  const { data: tripMembers, error: tripMembersError } = await supabase
    .from("trip_members" as any)
    .select(`
      id,
      trip_id,
      client_account_id,
      invite_email,
      invite_name,
      role,
      invite_status,
      can_view_trip,
      can_view_shared_documents,
      can_join_group_messages,
      can_upload_own_documents,
      can_manage_companions,
      created_at,
      client_accounts!trip_members_client_account_id_fkey(
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq("trip_id", tripId)
    .neq("invite_status", "removed")
    .order("created_at", { ascending: true });

  if (tripMembersError) {
    return (
      <PageShell
        title="Trip Detail"
        subtitle="There was a problem loading your Travel Circle."
      >
        <div className="card">
          <p>
            <strong>Error loading Travel Circle:</strong>
          </p>
          <pre>{JSON.stringify(tripMembersError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const tripMemberRows = (tripMembers ?? []) as TripMemberRow[];
  const activeTripMembers = tripMemberRows.filter(
    (member) => member.invite_status === "active" || member.invite_status === "invited",
  );
  const ownerMembers = activeTripMembers.filter((member) => member.role === "owner");
  const companionMembers = activeTripMembers.filter((member) => member.role !== "owner");
  const canManageTravelCircle =
    isPrimaryClient || currentMemberAccess?.can_manage_companions === true;

  const { data: clientDocuments, error: clientDocumentsError } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", tripId)
    .eq("visibility", "client")
    .order("created_at", { ascending: false });

  if (clientDocumentsError) {
    return (
      <PageShell
        title="Trip Detail"
        subtitle="There was a problem loading trip documents."
      >
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(clientDocumentsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const documentRows = (clientDocuments ?? []) as TripDocumentRow[];

  const documentsWithUrls: TripDocumentWithSignedUrl[] = await Promise.all(
    documentRows.map(async (doc) => {
      const { data, error } = await supabaseAdmin.storage
        .from("trip-documents")
        .createSignedUrl(doc.storage_path, 60 * 60);

      return {
        ...doc,
        signedUrl: error ? null : data?.signedUrl ?? null,
      };
    }),
  );

  const timelineEvents = [
    hotel.details?.check_in_date
      ? {
          dateValue: hotel.details.check_in_date,
          icon: "🏨",
          title: "Hotel Check-in",
          details: hotel.details.hotel_name ?? "Hotel stay begins",
        }
      : null,
    hotel.details?.check_out_date
      ? {
          dateValue: hotel.details.check_out_date,
          icon: "🧳",
          title: "Hotel Check-out",
          details: hotel.details.hotel_name ?? "Hotel stay ends",
        }
      : null,
    outboundSegment?.departure_datetime
      ? {
          dateValue: outboundSegment.departure_datetime,
          icon: "✈️",
          title: "Outbound Flight",
          details: `${outboundSegment.departure_airport_code ?? "?"} → ${
            outboundSegment.destination_airport_code ?? "?"
          }`,
        }
      : null,
    returnSegment?.departure_datetime
      ? {
          dateValue: returnSegment.departure_datetime,
          icon: "🛬",
          title: "Return Flight",
          details: `${returnSegment.departure_airport_code ?? "?"} → ${
            returnSegment.destination_airport_code ?? "?"
          }`,
        }
      : null,
    transfer.details?.pickup_datetime
      ? {
          dateValue: transfer.details.pickup_datetime,
          icon: "🚗",
          title: "Transfer Pickup",
          details: `${transfer.details.pickup_location ?? "Pickup"} → ${
            transfer.details.dropoff_location ?? "Dropoff"
          }`,
        }
      : null,
    activity.details?.activity_datetime
      ? {
          dateValue: activity.details.activity_datetime,
          icon: "🎟️",
          title: activity.details.activity_name ?? "Activity",
          details:
            activity.details.location ??
            activity.details.supplier_name ??
            "Scheduled activity",
        }
      : null,
    cruise.details?.sailing_date
      ? {
          dateValue: cruise.details.sailing_date,
          icon: "🚢",
          title: "Cruise Sailing",
          details: `${cruise.details.ship_name ?? "Cruise"}${
            cruise.details.departure_port ? ` from ${cruise.details.departure_port}` : ""
          }`,
        }
      : null,
    cruise.details?.return_date
      ? {
          dateValue: cruise.details.return_date,
          icon: "⚓",
          title: "Cruise Return",
          details:
            cruise.details.arrival_port ??
            cruise.details.ship_name ??
            "Cruise return",
        }
      : null,
  ]
    .filter((event): event is TimelineEvent => Boolean(event?.dateValue))
    .sort((a, b) => new Date(a.dateValue).getTime() - new Date(b.dateValue).getTime());

  const timelineGroups = timelineEvents.reduce(
    (groups, event) => {
      const dateKey = getTimelineDateKey(event.dateValue);
      const existingGroup = groups.find((group) => group.dateKey === dateKey);

      if (existingGroup) {
        existingGroup.events.push(event);
      } else {
        groups.push({
          dateKey,
          events: [event],
        });
      }

      return groups;
    },
    [] as {
      dateKey: string;
      events: TimelineEvent[];
    }[],
  );

  return (
    <PageShell
      title={tripRow.trip_name ?? "Trip Detail"}
      subtitle="Your travel details, all in one place."
    >
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 70%)",
          border: "1px solid #e6f0f2",
        }}
      >
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
          Cozy Concierge
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          {tripRow.trip_name ?? "Your Trip"}
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.55 }}>
          {tripRow.destinations ?? "Your travel details are ready when you are."}
        </p>

        <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          <StatusBadge status={tripRow.trip_status ?? "draft"} />
          <span style={{ color: "#667085", lineHeight: 1.5 }}>
            {formatDate(tripRow.departure_date, "Not set")} →{" "}
            {formatDate(tripRow.return_date, "Not set")}
          </span>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#ffffff",
          border: "1px solid #e6f0f2",
        }}
      >
        <SectionHeader
          eyebrow="Action Center"
          title="What Would You Like To Do?"
          subtitle="Quick links to the most useful trip actions."
        />

        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ActionLink href={`/trips/${tripRow.id}/documents`} className="btn btn-primary">
            View Documents
          </ActionLink>

          <ActionLink href="/messages" className="btn btn-primary">
            Open Message Center
          </ActionLink>

          <ActionLink href={`/trips/${tripRow.id}/request-payment`} className="btn btn-primary">
            Request Payment Link
          </ActionLink>

          <ActionLink href="/trips" className="btn btn-primary">
            Back to My Trips
          </ActionLink>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #fffaf5 0%, #ffffff 70%)",
        }}
      >
        <SectionHeader
          eyebrow="Concierge Messages"
          title="Have a Question About This Trip?"
          subtitle="Choose whether your message should stay private with your advisor or be shared with the approved Travel Companions on this trip."
        />

        <div className="grid grid-2">
          <div
            className="card stack"
            style={{
              background: "#ffffff",
              border: "1px solid #e6f0f2",
            }}
          >
            <h3 style={{ margin: 0 }}>Message Advisor Privately</h3>
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Best for payments, personal details, document questions, or anything
              that should stay between you and Cozy Adventure Vacations.
            </p>
            <ActionLink
              href={`/messages?tripId=${tripRow.id}&subject=${emailSubject}`}
              className="btn btn-primary"
            >
              Private Message
            </ActionLink>
          </div>

          <div
            className="card stack"
            style={{
              background: "#ffffff",
              border: "1px solid #fed7aa",
            }}
          >
            <h3 style={{ margin: 0 }}>Message Travel Circle</h3>
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              Best for shared questions, planning details, meeting points, reminders,
              and anything your approved companions should also see.
            </p>
            <ActionLink
              href={`/messages?tripId=${tripRow.id}&scope=group&subject=${travelCircleSubject}`}
              className="btn btn-primary"
            >
              Group Message
            </ActionLink>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ActionLink href="/messages" className="btn btn-primary">
            Open Message Center
          </ActionLink>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#ffffff",
          border: "1px solid #e6f0f2",
        }}
      >
        <SectionHeader
          eyebrow="Travel Companions"
          title="Your Travel Circle"
          subtitle="These are the people who currently have shared access to this trip. Personal profile details and private documents remain protected."
        />

        {activeTripMembers.length === 0 ? (
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
            No Travel Companions have been added yet. Your advisor can add companions
            to this trip when shared access is needed.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {[...ownerMembers, ...companionMembers].map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  padding: "12px",
                  borderRadius: 14,
                  border: "1px solid #eef2f5",
                  background: member.role === "owner" ? "#f0fdf4" : "#fbfdfe",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 900 }}>
                    {getTripMemberDisplayName(member)}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>
                    {getTripMemberEmail(member) ?? "Email not provided"}
                    {member.invite_status === "invited" ? " • Invitation pending" : ""}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <TravelCompanionBadge role={member.role} />

                  {canManageTravelCircle && member.role !== "owner" ? (
                    <form action={removeTravelCompanion}>
                      <input type="hidden" name="trip_id" value={tripRow.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                          padding: "6px 10px",
                          fontSize: 13,
                          background: "#ffffff",
                          color: "#b42318",
                          border: "1px solid #fecaca",
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageTravelCircle ? (
          <div
            className="card stack"
            style={{
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <SectionHeader
              eyebrow="Invite Access"
              title="Invite a Travel Companion"
              subtitle="Add someone who should be able to view this trip. If they already have a Cozy Concierge client account, access is connected right away. Otherwise, the invite is saved as pending."
            />

            <form action={inviteTravelCompanion} className="stack">
              <input type="hidden" name="trip_id" value={tripRow.id} />

              <div className="grid grid-3">
                <label className="stack-sm">
                  <span className="label">Name</span>
                  <input
                    className="input"
                    name="invite_name"
                    placeholder="e.g. Pat Brown"
                  />
                </label>

                <label className="stack-sm">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    name="invite_email"
                    type="email"
                    required
                    placeholder="traveler@example.com"
                  />
                </label>

                <label className="stack-sm">
                  <span className="label">Access Level</span>
                  <select className="select" name="role" defaultValue="viewer">
                    <option value="viewer">Viewer — read-only access</option>
                    <option value="contributor">Contributor — can participate more</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: "#ffffff",
                  border: "1px solid #e6f0f2",
                  color: "#667085",
                  lineHeight: 1.6,
                }}
              >
                <strong>Privacy note:</strong> Travel Companions can access shared trip
                details and client-visible trip documents. Personal profile details,
                passport uploads, traveler numbers, and private documents remain protected.
              </div>

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn btn-primary">
                  Add Travel Companion
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            Only the lead traveler or your advisor can manage Travel Companions for this trip.
          </div>
        )}
      </div>

      {clientReminderRow ? (
        <div
          className="card stack"
          style={{
            borderLeft: "4px solid var(--accent-dark)",
            background: "#f7fbfc",
          }}
        >
          <SectionHeader
            eyebrow="Important Reminder"
            title={clientReminderRow.title ?? "Important Reminders Before You Travel"}
          />

          <p style={{ lineHeight: 1.65, margin: 0 }}>
            {clientReminderRow.content ??
              "Please review your trip details carefully before travel."}
          </p>
        </div>
      ) : null}

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Balance Due</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(tripRow.balance_due)}
          </p>
        </div>

        <div className="card">
          <span className="label">Final Payment Due</span>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>
            {formatDate(tripRow.final_payment_due_date, "Not set")}
          </p>
        </div>

        <div className="card">
          <span className="label">Trip Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusBadge status={tripRow.trip_status ?? "draft"} />
          </p>
        </div>
      </div>

      <CollapsibleSection
        eyebrow="Travel Documents"
        title="Travel Documents & Identity Check"
        subtitle="Before you travel, please review these important document reminders."
      >
        <div className="grid grid-2">
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 12,
            }}
          >
            <ChecklistItem>
              Confirm all traveler names match the booking exactly as shown on passports
              or government IDs.
            </ChecklistItem>
            <ChecklistItem>
              Check passport or government ID expiration dates well before departure.
            </ChecklistItem>
            <ChecklistItem>
              Review destination entry, visa, passport validity, and travel document
              requirements if applicable.
            </ChecklistItem>
          </ul>

          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 12,
            }}
          >
            <ChecklistItem>
              Keep digital and/or printed copies of confirmations, insurance details,
              and important travel documents.
            </ChecklistItem>
            <ChecklistItem>
              If minors are traveling without both parents or guardians, confirm whether
              consent documents are needed.
            </ChecklistItem>
            <ChecklistItem>
              Contact your advisor if anything looks incorrect before final travel
              documents are issued.
            </ChecklistItem>
          </ul>
        </div>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Friendly Reminder</span>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            Travel document and entry requirements can vary by destination, airline,
            cruise line, resort, and traveler citizenship. Please review your official
            documents carefully and reach out if you are unsure where to verify a
            requirement.
          </p>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <ActionLink href={`/trips/${tripRow.id}/documents`} className="btn btn-primary">
            View Shared Documents
          </ActionLink>
        </div>
      </CollapsibleSection>

      {timelineGroups.length > 0 ? (
        <CollapsibleSection
          eyebrow="Timeline"
          title="Day-by-Day Trip Timeline"
          subtitle="A quick chronological preview of the major moments in your itinerary."
          defaultOpen
        >
          <div style={{ display: "grid", gap: 16 }}>
            {timelineGroups.map((group, groupIndex) => (
              <div
                key={group.dateKey}
                style={{
                  border: "1px solid #eef2f5",
                  borderRadius: 16,
                  background: "#ffffff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    background: "#f7fbfc",
                    borderBottom: "1px solid #e6f0f2",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--accent-dark)",
                      fontWeight: 800,
                    }}
                  >
                    Day {groupIndex + 1}
                  </p>
                  <h3 style={{ margin: "4px 0 0" }}>
                    {formatDate(group.dateKey, group.dateKey)}
                  </h3>
                </div>

                <div style={{ display: "grid", gap: 10, padding: 12 }}>
                  {group.events.map((event, index) => (
                    <TimelineItem
                      key={`${event.title}-${event.dateValue}-${index}`}
                      icon={event.icon}
                      title={event.title}
                      date={formatTimelineDate(event.dateValue)}
                      details={event.details}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        eyebrow="Overview"
        title="Trip Overview"
        subtitle="The big-picture details for your upcoming adventure."
      >
        <div className="grid grid-2">
          <InfoItem label="Trip Name" value={tripRow.trip_name} />
          <InfoItem label="Destinations" value={tripRow.destinations} />
          <InfoItem
            label="Departure Date"
            value={formatDate(tripRow.departure_date, "Not set")}
          />
          <InfoItem
            label="Return Date"
            value={formatDate(tripRow.return_date, "Not set")}
          />
          <InfoItem label="Occasion" value={tripRow.occasion ?? "Not provided"} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        eyebrow="Proposal"
        title="Proposal Summary"
        subtitle="A quick recap of the proposal and pricing details."
        defaultOpen
      >
        <div className="grid grid-2">
          <InfoItem
            label="Proposal Title"
            value={proposalRow?.proposal_title ?? "Not provided"}
          />
          <PriceItem label="Planning Fee" value={proposalRow?.planning_fee} />
          <PriceItem label="Total Price" value={proposalRow?.total_price} />
        </div>

        <div>
          <span className="label">Welcome Text</span>
          <p style={{ lineHeight: 1.6 }}>
            {proposalRow?.proposal_welcome_text ?? "Not provided"}
          </p>
        </div>

        <div>
          <span className="label">Closing Text</span>
          <p style={{ lineHeight: 1.6 }}>
            {proposalRow?.proposal_closing_text ?? "Not provided"}
          </p>
        </div>
      </CollapsibleSection>

      {clientNoteRow ? (
        <div className="card stack" style={{ borderLeft: "4px solid var(--accent-dark)" }}>
          <SectionHeader
            eyebrow="Advisor Note"
            title={clientNoteRow.title ?? "Notes from Your Advisor"}
          />
          <p style={{ lineHeight: 1.65, margin: 0 }}>
            {clientNoteRow.content ?? "No notes yet."}
          </p>
        </div>
      ) : null}

      {hotel.component && hotel.details ? (
        <CollapsibleSection
          eyebrow="Stay"
          title="Hotel Stay"
          subtitle={hotel.details.hotel_name ?? undefined}
        >
          <div className="grid grid-2">
            <InfoItem label="Hotel Name" value={hotel.details.hotel_name ?? "Not provided"} />
            <InfoItem
              label="Supplier"
              value={getSupplierDisplayName(hotel, hotel.details.hotel_name)}
            />
            <InfoItem
              label="Booking Status"
              value={hotel.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Hotel Address"
              value={hotel.details.hotel_address ?? "Not provided"}
            />
            <InfoItem
              label="Stars"
              value={hotel.details.hotel_star_rating ?? "Not provided"}
            />
            <InfoItem label="Check-in" value={formatDate(hotel.details.check_in_date)} />
            <InfoItem label="Check-out" value={formatDate(hotel.details.check_out_date)} />
            <InfoItem
              label="Room Category"
              value={hotel.details.room_category ?? "Not provided"}
            />
            <InfoItem
              label="Confirmation Number"
              value={hotel.component.confirmation_number ?? "Not provided"}
            />
            <InfoItem
              label="Nightly Rate"
              value={
                typeof hotel.details.nightly_rate === "number"
                  ? formatMoney(hotel.details.nightly_rate)
                  : "Not provided"
              }
            />
            <PriceItem label="Total Hotel Price" value={hotel.component.total_price} />
          </div>

          <div>
            <span className="label">Room Description</span>
            <p style={{ lineHeight: 1.6 }}>
              {hotel.details.room_description ?? "Not provided"}
            </p>
          </div>

          <div>
            <span className="label">Hotel Description</span>
            <p style={{ lineHeight: 1.6 }}>
              {hotel.details.hotel_description ?? "Not provided"}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {air.component && air.details ? (
        <CollapsibleSection eyebrow="Flights" title="Air Travel">
          <div className="grid grid-2">
            <InfoItem label="Flight Type" value={air.details.flight_type ?? "Not provided"} />
            <InfoItem
              label="Supplier / Airline"
              value={getSupplierDisplayName(air, outboundSegment?.carrier ?? returnSegment?.carrier)}
            />
            <InfoItem
              label="Booking Status"
              value={air.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Traveler Count"
              value={air.details.traveler_count ?? "Not provided"}
            />
            <InfoItem label="Rate Class" value={air.details.rate_class ?? "Not provided"} />
            <InfoItem
              label="Airline Locator"
              value={air.details.airline_locator ?? "Not provided"}
            />
            <InfoItem
              label="Confirmation Number"
              value={air.component.confirmation_number ?? "Not provided"}
            />
            <PriceItem label="Total Air Price" value={air.component.total_price} />
          </div>

          {outboundSegment ? (
            <div className="card stack" style={{ background: "#f7fbfc" }}>
              <SectionHeader eyebrow="Outbound" title="Outbound Flight" />
              <div className="grid grid-2">
                <InfoItem
                  label="Route"
                  value={`${outboundSegment.departure_airport_code ?? "?"} → ${
                    outboundSegment.destination_airport_code ?? "?"
                  }`}
                />
                <InfoItem
                  label="Flight"
                  value={
                    `${outboundSegment.carrier ?? ""} ${
                      outboundSegment.flight_number ?? ""
                    }`.trim() || "Not provided"
                  }
                />
                <InfoItem
                  label="Departure"
                  value={formatDateTime(outboundSegment.departure_datetime)}
                />
                <InfoItem
                  label="Arrival"
                  value={formatDateTime(outboundSegment.arrival_datetime)}
                />
                <InfoItem
                  label="Cabin Class"
                  value={outboundSegment.cabin_class ?? "Not provided"}
                />
                <InfoItem
                  label="Seat Assignment"
                  value={outboundSegment.seat_assignment ?? "Not provided"}
                />
              </div>
            </div>
          ) : null}

          {returnSegment ? (
            <div className="card stack" style={{ background: "#f7fbfc" }}>
              <SectionHeader eyebrow="Return" title="Return Flight" />
              <div className="grid grid-2">
                <InfoItem
                  label="Route"
                  value={`${returnSegment.departure_airport_code ?? "?"} → ${
                    returnSegment.destination_airport_code ?? "?"
                  }`}
                />
                <InfoItem
                  label="Flight"
                  value={
                    `${returnSegment.carrier ?? ""} ${
                      returnSegment.flight_number ?? ""
                    }`.trim() || "Not provided"
                  }
                />
                <InfoItem
                  label="Departure"
                  value={formatDateTime(returnSegment.departure_datetime)}
                />
                <InfoItem
                  label="Arrival"
                  value={formatDateTime(returnSegment.arrival_datetime)}
                />
                <InfoItem
                  label="Cabin Class"
                  value={returnSegment.cabin_class ?? "Not provided"}
                />
                <InfoItem
                  label="Seat Assignment"
                  value={returnSegment.seat_assignment ?? "Not provided"}
                />
              </div>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {cruise.component && cruise.details ? (
        <CollapsibleSection
          eyebrow="Sailing"
          title="Cruise"
          subtitle={cruise.details.ship_name ?? undefined}
        >
          <div className="grid grid-2">
            <InfoItem
              label="Cruise Line"
              value={cruise.details.cruise_line ?? "Not provided"}
            />
            <InfoItem
              label="Supplier"
              value={getSupplierDisplayName(cruise, cruise.details.cruise_line)}
            />
            <InfoItem
              label="Ship Name"
              value={cruise.details.ship_name ?? "Not provided"}
            />
            <InfoItem
              label="Booking Status"
              value={cruise.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Confirmation Number"
              value={cruise.component.confirmation_number ?? "Not provided"}
            />
            <InfoItem label="Sailing Date" value={formatDate(cruise.details.sailing_date)} />
            <InfoItem label="Return Date" value={formatDate(cruise.details.return_date)} />
            <InfoItem
              label="Departure Port"
              value={cruise.details.departure_port ?? "Not provided"}
            />
            <InfoItem
              label="Arrival Port"
              value={cruise.details.arrival_port ?? "Not provided"}
            />
            <InfoItem
              label="Cabin Category"
              value={cruise.details.cabin_category ?? "Not provided"}
            />
            <InfoItem
              label="Cabin Number"
              value={cruise.details.cabin_number ?? "Not provided"}
            />
            <InfoItem
              label="Dining Seating"
              value={cruise.details.dining_seating ?? "Not provided"}
            />
            <PriceItem label="Total Cruise Price" value={cruise.component.total_price} />
          </div>

          <div>
            <span className="label">Cruise Description</span>
            <p style={{ lineHeight: 1.6 }}>
              {cruise.details.cruise_description ?? "Not provided"}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {transfer.component && transfer.details ? (
        <CollapsibleSection eyebrow="Ground Transportation" title="Transfer">
          <div className="grid grid-2">
            <InfoItem
              label="Supplier"
              value={getSupplierDisplayName(transfer, transfer.details.supplier_name)}
            />
            <InfoItem
              label="Booking Status"
              value={transfer.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Pickup Date & Time"
              value={formatDateTime(transfer.details.pickup_datetime)}
            />
            <InfoItem
              label="Passenger Count"
              value={transfer.details.passenger_count ?? "Not provided"}
            />
            <InfoItem
              label="Pickup Location"
              value={transfer.details.pickup_location ?? "Not provided"}
            />
            <InfoItem
              label="Dropoff Location"
              value={transfer.details.dropoff_location ?? "Not provided"}
            />
            <InfoItem
              label="Vehicle Type"
              value={transfer.details.vehicle_type ?? "Not provided"}
            />
            <InfoItem
              label="Confirmation Number"
              value={transfer.component.confirmation_number ?? "Not provided"}
            />
            <PriceItem label="Total Transfer Price" value={transfer.component.total_price} />
          </div>

          <div>
            <span className="label">Transfer Notes</span>
            <p style={{ lineHeight: 1.6 }}>
              {transfer.details.transfer_notes ?? "Not provided"}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {activity.component && activity.details ? (
        <CollapsibleSection
          eyebrow="Experience"
          title="Activity"
          subtitle={activity.details.activity_name ?? undefined}
        >
          <div className="grid grid-2">
            <InfoItem
              label="Activity Name"
              value={activity.details.activity_name ?? "Not provided"}
            />
            <InfoItem
              label="Supplier"
              value={getSupplierDisplayName(activity, activity.details.supplier_name)}
            />
            <InfoItem
              label="Booking Status"
              value={activity.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Confirmation Number"
              value={activity.component.confirmation_number ?? "Not provided"}
            />
            <InfoItem
              label="Activity Date & Time"
              value={formatDateTime(activity.details.activity_datetime)}
            />
            <InfoItem label="Location" value={activity.details.location ?? "Not provided"} />
            <InfoItem
              label="Participant Count"
              value={activity.details.participant_count ?? "Not provided"}
            />
            <PriceItem label="Total Activity Price" value={activity.component.total_price} />
          </div>

          <div>
            <span className="label">Activity Notes</span>
            <p style={{ lineHeight: 1.6 }}>
              {activity.details.activity_notes ?? "Not provided"}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {insurance.component && insurance.details ? (
        <CollapsibleSection eyebrow="Protection" title="Travel Insurance">
          <div className="grid grid-2">
            <InfoItem
              label="Provider"
              value={insurance.details.provider_name ?? "Not provided"}
            />
            <InfoItem
              label="Supplier"
              value={getSupplierDisplayName(insurance, insurance.details.provider_name)}
            />
            <InfoItem
              label="Plan Name"
              value={insurance.details.plan_name ?? "Not provided"}
            />
            <InfoItem
              label="Booking Status"
              value={insurance.component.booking_status ?? "Not provided"}
            />
            <InfoItem
              label="Policy Number"
              value={insurance.component.confirmation_number ?? "Not provided"}
            />
            <InfoItem
              label="Coverage Start"
              value={formatDate(insurance.details.coverage_start_date)}
            />
            <InfoItem
              label="Coverage End"
              value={formatDate(insurance.details.coverage_end_date)}
            />
            <InfoItem
              label="Travelers Covered"
              value={insurance.details.insured_traveler_count ?? "Not provided"}
            />
            <PriceItem label="Total Premium" value={insurance.component.total_price} />
            <InfoItem
              label="Claims Phone"
              value={insurance.details.claim_phone ?? "Not provided"}
            />
          </div>

          <div>
            <span className="label">Coverage Notes</span>
            <p style={{ lineHeight: 1.6 }}>
              {insurance.details.insurance_notes ?? "Not provided"}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {documentsWithUrls.length > 0 ? (
        <CollapsibleSection
          eyebrow="Files"
          title="Documents"
          subtitle="Client-visible documents shared by your advisor."
        >
          <div id="documents" style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {documentsWithUrls.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.file_name}</td>
                    <td>{formatDateTime(doc.created_at, "")}</td>
                    <td>
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent-dark)", fontWeight: 700 }}
                        >
                          Open
                        </a>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <ActionLink href={`/trips/${tripRow.id}/documents`} className="btn btn-primary">
              Open Full Documents Page
            </ActionLink>
          </div>
        </CollapsibleSection>
      ) : null}

      <ClientLinkedDocuments tripId={tripRow.id} />

      <CollapsibleSection
        eyebrow="Trip Contacts"
        title="Helpful Contact Information"
        subtitle="Keep these details handy before and during travel."
      >
        <div className="grid grid-2">
          <InfoItem label="Your Advisor" value="Jeremy Brown" />
          <InfoItem label="Agency" value="Cozy Adventure Vacations" />

          <div
            style={{
              padding: "12px",
              border: "1px solid #eef2f5",
              borderRadius: 12,
              background: "#fbfdfe",
            }}
          >
            <span className="label">Email</span>
            <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
              <a
                href={`mailto:${advisorEmail}?subject=${emailSubject}&body=${emailBody}`}
                style={{
                  color: "var(--accent-dark)",
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                }}
              >
                {advisorEmail}
              </a>
            </p>
          </div>

          <div
            style={{
              padding: "12px",
              border: "1px solid #eef2f5",
              borderRadius: 12,
              background: "#fbfdfe",
            }}
          >
            <span className="label">Website</span>
            <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
              <a
                href={agencyWebsite}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--accent-dark)",
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                }}
              >
                CozyAdventureVacations.com
              </a>
            </p>
          </div>
        </div>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Travel Support Note</span>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            For urgent in-trip supplier issues, contact the supplier first when possible,
            then notify your advisor so Cozy Adventure Vacations can help support the
            next steps.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        eyebrow="Need Help?"
        title="Questions Before You Travel?"
        subtitle="Your Cozy Adventure Vacations advisor is here to help. Review your trip details above, and reach out if anything looks off or if you need support before departure."
        defaultOpen
      >
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          A quick message now can prevent a headache later. If names, dates, documents,
          payment details, or travel components do not look right, please contact your
          advisor before your departure date.
        </p>

        <div
          className="row"
          style={{
            marginTop: 14,
            gap: 10,
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          <ActionLink href="/messages" className="btn btn-primary">
            Open Message Center
          </ActionLink>
        </div>
      </CollapsibleSection>
    </PageShell>
  );
}