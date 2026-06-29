import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { decryptIfPresent } from "@/lib/encryption";
import { SensitiveField } from "@/components/security/sensitive-field";

type ClientDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  anniversary_date: string | null;
  preferred_airport: string | null;
  travel_style: string | null;
  airline_seating_preference: string | null;
  airline_class_preference: string | null;
  cruise_cabin_preference: string | null;
  travel_preference_notes: string | null;
  accessibility_notes: string | null;
  food_allergies: string | null;
  passport_number: string | null;
  passport_date_issued: string | null;
  passport_expiration_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string | null;
};

type TripRow = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  final_payment_due_date: string | null;
};

type QuoteRequestRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  status: string | null;
  submitted_at: string | null;
  converted_trip_id: string | null;
};

type ClientNoteRow = {
  id: string;
  note_type: string;
  title: string | null;
  content: string | null;
  follow_up_date: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ClientDocumentRow = {
  id: string;
  document_type: string;
  document_title: string;
  file_name: string;
  created_at: string | null;
};

type TravelerProfileRow = {
  id: string;
  client_account_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  known_traveler_number: string | null;
  redress_number: string | null;
  global_entry_passid: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_date_issued: string | null;
  passport_expiration_date: string | null;
  notes: string | null;
  created_at: string | null;
};

type TravelerLoyaltyNumberRow = {
  id: string;
  traveler_profile_id: string;
  client_account_id: string;
  loyalty_type: string;
  company_name: string;
  program_name: string | null;
  loyalty_number: string;
  traveler_name_snapshot: string | null;
  notes: string | null;
  created_at: string | null;
};

type TravelCircleTripRow = {
  id: string;
  client_account_id: string | null;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
};

type TravelCircleAccessRow = {
  id: string;
  trip_id: string;
  client_account_id: string | null;
  invite_email: string | null;
  invite_name: string | null;
  role: "owner" | "contributor" | "viewer" | string;
  invite_status: "active" | "invited" | "declined" | "removed" | string;
  created_at: string | null;
  trips: TravelCircleTripRow | TravelCircleTripRow[] | null;
};

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
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeDecrypt(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decryptIfPresent(value);
  } catch (error) {
    console.error("Unable to decrypt sensitive field:", error);
    return "Unable to decrypt";
  }
}

function getDocumentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "passport": return "Passport";
    case "minor_permission": return "Minor Permission Slip";
    case "minor_international_consent": return "Minor International Travel Consent";
    case "medical": return "Medical / Health Document";
    case "insurance": return "Travel Insurance Document";
    case "accessibility": return "Accessibility Document";
    case "supplier_required": return "Supplier-Required Document";
    case "general": return "General Travel Document";
    default: return type ?? "Unknown Document";
  }
}

function getTravelerName(traveler: TravelerProfileRow | null | undefined) {
  if (!traveler) return "Unnamed Traveler";
  return `${traveler.first_name ?? ""} ${traveler.middle_name ?? ""} ${traveler.last_name ?? ""}`
    .replace(/\s+/g, " ")
    .trim() || "Unnamed Traveler";
}

function getLoyaltyTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "airline": return "Airline";
    case "hotel": return "Hotel";
    case "cruise": return "Cruise";
    case "rental_car": return "Rental Car";
    case "rail": return "Rail";
    case "theme_park": return "Theme Park";
    case "credit_card": return "Credit Card Travel Program";
    case "tour": return "Tour / Activity";
    case "vacation_package": return "Vacation Package / Supplier";
    default: return "Other";
  }
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div style={{ padding: "12px", border: "1px solid #eef2f5", borderRadius: 12, background: "#fbfdfe" }}>
      <span className="label">{label}</span>
      <p className="preserve-formatting" style={{ margin: "6px 0 0", lineHeight: 1.45 }}>
        {isEmpty ? "Not provided" : value}
      </p>
    </div>
  );
}

function ActionButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-primary"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: "#f0f7f8", color: "var(--accent-dark)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
      {status ?? "unknown"}
    </span>
  );
}

function DocumentTypeBadge({ type }: { type: string | null | undefined }) {
  const isPassport = type === "passport";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: isPassport ? "#fff7ed" : "#f0f7f8", color: isPassport ? "#c2410c" : "var(--accent-dark)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
      {getDocumentTypeLabel(type)}
    </span>
  );
}

