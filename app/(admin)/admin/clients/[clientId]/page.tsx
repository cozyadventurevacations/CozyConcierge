import Link from "next/link";
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
    case "passport":
      return "Passport";
    case "minor_permission":
      return "Minor Permission Slip";
    case "minor_international_consent":
      return "Minor International Travel Consent";
    case "medical":
      return "Medical / Health Document";
    case "insurance":
      return "Travel Insurance Document";
    case "accessibility":
      return "Accessibility Document";
    case "supplier_required":
      return "Supplier-Required Document";
    case "general":
      return "General Travel Document";
    default:
      return type ?? "Unknown Document";
  }
}

function getTravelerName(traveler: TravelerProfileRow | null | undefined) {
  if (!traveler) return "Unnamed Traveler";

  return `${traveler.first_name ?? ""} ${traveler.middle_name ?? ""} ${
    traveler.last_name ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim() || "Unnamed Traveler";
}

function getLoyaltyTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "airline":
      return "Airline";
    case "hotel":
      return "Hotel";
    case "cruise":
      return "Cruise";
    case "rental_car":
      return "Rental Car";
    case "rail":
      return "Rail";
    case "theme_park":
      return "Theme Park";
    case "credit_card":
      return "Credit Card Travel Program";
    case "tour":
      return "Tour / Activity";
    case "vacation_package":
      return "Vacation Package / Supplier";
    default:
      return "Other";
  }
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  const isEmpty = value === null || value === undefined || value === "";

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
      {status ?? "unknown"}
    </span>
  );
}

function DocumentTypeBadge({ type }: { type: string | null | undefined }) {
  const isPassport = type === "passport";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isPassport ? "#fff7ed" : "#f0f7f8",
        color: isPassport ? "#c2410c" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {getDocumentTypeLabel(type)}
    </span>
  );
}

function NoteStatusBadge({ isCompleted }: { isCompleted: boolean | null | undefined }) {
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
      {isCompleted ? "completed" : "open"}
    </span>
  );
}

function LoyaltyTypeBadge({ type }: { type: string | null | undefined }) {
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
      {getLoyaltyTypeLabel(type)}
    </span>
  );
}

async function updateClientNoteStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const noteId = String(formData.get("note_id") ?? "").trim();
  const isCompleted = String(formData.get("is_completed") ?? "") === "true";

  if (!clientId) {
    throw new Error("Missing client ID.");
  }

  if (!noteId) {
    throw new Error("Missing note ID.");
  }

  const { error } = await supabase
    .from("client_notes")
    .update({
      is_completed: isCompleted,
    })
    .eq("id", noteId)
    .eq("client_account_id", clientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/clients/${clientId}`);
}

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase } = await requireAdmin();

  const { data: client, error: clientError } = await supabase
    .from("client_accounts")
    .select(
      `
      id,
      first_name,
      last_name,
      preferred_name,
      email,
      phone_primary,
      phone_secondary,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      date_of_birth,
      anniversary_date,
      preferred_airport,
      travel_style,
      airline_seating_preference,
      airline_class_preference,
      cruise_cabin_preference,
      travel_preference_notes,
      accessibility_notes,
      food_allergies,
      passport_number,
      passport_expiration_date,
      emergency_contact_name,
      emergency_contact_relationship,
      emergency_contact_phone,
      notes,
      created_at
      `,
    )
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return (
      <PageShell title="Client Detail" subtitle="We could not load this client.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
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
      .select(
        "id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, final_payment_due_date",
      )
      .eq("client_account_id", clientId)
      .order("departure_date", { ascending: true }),

    supabase
      .from("quote_requests")
      .select(
        "id, full_name, email, destinations, departure_date, return_date, status, submitted_at, converted_trip_id",
      )
      .eq("client_account_id", clientId)
      .order("submitted_at", { ascending: false }),

    supabase
      .from("client_notes")
      .select(
        "id, note_type, title, content, follow_up_date, is_completed, created_at, updated_at",
      )
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
      .select(
        "id, client_account_id, first_name, middle_name, last_name, date_of_birth, known_traveler_number, redress_number, global_entry_passid, passport_number, passport_country, passport_expiration_date, notes, created_at",
      )
      .eq("client_account_id", clientId)
      .order("created_at", { ascending: true }),

    supabase
      .from("traveler_loyalty_numbers")
      .select(
        "id, traveler_profile_id, client_account_id, loyalty_type, company_name, program_name, loyalty_number, traveler_name_snapshot, notes, created_at",
      )
      .eq("client_account_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const clientRow = client as ClientDetail;
  const tripRows = (tripsResult.data ?? []) as TripRow[];
  const quoteRequestRows = (quoteRequestsResult.data ?? []) as QuoteRequestRow[];
  const clientNoteRows = (clientNotesResult.data ?? []) as ClientNoteRow[];
  const clientDocumentRows = (clientDocumentsResult.data ?? []) as ClientDocumentRow[];
  const travelerProfileRows = (travelerProfilesResult.data ?? []) as TravelerProfileRow[];
  const travelerLoyaltyNumberRows = (
    travelerLoyaltyNumbersResult.data ?? []
  ) as TravelerLoyaltyNumberRow[];

  const clientName =
    `${clientRow.first_name ?? ""} ${clientRow.last_name ?? ""}`.trim() ||
    "Unnamed Client";

  const displayName = clientRow.preferred_name || clientName;

  const fullAddress = [
    clientRow.address_line_1,
    clientRow.address_line_2,
    [clientRow.city, clientRow.state, clientRow.postal_code]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  const totalBalanceDue = tripRows.reduce(
    (sum, trip) => sum + Number(trip.balance_due ?? 0),
    0,
  );

  const activeTrips = tripRows.filter(
    (trip) =>
      trip.trip_status !== "cancelled" &&
      trip.trip_status !== "travel_complete",
  );

  const openClientNotes = clientNoteRows.filter((note) => !note.is_completed);
  const completedClientNotes = clientNoteRows.filter((note) => note.is_completed);

  const passportDocuments = clientDocumentRows.filter(
    (document) => document.document_type === "passport",
  );

  const minorTravelDocuments = clientDocumentRows.filter(
    (document) =>
      document.document_type === "minor_permission" ||
      document.document_type === "minor_international_consent",
  );

  return (
    <PageShell
      title={displayName}
      subtitle="Client dashboard with contact details, travel history, requests, notes, documents, traveler numbers, and preferences."
    >
      {/* ── Action Buttons — all in one row ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <ActionButton href="/admin/clients">Back to Clients</ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/documents`}>
          View Client Documents
        </ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/notes/new`}>
          Add Client Note
        </ActionButton>
        <ActionButton href={`/admin/trips/new?clientId=${clientRow.id}`}>
          Add New Trip
        </ActionButton>
        <ActionButton href={`/admin/clients/${clientRow.id}/edit`}>
          Edit Client
        </ActionButton>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Trips</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {tripRows.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Active Trips</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {activeTrips.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Open Client Notes</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {openClientNotes.length}
          </p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Total Balance Due</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {formatMoney(totalBalanceDue)}
          </p>
        </div>

        <div className="card">
          <span className="label">Uploaded Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {clientDocumentRows.length}
          </p>
        </div>

        <div className="card">
          <span className="label">Passport Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {passportDocuments.length}
          </p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Minor Travel Documents</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800 }}>
            {minorTravelDocuments.length}
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Client Information & Emergency Contact</h2>

        <div className="grid grid-2">
          <InfoItem label="First Name" value={clientRow.first_name} />
          <InfoItem label="Last Name" value={clientRow.last_name} />
          <InfoItem label="Preferred Name" value={clientRow.preferred_name} />
          <InfoItem label="Email" value={clientRow.email} />
          <InfoItem label="Date of Birth" value={formatDate(clientRow.date_of_birth)} />
          <InfoItem
            label="Anniversary Date"
            value={formatDate(clientRow.anniversary_date)}
          />
          <InfoItem label="Primary Phone" value={clientRow.phone_primary} />
          <InfoItem label="Secondary Phone" value={clientRow.phone_secondary} />
          <InfoItem label="Address" value={fullAddress || null} />
          <InfoItem label="Emergency Contact Name" value={clientRow.emergency_contact_name} />
          <InfoItem
            label="Emergency Contact Relationship"
            value={clientRow.emergency_contact_relationship}
          />
          <InfoItem label="Emergency Contact Phone" value={clientRow.emergency_contact_phone} />
          <InfoItem label="Created" value={formatDateTime(clientRow.created_at)} />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Travel Preferences</h2>

        <div className="grid grid-2">
          <InfoItem label="Preferred Airport" value={clientRow.preferred_airport} />
          <InfoItem label="Travel Style" value={clientRow.travel_style} />
          <InfoItem
            label="Airline Seating Preference"
            value={clientRow.airline_seating_preference}
          />
          <InfoItem
            label="Airline Class Preference"
            value={clientRow.airline_class_preference}
          />
          <InfoItem
            label="Cruise Cabin Preference"
            value={clientRow.cruise_cabin_preference}
          />
          <InfoItem
            label="Additional Travel Preference Notes"
            value={clientRow.travel_preference_notes}
          />
          <InfoItem
            label="Accessibility / Mobility Notes"
            value={clientRow.accessibility_notes}
          />
          <InfoItem label="Food Allergies" value={clientRow.food_allergies} />
          <InfoItem label="Internal Notes" value={clientRow.notes} />
        </div>
      </div>

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Client Notes & Follow-Ups</h2>

          <ActionButton href={`/admin/clients/${clientRow.id}/notes/new`}>
            Add Client Note
          </ActionButton>
        </div>

        {clientNotesResult.error ? (
          <div>
            <p>
              <strong>Error loading client notes:</strong>
            </p>
            <pre>{JSON.stringify(clientNotesResult.error, null, 2)}</pre>
          </div>
        ) : clientNoteRows.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0 }}>
              No client notes yet. Use the Add Client Note button to log follow-ups,
              preferences, document reminders, payment notes, or anything important.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-3">
              <div className="card">
                <span className="label">Open Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                  {openClientNotes.length}
                </p>
              </div>

              <div className="card">
                <span className="label">Completed Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                  {completedClientNotes.length}
                </p>
              </div>

              <div className="card">
                <span className="label">Total Notes</span>
                <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
                  {clientNoteRows.length}
                </p>
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
                      <td>
                        <NoteStatusBadge isCompleted={note.is_completed} />
                      </td>
                      <td>{note.note_type}</td>
                      <td>{note.title ?? "Not provided"}</td>
                      <td style={{ maxWidth: 360 }}>
                        <span
                          style={{
                            display: "block",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.45,
                          }}
                        >
                          {note.content ?? "Not provided"}
                        </span>
                      </td>
                      <td>{formatDate(note.follow_up_date, "")}</td>
                      <td>{formatDateTime(note.created_at, "")}</td>
                      <td>
                        <form action={updateClientNoteStatus}>
                          <input type="hidden" name="client_id" value={clientRow.id} />
                          <input type="hidden" name="note_id" value={note.id} />
                          <input
                            type="hidden"
                            name="is_completed"
                            value={note.is_completed ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              whiteSpace: "nowrap",
                            }}
                          >
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

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Traveler Numbers & Rewards</h2>

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
            {travelerProfileRows.length} Traveler
            {travelerProfileRows.length === 1 ? "" : "s"}
          </span>
        </div>

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
          <strong>Security note:</strong> Traveler numbers, passport references, and
          rewards memberships may contain sensitive information. Only use these details
          when needed for trip planning, reservations, or client support.
        </div>

        {travelerProfilesResult.error ? (
          <div>
            <p>
              <strong>Error loading traveler profiles:</strong>
            </p>
            <pre>{JSON.stringify(travelerProfilesResult.error, null, 2)}</pre>
          </div>
        ) : travelerLoyaltyNumbersResult.error ? (
          <div>
            <p>
              <strong>Error loading rewards memberships:</strong>
            </p>
            <pre>{JSON.stringify(travelerLoyaltyNumbersResult.error, null, 2)}</pre>
          </div>
        ) : travelerProfileRows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            No traveler numbers or rewards memberships have been added by this client yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {travelerProfileRows.map((traveler) => {
              const travelerLoyaltyRows = travelerLoyaltyNumberRows.filter(
                (loyalty) => loyalty.traveler_profile_id === traveler.id,
              );

              return (
                <div
                  key={traveler.id}
                  className="card stack"
                  style={{ background: "#fbfdfe" }}
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
                      <h3 style={{ margin: 0 }}>{getTravelerName(traveler)}</h3>
                      <p style={{ margin: "4px 0 0", color: "#667085" }}>
                        Added {formatDateTime(traveler.created_at)}
                      </p>
                    </div>

                    <p style={{ margin: 0, color: "#667085" }}>
                      Rewards Memberships: <strong>{travelerLoyaltyRows.length}</strong>
                    </p>
                  </div>

                  <div className="grid grid-3">
                    <InfoItem
                      label="Date of Birth"
                      value={formatDate(traveler.date_of_birth)}
                    />
                    <InfoItem
                      label="Known Traveler Number / KTN"
                      value={<SensitiveField value={safeDecrypt(traveler.known_traveler_number)} />}
                    />
                    <InfoItem
                      label="Redress Number"
                      value={<SensitiveField value={safeDecrypt(traveler.redress_number)} />}
                    />
                    <InfoItem
                      label="Global Entry PASSID"
                      value={<SensitiveField value={safeDecrypt(traveler.global_entry_passid)} />}
                    />
                    <InfoItem
                      label="Passport Number"
                      value={<SensitiveField value={safeDecrypt(traveler.passport_number)} />}
                    />
                    <InfoItem label="Passport Country" value={traveler.passport_country} />
                    <InfoItem
                      label="Passport Expiration"
                      value={formatDate(traveler.passport_expiration_date)}
                    />
                    <InfoItem label="Traveler Notes" value={traveler.notes} />
                  </div>

                  <div className="card stack" style={{ background: "#ffffff" }}>
                    <h4 style={{ margin: 0 }}>Rewards Memberships</h4>

                    {travelerLoyaltyRows.length === 0 ? (
                      <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                        No rewards memberships added for this traveler yet.
                      </p>
                    ) : (
                      <div style={{ width: "100%", overflowX: "auto" }}>
                        <table className="table" style={{ minWidth: 860 }}>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Company</th>
                              <th>Program</th>
                              <th>Number</th>
                              <th>Notes</th>
                              <th>Added</th>
                            </tr>
                          </thead>

                          <tbody>
                            {travelerLoyaltyRows.map((loyalty) => (
                              <tr key={loyalty.id}>
                                <td>
                                  <LoyaltyTypeBadge type={loyalty.loyalty_type} />
                                </td>
                                <td>{loyalty.company_name}</td>
                                <td>{loyalty.program_name ?? "Not provided"}</td>
                                <td>
                                  <SensitiveField value={safeDecrypt(loyalty.loyalty_number)} />
                                </td>
                                <td>{loyalty.notes ?? "Not provided"}</td>
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

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Passport Details</h2>

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
          <strong>Security note:</strong> Passport details and uploaded passport
          images should be handled carefully and only opened when needed for trip
          support or documentation.
        </div>

        <div className="grid grid-2">
          <InfoItem
            label="Passport Number"
            value={<SensitiveField value={safeDecrypt(clientRow.passport_number)} />}
          />
          <InfoItem
            label="Passport Expiration"
            value={formatDate(clientRow.passport_expiration_date)}
          />
        </div>
      </div>

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Client Documents</h2>

          <ActionButton href={`/admin/clients/${clientRow.id}/documents`}>
            View All Documents
          </ActionButton>
        </div>

        {clientDocumentsResult.error ? (
          <div>
            <p>
              <strong>Error loading client documents:</strong>
            </p>
            <pre>{JSON.stringify(clientDocumentsResult.error, null, 2)}</pre>
          </div>
        ) : clientDocumentRows.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              No client-uploaded documents found yet.
            </p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                </tr>
              </thead>

              <tbody>
                {clientDocumentRows.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <DocumentTypeBadge type={document.document_type} />
                    </td>
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

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Linked Trips</h2>

          <ActionButton href={`/admin/trips/new?clientId=${clientRow.id}`}>
            Add Trip
          </ActionButton>
        </div>

        {tripsResult.error ? (
          <div>
            <p>
              <strong>Error loading trips:</strong>
            </p>
            <pre>{JSON.stringify(tripsResult.error, null, 2)}</pre>
          </div>
        ) : tripRows.length === 0 ? (
          <div>
            <p>No trips linked to this client yet.</p>
            <p style={{ marginBottom: 0, color: "#64748b" }}>
              Use the Add Trip button to create this client&apos;s first trip record.
            </p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Trip Name</th>
                  <th>Destinations</th>
                  <th>Departure</th>
                  <th>Return</th>
                  <th>Status</th>
                  <th>Balance Due</th>
                  <th>Final Payment Due</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {tripRows.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.trip_name ?? "Trip"}</td>
                    <td>{trip.destinations ?? "Not provided"}</td>
                    <td>{formatDate(trip.departure_date, "")}</td>
                    <td>{formatDate(trip.return_date, "")}</td>
                    <td>
                      <StatusBadge status={trip.trip_status ?? "draft"} />
                    </td>
                    <td>{formatMoney(trip.balance_due)}</td>
                    <td>{formatDate(trip.final_payment_due_date, "")}</td>
                    <td>
                      <Link href={`/admin/trips/${trip.id}`} className="btn btn-primary">
                        Open Trip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Travel Requests</h2>

          <ActionButton href="/admin/quote-requests">
            View All Requests
          </ActionButton>
        </div>

        {quoteRequestsResult.error ? (
          <div>
            <p>
              <strong>Error loading travel requests:</strong>
            </p>
            <pre>{JSON.stringify(quoteRequestsResult.error, null, 2)}</pre>
          </div>
        ) : quoteRequestRows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No travel requests are linked to this client yet.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Destination</th>
                  <th>Departure</th>
                  <th>Return</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Converted</th>
                  <th>Open</th>
                </tr>
              </thead>

              <tbody>
                {quoteRequestRows.map((request) => (
                  <tr key={request.id}>
                    <td>{request.full_name ?? "Not provided"}</td>
                    <td>{request.email ?? "Not provided"}</td>
                    <td>{request.destinations ?? "Not provided"}</td>
                    <td>{formatDate(request.departure_date, "")}</td>
                    <td>{formatDate(request.return_date, "")}</td>
                    <td>
                      <StatusBadge status={request.status ?? "new"} />
                    </td>
                    <td>{formatDateTime(request.submitted_at, "")}</td>
                    <td>{request.converted_trip_id ? "Yes" : "No"}</td>
                    <td>
                      <Link
                        href={`/admin/quote-requests/${request.id}`}
                        className="btn btn-primary"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}