function NoteStatusBadge({ isCompleted }: { isCompleted: boolean | null | undefined }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: isCompleted ? "#ecfdf3" : "#fff7ed", color: isCompleted ? "#027a48" : "#c2410c", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
      {isCompleted ? "completed" : "open"}
    </span>
  );
}

function LoyaltyTypeBadge({ type }: { type: string | null | undefined }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: "#f0f7f8", color: "var(--accent-dark)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
      {getLoyaltyTypeLabel(type)}
    </span>
  );
}

function getTravelCircleTrip(access: TravelCircleAccessRow) {
  if (Array.isArray(access.trips)) return access.trips[0] ?? null;
  return access.trips ?? null;
}

function getTravelCircleRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "owner": return "Owner";
    case "contributor": return "Contributor";
    case "viewer": return "Viewer";
    default: return role ?? "Viewer";
  }
}

function TravelCircleStatusBadge({ status }: { status: string | null | undefined }) {
  const isActive = status === "active";
  const isInvited = status === "invited";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: isActive ? "#ecfdf3" : isInvited ? "#fff7ed" : "#f8fafc", color: isActive ? "#027a48" : isInvited ? "#c2410c" : "#475569", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
      {isActive ? "Active" : isInvited ? "Pending" : status ?? "Unknown"}
    </span>
  );
}

// ── Server Actions ────────────────────────────────────────────────────────────

async function updateClientNoteStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const noteId = String(formData.get("note_id") ?? "").trim();
  const isCompleted = String(formData.get("is_completed") ?? "") === "true";

  if (!clientId) throw new Error("Missing client ID.");
  if (!noteId) throw new Error("Missing note ID.");

  const { error } = await supabase
    .from("client_notes")
    .update({ is_completed: isCompleted })
    .eq("id", noteId)
    .eq("client_account_id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clients/${clientId}`);
}

async function sendPrivateMessage(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!clientId) throw new Error("Missing client ID.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message body is required.");

  // Create the private thread
  const { data: thread, error: threadError } = await supabase
    .from("message_threads" as any)
    .insert({
      client_account_id: clientId,
      subject,
      thread_type: "private",
      status: "open",
      priority: "normal",
      admin_unread_count: 0,
      client_unread_count: 1,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Failed to create message thread.");
  }

  // Insert the first message
  const { error: messageError } = await supabase
    .from("messages" as any)
    .insert({
      thread_id: thread.id,
      client_account_id: clientId,
      sender_type: "admin",
      audience: "private",
      body,
      is_read_by_admin: true,
      is_read_by_client: false,
    });

  if (messageError) throw new Error(messageError.message);

  // Redirect to the thread in the private inbox
  redirect(`/admin/messages?threadId=${thread.id}&type=private`);
}

async function deleteClientAccount(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const confirmation = String(formData.get("delete_confirmation") ?? "").trim();
  const acknowledged = formData.get("delete_acknowledgement") === "on";

  if (!clientId) throw new Error("Missing client ID.");
  if (!acknowledged || confirmation !== "DELETE CLIENT") {
    throw new Error("Client deletion requires checking the acknowledgement box and typing DELETE CLIENT.");
  }

  const relatedChecks = await Promise.all([
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("client_notes").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("client_documents").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("traveler_profiles").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("traveler_loyalty_numbers").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("message_threads" as any).select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    supabase.from("trip_members" as any).select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
  ]);

  const firstError = relatedChecks.find((check) => check.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const relatedCount = relatedChecks.reduce((sum, check) => sum + Number(check.count ?? 0), 0);
  if (relatedCount > 0) {
    redirect(`/admin/clients/${clientId}?deleteBlocked=1#delete-client`);
  }

  const { error } = await supabase
    .from("client_accounts")
    .delete()
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ deleteBlocked?: string }>;
}) {
  const { clientId } = await params;
  const { deleteBlocked } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select(
      `id, first_name, last_name, preferred_name, email, phone_primary, phone_secondary,
       address_line_1, address_line_2, city, state, postal_code, date_of_birth,
       anniversary_date, preferred_airport, travel_style, airline_seating_preference,
       airline_class_preference, cruise_cabin_preference, travel_preference_notes,
       accessibility_notes, food_allergies, passport_number, passport_date_issued, passport_expiration_date,
       emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
       notes, created_at`,
    )
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return (
      <PageShell title="Client Detail" subtitle="We could not load this client.">
        <div className="card">
          <p><strong>Error:</strong></p>
          <pre>{JSON.stringify(clientError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const [
    tripsResult,
    quoteRequestsResult,
    clientNotesResult,
    clientDocumentsResult,
    travelerProfilesResult,
    travelerLoyaltyNumbersResult,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date")
      .eq("client_account_id", clientId)
      .order("departure_date", { ascending: true }),
    supabase
      .from("quote_requests")
      .select("id, full_name, email, destinations, departure_date, return_date, status, submitted_at, converted_trip_id")
      .eq("client_account_id", clientId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("client_notes")
      .select("id, note_type, title, content, follow_up_date, is_completed, created_at, updated_at")
      .eq("client_account_id", clientId)
      .order("is_completed", { ascending: true })
      .order("follow_up_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("client_documents")
      .select("id, document_type, document_title, file_name, created_at")
      .eq("client_account_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("traveler_profiles")
      .select("id, client_account_id, first_name, middle_name, last_name, date_of_birth, known_traveler_number, redress_number, global_entry_passid, passport_number, passport_country, passport_date_issued, passport_expiration_date, notes, created_at")
      .eq("client_account_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("traveler_loyalty_numbers")
      .select("id, traveler_profile_id, client_account_id, loyalty_type, company_name, program_name, loyalty_number, traveler_name_snapshot, notes, created_at")
      .eq("client_account_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const clientRow = client as ClientDetail;
  const tripRows = (tripsResult.data ?? []) as TripRow[];
  const quoteRequestRows = (quoteRequestsResult.data ?? []) as QuoteRequestRow[];
  const clientNoteRows = (clientNotesResult.data ?? []) as ClientNoteRow[];
  const clientDocumentRows = (clientDocumentsResult.data ?? []) as ClientDocumentRow[];
  const travelerProfileRows = (travelerProfilesResult.data ?? []) as TravelerProfileRow[];
  const travelerLoyaltyNumberRows = (travelerLoyaltyNumbersResult.data ?? []) as TravelerLoyaltyNumberRow[];

  const normalizedClientEmail = clientRow.email?.trim().toLowerCase() ?? "";

  const [travelCircleByClientResult, travelCircleByEmailResult] = await Promise.all([
    supabase
      .from("trip_members" as any)
      .select("id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, created_at, trips!trip_members_trip_id_fkey(id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status)")
      .eq("client_account_id", clientId)
      .neq("invite_status", "removed")
      .order("created_at", { ascending: false }),
    normalizedClientEmail
      ? supabase
          .from("trip_members" as any)
          .select("id, trip_id, client_account_id, invite_email, invite_name, role, invite_status, created_at, trips!trip_members_trip_id_fkey(id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status)")
          .ilike("invite_email", normalizedClientEmail)
          .neq("invite_status", "removed")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const clientName = `${clientRow.first_name ?? ""} ${clientRow.last_name ?? ""}`.trim() || "Unnamed Client";
  const displayName = clientRow.preferred_name || clientName;

  const fullAddress = [
    clientRow.address_line_1,
    clientRow.address_line_2,
    [clientRow.city, clientRow.state, clientRow.postal_code].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");

  const totalBalanceDue = tripRows.reduce((sum, trip) => sum + Number(trip.balance_due ?? 0), 0);
  const activeTrips = tripRows.filter((trip) => trip.trip_status !== "cancelled" && trip.trip_status !== "travel_complete");
  const openClientNotes = clientNoteRows.filter((note) => !note.is_completed);
  const completedClientNotes = clientNoteRows.filter((note) => note.is_completed);
  const passportDocuments = clientDocumentRows.filter((doc) => doc.document_type === "passport");
  const minorTravelDocuments = clientDocumentRows.filter((doc) => doc.document_type === "minor_permission" || doc.document_type === "minor_international_consent");

  const travelCircleAccessMap = new Map<string, TravelCircleAccessRow>();
  for (const access of [
    ...((travelCircleByClientResult.data ?? []) as TravelCircleAccessRow[]),
    ...((travelCircleByEmailResult.data ?? []) as TravelCircleAccessRow[]),
  ]) {
    travelCircleAccessMap.set(access.id, access);
  }

  const travelCircleAccessRows = Array.from(travelCircleAccessMap.values());
  const ownedTripIds = new Set(tripRows.map((trip) => trip.id));
  const sharedTravelCircleRows = travelCircleAccessRows.filter((access) => access.role !== "owner" && access.invite_status === "active" && !ownedTripIds.has(access.trip_id));
  const pendingTravelCircleRows = travelCircleAccessRows.filter((access) => access.invite_status === "invited");
  const declinedTravelCircleRows = travelCircleAccessRows.filter((access) => access.invite_status === "declined");
  const travelCircleError = travelCircleByClientResult.error ?? travelCircleByEmailResult.error;

  return (
    <PageShell
      title={displayName}
      subtitle="Client dashboard with contact details, travel history, requests, notes, documents, traveler numbers, and preferences."
    >
      {/* ── Action Buttons ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <ActionButton href="/admin/clients">Back to Clients</ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/documents`}>View Documents</ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/notes/new`}>Add Note</ActionButton>
        <ActionButton href={`/admin/trips/new?clientId=${clientRow.id}`}>Add Trip</ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/edit`}>Edit Client</ActionButton>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Trips</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{tripRows.length}</p>
        </div>
        <div className="card">
          <span className="label">Active Trips</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{activeTrips.length}</p>
        </div>
        <div className="card">
          <span className="label">Open Client Notes</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{openClientNotes.length}</p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Balance Due</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{formatMoney(totalBalanceDue)}</p>
        </div>
        <div className="card">
          <span className="label">Uploaded Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{clientDocumentRows.length}</p>
        </div>
        <div className="card">
          <span className="label">Passport Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{passportDocuments.length}</p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Minor Travel Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{minorTravelDocuments.length}</p>
        </div>
        <div className="card">
          <span className="label">Shared Trip Access</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{sharedTravelCircleRows.length}</p>
        </div>
        <div className="card">
          <span className="label">Pending Invites</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>{pendingTravelCircleRows.length}</p>
        </div>
      </div>

      {/* ── Send Private Message ── */}
      <div
        className="card stack"
        style={{ border: "1px solid #e6f0f2", background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)" }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
            Private Message
          </p>
          <h2 style={{ margin: "6px 0 0" }}>Send a Message to {displayName}</h2>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
            This creates a new private thread visible only to you and {displayName}. It will appear in your Private Messages inbox.
          </p>
        </div>

        <form action={sendPrivateMessage} className="stack">
          <input type="hidden" name="client_id" value={clientRow.id} />

          <label className="stack" style={{ gap: 6 }}>
            <span className="label">Subject</span>
            <input
              className="input"
              type="text"
              name="subject"
              placeholder={`Message to ${displayName}`}
              required
              style={{ width: "100%" }}
            />
          </label>

          <label className="stack" style={{ gap: 6 }}>
            <span className="label">Message</span>
            <textarea
              className="textarea"
              name="body"
              rows={5}
              placeholder="Write your message here..."
              required
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Send Private Message
            </button>
            <Link href={`/admin/messages?type=private`} style={{ fontSize: 13, color: "#667085" }}>
              View all private threads
            </Link>
          </div>
        </form>
      </div>

      {/* ── Client Information ── */}
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Client Information & Emergency Contact</h2>
        <div className="grid grid-2">
          <InfoItem label="First Name" value={clientRow.first_name} />
          <InfoItem label="Last Name" value={clientRow.last_name} />
          <InfoItem label="Preferred Name" value={clientRow.preferred_name} />
          <InfoItem label="Email" value={clientRow.email} />
          <InfoItem label="Date of Birth" value={formatDate(clientRow.date_of_birth)} />
          <InfoItem label="Anniversary Date" value={formatDate(clientRow.anniversary_date)} />
          <InfoItem label="Primary Phone" value={clientRow.phone_primary} />
          <InfoItem label="Secondary Phone" value={clientRow.phone_secondary} />
          <InfoItem label="Address" value={fullAddress || null} />
          <InfoItem label="Emergency Contact Name" value={clientRow.emergency_contact_name} />
          <InfoItem label="Emergency Contact Relationship" value={clientRow.emergency_contact_relationship} />
          <InfoItem label="Emergency Contact Phone" value={clientRow.emergency_contact_phone} />
          <InfoItem label="Created" value={formatDateTime(clientRow.created_at)} />
        </div>
      </div>

      {/* ── Travel Preferences ── */}
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Travel Preferences</h2>
        <div className="grid grid-2">
          <InfoItem label="Preferred Airport" value={clientRow.preferred_airport} />
          <InfoItem label="Travel Style" value={clientRow.travel_style} />
          <InfoItem label="Airline Seating Preference" value={clientRow.airline_seating_preference} />
          <InfoItem label="Airline Class Preference" value={clientRow.airline_class_preference} />
          <InfoItem label="Cruise Cabin Preference" value={clientRow.cruise_cabin_preference} />
          <InfoItem label="Additional Travel Preference Notes" value={clientRow.travel_preference_notes} />
          <InfoItem label="Accessibility / Mobility Notes" value={clientRow.accessibility_notes} />
          <InfoItem label="Food Allergies" value={clientRow.food_allergies} />
          <InfoItem label="Internal Notes" value={clientRow.notes} />
        </div>
      </div>

      {/* ── Client Notes ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Client Notes & Follow-Ups</h2>
          <ActionButton href={`/admin/clients/${clientRow.id}/notes/new`}>Add Client Note</ActionButton>
        </div>

        {clientNotesResult.error ? (
          <div>
            <p><strong>Error loading client notes:</strong></p>
            <pre>{JSON.stringify(clientNotesResult.error, null, 2)}</pre>
          </div>
        ) : clientNoteRows.length === 0 ? (
          <div style={{ padding: "12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
            <p style={{ margin: 0 }}>
              No client notes yet. Use the Add Client Note button to log follow-ups, preferences, document reminders, payment notes, or anything important.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-3">
              <div className="card">
                <span className="label">Open Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{openClientNotes.length}</p>
              </div>
              <div className="card">
                <span className="label">Completed Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{completedClientNotes.length}</p>
              </div>
              <div className="card">
                <span className="label">Total Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{clientNoteRows.length}</p>
              </div>
            </div>

            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Note</th>
                    <th>Follow-Up Date</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientNoteRows.map((note) => (
                    <tr key={note.id}>
                      <td><NoteStatusBadge isCompleted={note.is_completed} /></td>
                      <td>{note.note_type}</td>
                      <td>{note.title ?? "Not provided"}</td>
                      <td style={{ maxWidth: 360 }}>
                        <span style={{ display: "block", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                          {note.content ?? "Not provided"}
                        </span>
                      </td>
                      <td>{formatDate(note.follow_up_date, "")}</td>
                      <td>{formatDateTime(note.created_at, "")}</td>
                      <td>
                        <form action={updateClientNoteStatus}>
                          <input type="hidden" name="client_id" value={clientRow.id} />
                          <input type="hidden" name="note_id" value={note.id} />
                          <input type="hidden" name="is_completed" value={note.is_completed ? "false" : "true"} />
                          <button type="submit" className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap" }}>
                            {note.is_completed ? "Reopen" : "Mark Complete"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Traveler Numbers & Rewards ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Traveler Numbers & Rewards</h2>
          <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: "#f0f7f8", color: "var(--accent-dark)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
            {travelerProfileRows.length} Traveler{travelerProfileRows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div style={{ padding: "12px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", lineHeight: 1.6 }}>
          <strong>Security note:</strong> Traveler numbers, passport references, and rewards memberships may contain sensitive information. Only use these details when needed for trip planning, reservations, or client support.
        </div>

        {travelerProfilesResult.error ? (
          <div><p><strong>Error loading traveler profiles:</strong></p><pre>{JSON.stringify(travelerProfilesResult.error, null, 2)}</pre></div>
        ) : travelerLoyaltyNumbersResult.error ? (
          <div><p><strong>Error loading rewards memberships:</strong></p><pre>{JSON.stringify(travelerLoyaltyNumbersResult.error, null, 2)}</pre></div>
        ) : travelerProfileRows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>No traveler numbers or rewards memberships have been added by this client yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {travelerProfileRows.map((traveler) => {
              const travelerLoyaltyRows = travelerLoyaltyNumberRows.filter((l) => l.traveler_profile_id === traveler.id);
              return (
                <div key={traveler.id} className="card stack" style={{ background: "#fbfdfe" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{getTravelerName(traveler)}</h3>
                      <p style={{ margin: "4px 0 0", color: "#667085" }}>Added {formatDateTime(traveler.created_at)}</p>
                    </div>
                    <p style={{ margin: 0, color: "#667085" }}>Rewards Memberships: <strong>{travelerLoyaltyRows.length}</strong></p>
                  </div>

                  <div className="grid grid-3">
                    <InfoItem label="Date of Birth" value={formatDate(traveler.date_of_birth)} />
                    <InfoItem label="Known Traveler Number / KTN" value={<SensitiveField value={safeDecrypt(traveler.known_traveler_number)} />} />
                    <InfoItem label="Redress Number" value={<SensitiveField value={safeDecrypt(traveler.redress_number)} />} />
                    <InfoItem label="Global Entry PASSID" value={<SensitiveField value={safeDecrypt(traveler.global_entry_passid)} />} />
                    <InfoItem label="Passport Number" value={<SensitiveField value={safeDecrypt(traveler.passport_number)} />} />
                    <InfoItem label="Passport Country" value={traveler.passport_country} />
                    <InfoItem label="Passport Date Issued" value={formatDate(traveler.passport_date_issued)} />
                    <InfoItem label="Passport Expiration" value={formatDate(traveler.passport_expiration_date)} />
                    <InfoItem label="Traveler Notes" value={traveler.notes} />
                  </div>

                  <div className="card stack" style={{ background: "#ffffff" }}>
                    <h4 style={{ margin: 0 }}>Rewards Memberships</h4>
                    {travelerLoyaltyRows.length === 0 ? (
                      <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>No rewards memberships added for this traveler yet.</p>
                    ) : (
                      <div style={{ width: "100%", overflowX: "auto" }}>
                        <table className="table" style={{ minWidth: 860 }}>
                          <thead>
                            <tr><th>Type</th><th>Company</th><th>Program</th><th>Number</th><th>Notes</th><th>Added</th></tr>
                          </thead>
                          <tbody>
                            {travelerLoyaltyRows.map((loyalty) => (
                              <tr key={loyalty.id}>
                                <td><LoyaltyTypeBadge type={loyalty.loyalty_type} /></td>
                                <td>{loyalty.company_name}</td>
                                <td>{loyalty.program_name ?? "Not provided"}</td>
                                <td><SensitiveField value={safeDecrypt(loyalty.loyalty_number)} /></td>
                                <td className="preserve-formatting">{loyalty.notes ?? "Not provided"}</td>
                                <td>{formatDateTime(loyalty.created_at, "")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Passport Details ── */}
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Passport Details</h2>
        <div style={{ padding: "12px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", lineHeight: 1.6 }}>
          <strong>Security note:</strong> Passport details and uploaded passport images should be handled carefully and only opened when needed for trip support or documentation.
        </div>
        <div className="grid grid-2">
          <InfoItem label="Passport Number" value={<SensitiveField value={safeDecrypt(clientRow.passport_number)} />} />
          <InfoItem label="Passport Date Issued" value={formatDate(clientRow.passport_date_issued)} />
          <InfoItem label="Passport Expiration" value={formatDate(clientRow.passport_expiration_date)} />
        </div>
      </div>

      {/* ── Client Documents ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Client Documents</h2>
          <ActionButton href={`/admin/clients/${clientRow.id}/documents`}>View All Documents</ActionButton>
        </div>

        {clientDocumentsResult.error ? (
          <div><p><strong>Error loading client documents:</strong></p><pre>{JSON.stringify(clientDocumentsResult.error, null, 2)}</pre></div>
        ) : clientDocumentRows.length === 0 ? (
          <div style={{ padding: "12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>No client-uploaded documents found yet.</p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr><th>Type</th><th>Title</th><th>File Name</th><th>Uploaded</th></tr>
              </thead>
              <tbody>
                {clientDocumentRows.map((document) => (
                  <tr key={document.id}>
                    <td><DocumentTypeBadge type={document.document_type} /></td>
                    <td>{document.document_title}</td>
                    <td>{document.file_name}</td>
                    <td>{formatDateTime(document.created_at, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Travel Circle Access ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Travel Circle Access</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              See where this client is connected as a lead traveler, accepted Travel Companion, or pending invite.
            </p>
          </div>
          <ActionButton href={`/admin/trips/new?clientId=${clientRow.id}`}>Add Trip</ActionButton>
        </div>

        {travelCircleError ? (
          <div><p><strong>Error loading Travel Circle access:</strong></p><pre>{JSON.stringify(travelCircleError, null, 2)}</pre></div>
        ) : (
          <>
            <div className="grid grid-3">
              <div className="card">
                <span className="label">Owned / Lead Trips</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{tripRows.length}</p>
              </div>
              <div className="card">
                <span className="label">Shared With Client</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{sharedTravelCircleRows.length}</p>
              </div>
              <div className="card">
                <span className="label">Pending / Declined Invites</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>{pendingTravelCircleRows.length} / {declinedTravelCircleRows.length}</p>
              </div>
            </div>

            {sharedTravelCircleRows.length === 0 && pendingTravelCircleRows.length === 0 ? (
              <div style={{ padding: "12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2", color: "#667085", lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>This client does not currently have shared Travel Circle access or pending invitations.</p>
              </div>
            ) : null}

            {sharedTravelCircleRows.length > 0 ? (
              <div className="card stack" style={{ background: "#ffffff" }}>
                <h3 style={{ margin: 0 }}>Trips Shared With This Client</h3>
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table className="table" style={{ minWidth: 860 }}>
                    <thead>
                      <tr><th>Trip</th><th>Destination</th><th>Dates</th><th>Role</th><th>Status</th><th>Open</th></tr>
                    </thead>
                    <tbody>
                      {sharedTravelCircleRows.map((access) => {
                        const trip = getTravelCircleTrip(access);
                        return (
                          <tr key={access.id}>
                            <td>{trip?.trip_name ?? "Shared Trip"}</td>
                            <td>{trip?.destinations ?? "Not provided"}</td>
                            <td>{formatDate(trip?.departure_date, "")}{trip?.return_date ? ` → ${formatDate(trip.return_date, "")}` : ""}</td>
                            <td>{getTravelCircleRoleLabel(access.role)}</td>
                            <td><TravelCircleStatusBadge status={access.invite_status} /></td>
                            <td>{trip?.id ? <Link href={`/admin/trips/${trip.id}`} className="btn btn-primary">Open Trip</Link> : "Not available"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {pendingTravelCircleRows.length > 0 ? (
              <div className="card stack" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <h3 style={{ margin: 0 }}>Pending Travel Circle Invitations</h3>
                <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.6 }}>
                  Ask the traveler to create or log into Cozy Concierge using the invited email, then open Travel Invitations to accept shared trip access.
                </p>
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table className="table" style={{ minWidth: 860 }}>
                    <thead>
                      <tr><th>Trip</th><th>Invited Email</th><th>Role</th><th>Invited</th><th>Open</th></tr>
                    </thead>
                    <tbody>
                      {pendingTravelCircleRows.map((access) => {
                        const trip = getTravelCircleTrip(access);
                        return (
                          <tr key={access.id}>
                            <td>{trip?.trip_name ?? "Shared Trip"}</td>
                            <td>{access.invite_email ?? "Not provided"}</td>
                            <td>{getTravelCircleRoleLabel(access.role)}</td>
                            <td>{formatDateTime(access.created_at, "")}</td>
                            <td>{trip?.id ? <Link href={`/admin/trips/${trip.id}#travel-companions`} className="btn btn-primary">Open Trip</Link> : "Not available"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Linked Trips ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Linked Trips</h2>
          <ActionButton href={`/admin/trips/new?clientId=${clientRow.id}`}>Add Trip</ActionButton>
        </div>

        {tripsResult.error ? (
          <div><p><strong>Error loading trips:</strong></p><pre>{JSON.stringify(tripsResult.error, null, 2)}</pre></div>
        ) : tripRows.length === 0 ? (
          <div>
            <p>No trips linked to this client yet.</p>
            <p style={{ marginBottom: 0, color: "#64748b" }}>Use the Add Trip button to create this client&apos;s first trip record.</p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr><th>Trip Name</th><th>Destinations</th><th>Departure</th><th>Return</th><th>Status</th><th>Balance Due</th><th>Final Payment Due</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {tripRows.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.trip_name ?? "Trip"}</td>
                    <td>{trip.destinations ?? "Not provided"}</td>
                    <td>{formatDate(trip.departure_date, "")}</td>
                    <td>{formatDate(trip.return_date, "")}</td>
                    <td><StatusBadge status={trip.trip_status ?? "draft"} /></td>
                    <td>{formatMoney(trip.balance_due)}</td>
                    <td>{formatDate(trip.final_payment_due_date, "")}</td>
                    <td><Link href={`/admin/trips/${trip.id}`} className="btn btn-primary">Open Trip</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Travel Requests ── */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Travel Requests</h2>
          <ActionButton href="/admin/quote-requests">View All Requests</ActionButton>
        </div>

        {quoteRequestsResult.error ? (
          <div><p><strong>Error loading travel requests:</strong></p><pre>{JSON.stringify(quoteRequestsResult.error, null, 2)}</pre></div>
        ) : quoteRequestRows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No travel requests are linked to this client yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Destination</th><th>Departure</th><th>Return</th><th>Status</th><th>Submitted</th><th>Converted</th><th>Open</th></tr>
              </thead>
              <tbody>
                {quoteRequestRows.map((request) => (
                  <tr key={request.id}>
                    <td>{request.full_name ?? "Not provided"}</td>
                    <td>{request.email ?? "Not provided"}</td>
                    <td>{request.destinations ?? "Not provided"}</td>
                    <td>{formatDate(request.departure_date, "")}</td>
                    <td>{formatDate(request.return_date, "")}</td>
                    <td><StatusBadge status={request.status ?? "new"} /></td>
                    <td>{formatDateTime(request.submitted_at, "")}</td>
                    <td>{request.converted_trip_id ? "Yes" : "No"}</td>
                    <td><Link href={`/admin/quote-requests/${request.id}`} className="btn btn-primary">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="delete-client" className="card stack" style={{ border: "1px solid #fecaca", background: "#fff1f2" }}>
        <h2 style={{ margin: 0, color: "#be123c" }}>Delete Client</h2>
        <p style={{ margin: 0, color: "#9f1239", lineHeight: 1.6 }}>
          Client deletion is intentionally guarded. The app will only delete this client if there are no linked trips, travel requests, notes, documents, traveler profiles, messages, or Travel Circle records.
        </p>
        {deleteBlocked ? (
          <div style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 14, padding: 14 }}>
            <strong>Client was not deleted.</strong>
            <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
              This client still has linked app history. Use the normal guarded delete for clean records, or run the pre-launch database reset script if you are clearing test data before going live.
            </p>
          </div>
        ) : null}
        <div className="grid grid-3">
          <InfoItem label="Linked Trips" value={tripRows.length} />
          <InfoItem label="Travel Requests" value={quoteRequestRows.length} />
          <InfoItem label="Client Notes" value={clientNoteRows.length} />
          <InfoItem label="Recent Documents" value={clientDocumentRows.length} />
          <InfoItem label="Traveler Profiles" value={travelerProfileRows.length} />
          <InfoItem label="Travel Circle Records" value={travelCircleAccessRows.length} />
        </div>
        <form action={deleteClientAccount} className="stack" style={{ maxWidth: 520 }}>
          <input type="hidden" name="client_id" value={clientRow.id} />
          <label className="row" style={{ alignItems: "flex-start", color: "#9f1239", lineHeight: 1.5 }}>
            <input type="checkbox" name="delete_acknowledgement" style={{ marginTop: 4 }} />
            <span>I understand this permanently deletes the client record if no linked history exists.</span>
          </label>
          <label className="stack-sm">
            <span className="label" style={{ color: "#9f1239" }}>Second check: type DELETE CLIENT</span>
            <input className="input" name="delete_confirmation" placeholder="DELETE CLIENT" />
          </label>
          <button type="submit" className="btn btn-outline" style={{ color: "#be123c", borderColor: "#fecaca" }}>
            Delete Client
          </button>
        </form>
      </div>
    </PageShell>
  );
}
