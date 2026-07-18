/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InviteCompanionForm } from "../../messages/invite-companion-form";
import { PaymentTimeline } from "./payment-timeline";

// ─── Types ────────────────────────────────────────────────────────────────────

type TripRow = {
  id: string;
  client_account_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  cover_image_url?: string | null;
  balance_due: number | null;
  final_payment_due_date: string | null;
  occasion?: string | null;
  total_paid: number | null;
deposit_amount: number | null;
deposit_due_date: string | null;
deposit_paid: boolean | null;
  insurance_decision?: string | null;
  insurance_decision_at?: string | null;
};

type ProposalRow = {
  id: string;
  proposal_title: string | null;
  proposal_welcome_text: string | null;
  proposal_closing_text: string | null;
  planning_fee: number | null;
  total_price: number | null;
  proposal_status?: string | null;
  client_visible?: boolean | null;
  client_decision?: string | null;
  client_decision_at?: string | null;
  client_response_note?: string | null;
};

type TripNoteRow = {
  id: string;
  note_type: string;
  title: string | null;
  content: string | null;
};

type TripMemberRow = {
  id: string;
  invite_email: string | null;
  invite_name: string | null;
  role: string;
  invite_status: string;
  display_name: string;
  email: string | null;
};

type DocumentRow = {
  id: string;
  file_name: string;
  component_type: string | null;
  created_at: string | null;
  signedUrl: string | null;
};

type ClientDocumentRow = {
  id: string;
  document_type: string | null;
  title: string | null;
  file_name: string | null;
  uploaded_at: string | null;
  notes: string | null;
  signedUrl: string | null;
  isAttachedToTrip: boolean;
  linkedVisibility: string | null;
};

type TimelineGroup = {
  dateKey: string;
  dateLabel: string;
  events: { icon: string; title: string; details: string; time?: string }[];
};

type HotelData = {
  name: string | null;
  address: string | null;
  stars: string | number | null;
  checkIn: string | null;
  checkOut: string | null;
  roomCategory: string | null;
  roomDescription: string | null;
  hotelDescription: string | null;
  confirmationNumber: string | null;
  nightlyRate: number | null;
  totalPrice: number | null;
  bookingStatus: string | null;
  supplier: string | null;
} | null;

type FlightData = {
  flightType: string | null;
  supplier: string | null;
  travelerCount: number | null;
  rateClass: string | null;
  airlineLocator: string | null;
  confirmationNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
  outbound: {
    route: string;
    flight: string;
    departure: string;
    arrival: string;
    cabinClass: string | null;
    seat: string | null;
  } | null;
  outboundSegments?: {
    route: string;
    flight: string;
    departure: string;
    arrival: string;
    cabinClass: string | null;
    seat: string | null;
  }[];
  returnFlight: {
    route: string;
    flight: string;
    departure: string;
    arrival: string;
    cabinClass: string | null;
    seat: string | null;
  } | null;
  returnSegments?: {
    route: string;
    flight: string;
    departure: string;
    arrival: string;
    cabinClass: string | null;
    seat: string | null;
  }[];
} | null;

type CruiseData = {
  cruiseLine: string | null;
  shipName: string | null;
  sailingDate: string | null;
  returnDate: string | null;
  departurePort: string | null;
  arrivalPort: string | null;
  cabinCategory: string | null;
  cabinNumber: string | null;
  diningSeating: string | null;
  description: string | null;
  confirmationNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
  supplier: string | null;
} | null;

type TransferData = {
  supplier: string | null;
  pickupDatetime: string | null;
  passengerCount: number | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  vehicleType: string | null;
  notes: string | null;
  confirmationNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
} | null;

type RentalCarData = {
  supplier: string | null;
  company: string | null;
  pickupDatetime: string | null;
  returnDatetime: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  vehicleClass: string | null;
  driverCount: number | null;
  notes: string | null;
  confirmationNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
} | null;

type ActivityData = {
  name: string | null;
  supplier: string | null;
  datetime: string | null;
  location: string | null;
  participantCount: number | null;
  notes: string | null;
  confirmationNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
} | null;

type InsuranceData = {
  provider: string | null;
  planName: string | null;
  quoteOptions: InsuranceQuoteOption[];
  coverageStart: string | null;
  coverageEnd: string | null;
  travelersCount: number | null;
  claimPhone: string | null;
  notes: string | null;
  policyNumber: string | null;
  totalPrice: number | null;
  bookingStatus: string | null;
} | null;

type InsuranceQuoteOption = {
  optionNumber: number;
  providerName: string | null;
  planName: string | null;
  premiumAmount: number | null;
  coverageDescription: string | null;
  brochureUrl: string | null;
};

type TripDetailClientProps = {
  trip: TripRow;
  proposal: ProposalRow | null;
  clientNote: TripNoteRow | null;
  clientReminder: TripNoteRow | null;
  tripMembers: TripMemberRow[];
  isPrimaryClient: boolean;
  canManageTravelCircle: boolean;
  documents: DocumentRow[];
  clientDocuments: ClientDocumentRow[];
  canAttachClientDocuments: boolean;
  timelineGroups: TimelineGroup[];
  hotel: HotelData;
  flight: FlightData;
  cruise: CruiseData;
  transfer: TransferData;
  rentalCar: RentalCarData;
  activity: ActivityData;
  insurance: InsuranceData;
  advisorEmail: string;
  agencyWebsite: string;
  onInviteCompanion: (formData: FormData) => Promise<void>;
  onRemoveCompanion: (formData: FormData) => Promise<void>;
  onAttachClientDocument: (formData: FormData) => Promise<void>;
  onProposalDecision: (formData: FormData) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number | null | undefined, fallback = "Not provided") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function fmtMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function fmtDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtDateTime(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function getTripProgressStep(status: string | null | undefined, trip: TripRow) {
  const normalized = status ?? "draft";
  if (normalized === "travel_complete" || normalized === "completed") return 4;
  if (trip.departure_date) {
    const departure = new Date(`${trip.departure_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(departure.getTime()) && departure <= today) return 4;
  }
  if (normalized === "paid_in_full" || Number(trip.balance_due ?? 0) <= 0) return 3;
  if (normalized === "confirmed" || normalized === "pending_final_payment") return 2;
  if (normalized === "reserved") return 1;
  if (normalized === "quoted") return 0;
  return 0;
}

function TripStatusTimeline({ trip }: { trip: TripRow }) {
  const activeStep = getTripProgressStep(trip.trip_status, trip);
  const steps = [
    { label: "Quote", helper: "Options prepared" },
    { label: "Reserved", helper: "Space held" },
    { label: "Confirmed", helper: "Booking secured" },
    { label: "Paid", helper: "Balance complete" },
    { label: "Travel", helper: "Ready to go" },
  ];

  return (
    <div className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
          Trip Progress
        </p>
        <h2 style={{ margin: "4px 0 0" }}>Where Your Trip Stands</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }} className="trip-status-timeline">
        {steps.map((step, index) => {
          const isDone = index < activeStep;
          const isCurrent = index === activeStep;
          return (
            <div
              key={step.label}
              style={{
                padding: "12px 10px",
                borderRadius: 14,
                border: isCurrent ? "1px solid #62a9cf" : "1px solid #e6f0f2",
                background: isDone ? "#ecfdf3" : isCurrent ? "#f0f7f8" : "#ffffff",
                color: isDone ? "#027a48" : isCurrent ? "var(--accent-dark)" : "#667085",
                textAlign: "center",
                minHeight: 92,
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 999, margin: "0 auto 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: isDone ? "#027a48" : isCurrent ? "var(--accent-dark)" : "#e6f0f2", color: isDone || isCurrent ? "#ffffff" : "#667085", fontWeight: 900 }}>
                {isDone ? "✓" : index + 1}
              </div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 13 }}>{step.label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.35 }}>{step.helper}</p>
            </div>
          );
        })}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .trip-status-timeline { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
function TripCoverHero({ trip }: { trip: TripRow }) {
  const hasCover = Boolean(trip.cover_image_url);
  const dateLabel = trip.departure_date
    ? `${fmtDate(trip.departure_date)}${trip.return_date ? ` to ${fmtDate(trip.return_date)}` : ""}`
    : "Dates coming soon";

  return (
    <section
      style={{
        minHeight: 320,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #dbeafe",
        background: hasCover
          ? "#123f5b"
          : "linear-gradient(135deg, #eef7fb 0%, #ffffff 62%, #f7fbfc 100%)",
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        boxShadow: "0 18px 45px rgba(18, 63, 91, 0.08)",
      }}
    >
      {hasCover ? (
        <img
          src={trip.cover_image_url ?? ""}
          alt={trip.trip_name ?? "Trip cover image"}
          style={{ width: "100%", height: 360, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ textAlign: "center" }}>
            <img src="/cozy-logo.png" alt="Cozy Adventure Vacations" style={{ width: "min(280px, 72vw)", height: "auto", opacity: 0.95 }} />
            <p style={{ margin: "14px 0 0", color: "#5e7e8f", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11 }}>
              Your next adventure is taking shape
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hasCover
            ? "linear-gradient(180deg, rgba(18, 63, 91, 0.04) 0%, rgba(18, 63, 91, 0.78) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(240,247,248,0.84) 100%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", left: 24, right: 24, bottom: 22, color: hasCover ? "#ffffff" : "var(--accent-dark)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ display: "inline-flex", borderRadius: 999, padding: "6px 10px", background: hasCover ? "rgba(255,255,255,0.18)" : "#ffffff", border: hasCover ? "1px solid rgba(255,255,255,0.28)" : "1px solid #dbeafe", fontSize: 12, fontWeight: 900 }}>
            Cozy Concierge Trip
          </span>
          <span style={{ display: "inline-flex", borderRadius: 999, padding: "6px 10px", background: hasCover ? "rgba(255,255,255,0.18)" : "#ffffff", border: hasCover ? "1px solid rgba(255,255,255,0.28)" : "1px solid #dbeafe", fontSize: 12, fontWeight: 800 }}>
            {dateLabel}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: 1.05, maxWidth: 780 }}>
          {trip.trip_name ?? "Your Trip"}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 16, opacity: 0.94, maxWidth: 720, lineHeight: 1.45 }}>
          {trip.destinations ?? "Your travel details are ready when you are."}
        </p>
      </div>
    </section>
  );
}
function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "draft";
  const colors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: "#eaf3de", color: "#3b6d11" },
    active: { bg: "#eaf3de", color: "#3b6d11" },
    completed: { bg: "#f0f7f8", color: "#123f5b" },
    cancelled: { bg: "#fef2f2", color: "#991b1b" },
    draft: { bg: "#f0f7f8", color: "#123f5b" },
  };
  const style = colors[s] ?? colors.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 12px", background: style.bg, color: style.color, fontWeight: 700, fontSize: 13 }}>
      {s}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = fmt(value);
  const isEmpty = display === "Not provided";
  return (
    <div style={{ padding: "12px", border: "1px solid #eef2f5", borderRadius: 12, background: "#fbfdfe" }}>
      <span className="label">{label}</span>
      <p className="preserve-formatting" style={{ margin: "6px 0 0", lineHeight: 1.45, color: isEmpty ? "#aab8c2" : "inherit", fontStyle: isEmpty ? "italic" : "normal" }}>{display}</p>
    </div>
  );
}

function PriceItem({ label, value }: { label: string; value: number | null | undefined }) {
  return <InfoItem label={label} value={fmtMoney(value)} />;
}

function getComponentTypeLabel(componentType: string | null | undefined) {
  const labels: Record<string, string> = {
    hotel: "Hotel",
    air: "Air",
    cruise: "Cruise",
    transfer: "Transfer",
    rental_car: "Rental Car",
    activity: "Activity",
    insurance: "Insurance",
  };

  return componentType ? labels[componentType] ?? componentType : "General";
}

function getDocumentTypeLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    passport: "Passport",
    minor_permission: "Minor Permission Slip",
    minor_international_consent: "Minor International Travel Consent",
    medical: "Medical / Health Document",
    insurance: "Travel Insurance Document",
    accessibility: "Accessibility Document",
    supplier_required: "Supplier-Required Document",
    general: "General Document",
  };

  return type ? labels[type] ?? type : "Document";
}

function SectionCard({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card stack" style={{ border: "1px solid #e6f0f2" }}>
      <div>
        {eyebrow && <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>{eyebrow}</p>}
        <h2 style={{ margin: eyebrow ? "4px 0 0" : 0 }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 14 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Collapsible({ title, eyebrow, subtitle, children, defaultOpen = false }: { title: string; eyebrow?: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e6f0f2", borderRadius: 16, background: "#ffffff", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", cursor: "pointer", padding: "14px 16px", background: "#f7fbfc", borderBottom: open ? "1px solid #e6f0f2" : "none", color: "var(--accent-dark)", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", textAlign: "left" }}
      >
        <div>
          {eyebrow && <span style={{ display: "block", marginBottom: 2, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{eyebrow}</span>}
          <span style={{ fontSize: 15 }}>{title}</span>
          {subtitle && <span style={{ display: "block", marginTop: 2, color: "#667085", fontWeight: 500, fontSize: 13 }}>{subtitle}</span>}
        </div>
        <span style={{ fontSize: 18, marginLeft: 12 }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="card stack" style={{ border: "none", borderRadius: 0 }}>{children}</div>}
    </div>
  );
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.5, listStyle: "none" }}>
      <span aria-hidden style={{ width: 22, height: 22, minWidth: 22, borderRadius: 999, background: "#f0f7f8", color: "var(--accent-dark)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, marginTop: 1 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

function TravelCompanionBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    owner: { bg: "#ecfdf3", color: "#027a48", label: "Owner" },
    contributor: { bg: "#f0f7f8", color: "var(--accent-dark)", label: "Contributor" },
    viewer: { bg: "#f8fafc", color: "#475569", label: "Viewer" },
  };
  const style = map[role] ?? map.viewer;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", background: style.bg, color: style.color, fontWeight: 800, fontSize: 12 }}>
      {style.label}
    </span>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "proposal", label: "Proposal" },
  { id: "itinerary", label: "Itinerary" },
  { id: "documents", label: "Documents" },
  { id: "travel-circle", label: "Travel Circle" },
  { id: "help", label: "Help" },
] as const;

type TabId = typeof BASE_TABS[number]["id"];

// ─── Tab panels ───────────────────────────────────────────────────────────────


function formatProposalMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "Not set";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatProposalDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getProposalStatusLabel(status: string | null | undefined, decision: string | null | undefined) {
  if (decision === "approved") return "Approved";
  if (decision === "declined") return "Declined";
  if (status === "sent") return "Awaiting your response";
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  return "Draft";
}

function hasAnsweredInsuranceDecision(trip: TripRow) {
  const normalized = String(trip.insurance_decision ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return Boolean(
    trip.insurance_decision_at ||
      ["accepted", "accept", "yes", "declined", "decline", "no", "waived", "coverage_accepted", "coverage_declined"].includes(normalized),
  );
}

function ProposalPaymentDetails({ trip }: { trip: TripRow }) {
  return (
    <section className="card stack" style={{ border: "1px solid #e6f0f2" }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Proposal Payment Details
        </p>

        <h3 style={{ margin: "4px 0 0" }}>Payment Milestones</h3>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          Key deposit and final payment dates for this proposal.
        </p>
      </div>

      <div className="grid grid-3">
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Deposit Amount</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900 }}>
            {formatProposalMoney(trip.deposit_amount)}
          </p>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
          }}
        >
          <span className="label">Deposit Due Date</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900 }}>
            {formatProposalDate(trip.deposit_due_date)}
          </p>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <span className="label">Final Payment Due Date</span>
          <p style={{ margin: "4px 0 0", fontWeight: 900, color: "#6b3a08" }}>
            {formatProposalDate(trip.final_payment_due_date)}
          </p>
        </div>
      </div>
    </section>
  );
}

function TravelReadinessChecklist({
  trip,
  documents,
  clientDocuments,
  tripMembers,
}: {
  trip: TripRow;
  documents: DocumentRow[];
  clientDocuments: ClientDocumentRow[];
  tripMembers: TripMemberRow[];
}) {
  const passportUploaded = clientDocuments.some((document) => document.document_type === "passport");
  const sharedDocumentsReady = documents.length > 0;
  const paymentReady = Number(trip.balance_due ?? 0) <= 0;
  const tripDetailsReady = Boolean(trip.destinations && trip.departure_date && trip.return_date);
  const activeMembers = tripMembers.filter((member) => member.invite_status === "active");
  const travelCircleReady = activeMembers.length > 0;

  const items = [
    {
      label: "Trip details",
      helper: tripDetailsReady ? "Dates and destination are on file." : "Some trip details are still being finalized.",
      complete: tripDetailsReady,
    },
    {
      label: "Passport on file",
      helper: passportUploaded ? "Passport document is uploaded." : "Upload your passport so your advisor has it when needed.",
      complete: passportUploaded,
      href: "/profile/passport-upload",
    },
    {
      label: "Payment status",
      helper: paymentReady ? "No balance is currently due." : `${fmtMoney(trip.balance_due)} balance remains.`,
      complete: paymentReady,
      href: `/trips/${trip.id}/request-payment`,
    },
    {
      label: "Shared documents",
      helper: sharedDocumentsReady ? `${documents.length} shared document${documents.length === 1 ? "" : "s"} available.` : "Trip documents will appear here when shared by your advisor.",
      complete: sharedDocumentsReady,
      href: `/trips/${trip.id}/documents`,
    },
    {
      label: "Travel Circle",
      helper: travelCircleReady ? `${activeMembers.length} traveler${activeMembers.length === 1 ? "" : "s"} connected.` : "Invite companions when you want them included.",
      complete: travelCircleReady,
    },
  ];

  const completedCount = items.filter((item) => item.complete).length;
  const percentComplete = Math.round((completedCount / items.length) * 100);

  return (
    <SectionCard
      eyebrow="Readiness"
      title="Travel Readiness Checklist"
      subtitle="A quick snapshot of what is ready and what may still need attention before departure."
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ height: 10, borderRadius: 999, background: "#e6f0f2", overflow: "hidden" }}>
              <div
                style={{
                  width: `${percentComplete}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: percentComplete === 100 ? "#3d8c4e" : "#62a9cf",
                }}
              />
            </div>
          </div>
          <strong style={{ color: "var(--accent-dark)", whiteSpace: "nowrap" }}>
            {completedCount} of {items.length} ready
          </strong>
        </div>

        <div className="grid grid-2">
          {items.map((item) => {
            const content = (
              <div
                style={{
                  height: "100%",
                  padding: 14,
                  borderRadius: 14,
                  border: item.complete ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                  background: item.complete ? "#f0fdf4" : "#fff7ed",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <p style={{ margin: 0, fontWeight: 900, color: item.complete ? "#166534" : "#854d0e" }}>
                    {item.label}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 900, color: item.complete ? "#166534" : "#c2410c" }}>
                    {item.complete ? "Ready" : "Check"}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", color: item.complete ? "#166534" : "#92400e", fontSize: 13, lineHeight: 1.5 }}>
                  {item.helper}
                </p>
              </div>
            );

            return item.href ? (
              <Link key={item.label} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                {content}
              </Link>
            ) : (
              <div key={item.label}>{content}</div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function ProposalDecisionCard({
  trip,
  proposal,
  isPrimaryClient,
  onProposalDecision,
}: {
  trip: TripRow;
  proposal: ProposalRow;
  isPrimaryClient: boolean;
  onProposalDecision: (formData: FormData) => Promise<void>;
}) {
  const decision = proposal.client_decision ?? null;
  const isDecided = decision === "approved" || decision === "declined";
  const needsInsuranceDecision = isPrimaryClient && !hasAnsweredInsuranceDecision(trip);

  return (
    <SectionCard
      eyebrow="Client Approval"
      title={isDecided ? `Proposal ${getProposalStatusLabel(proposal.proposal_status, decision)}` : "Approve This Proposal"}
      subtitle={isDecided ? "Your advisor has your response on file." : "Approve when these options look good, or decline and tell your advisor what needs to change."}
    >
      {isDecided ? (
        <div className="grid grid-2">
          <InfoItem label="Decision" value={getProposalStatusLabel(proposal.proposal_status, decision)} />
          <InfoItem label="Recorded" value={fmtDateTime(proposal.client_decision_at, "Not provided")} />
          {proposal.client_response_note && <InfoItem label="Note" value={proposal.client_response_note} />}
        </div>
      ) : isPrimaryClient ? (
        <form action={onProposalDecision} className="stack">
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="proposal_id" value={proposal.id} />

          {needsInsuranceDecision && (
            <div className="card stack" style={{ border: "1px solid #fed7aa", background: "#fff7ed" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900, color: "#9a3412" }}>Travel Insurance</p>
                <p style={{ margin: "6px 0 0", color: "#9a3412", lineHeight: 1.6, fontSize: 14 }}>
                  Choose whether you want Cozy Adventure Vacations to review travel insurance coverage options for this trip.
                </p>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#7c2d12", fontWeight: 800 }}>
                <input type="radio" name="insurance_decision" value="accepted" required />
                Yes, review travel insurance coverage options.
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#7c2d12", fontWeight: 800 }}>
                <input type="radio" name="insurance_decision" value="declined" required />
                I decline travel insurance coverage review for this trip.
              </label>
            </div>
          )}

          <label>
            <span className="label">Optional note to your advisor</span>
            <textarea
              className="textarea"
              name="client_response_note"
              placeholder="Add any changes, questions, or approval notes."
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" name="proposal_decision" value="approved" className="btn btn-primary">
              Approve Proposal
            </button>
            <button type="submit" name="proposal_decision" value="declined" className="btn btn-outline" formNoValidate>
              Decline / Request Changes
            </button>
          </div>
        </form>
      ) : (
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Only the lead traveler can approve or decline this proposal.
        </p>
      )}
    </SectionCard>
  );
}

function OverviewTab({ trip, proposal, clientNote, clientReminder, documents, clientDocuments, tripMembers }: { trip: TripRow; proposal: ProposalRow | null; clientNote: TripNoteRow | null; clientReminder: TripNoteRow | null; documents: DocumentRow[]; clientDocuments: ClientDocumentRow[]; tripMembers: TripMemberRow[] }) {
  return (
    <div className="stack">
      {clientReminder && (
        <div className="card stack" style={{ borderLeft: "4px solid var(--accent-dark)", background: "#f7fbfc", borderRadius: "0 16px 16px 0" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Important Reminder</p>
          <h3 style={{ margin: "4px 0 0" }}>{clientReminder.title ?? "Reminders Before You Travel"}</h3>
          <p className="preserve-formatting" style={{ margin: 0, lineHeight: 1.65, color: "#374151" }}>{clientReminder.content}</p>
        </div>
      )}

      <TravelReadinessChecklist
        trip={trip}
        documents={documents}
        clientDocuments={clientDocuments}
        tripMembers={tripMembers}
      />

      <PaymentTimeline
  totalPaid={trip.total_paid ?? null}
  balanceDue={trip.balance_due ?? null}
  depositAmount={trip.deposit_amount ?? null}
  depositDueDate={trip.deposit_due_date ?? null}
  depositPaid={trip.deposit_paid ?? null}
  finalPaymentDueDate={trip.final_payment_due_date ?? null}
  departureDate={trip.departure_date ?? null}
  tripStatus={trip.trip_status ?? null}
/>

      <ProposalPaymentDetails trip={trip} />

      <SectionCard eyebrow="Overview" title="Trip Details">
        <div className="grid grid-2">
          <InfoItem label="Trip Name" value={trip.trip_name} />
          <InfoItem label="Destinations" value={trip.destinations} />
          <InfoItem label="Departure" value={fmtDate(trip.departure_date)} />
          <InfoItem label="Return" value={fmtDate(trip.return_date)} />
          {trip.occasion && <InfoItem label="Occasion" value={trip.occasion} />}
        </div>
      </SectionCard>

      {proposal && (
        <SectionCard eyebrow="Proposal" title="Proposal Summary">
          <div className="grid grid-2">
            <InfoItem label="Proposal Title" value={proposal.proposal_title} />
            <PriceItem label="Planning Fee" value={proposal.planning_fee} />
            <PriceItem label="Calculated Trip Total" value={proposal.total_price} />
          </div>
          {proposal.proposal_welcome_text && (
            <div>
              <span className="label">Welcome Note</span>
              <p className="preserve-formatting" style={{ lineHeight: 1.7, margin: "6px 0 0", color: "#374151" }}>{proposal.proposal_welcome_text}</p>
            </div>
          )}
          {proposal.proposal_closing_text && (
            <div>
              <span className="label">Closing Note</span>
              <p className="preserve-formatting" style={{ lineHeight: 1.7, margin: "6px 0 0", color: "#374151" }}>{proposal.proposal_closing_text}</p>
            </div>
          )}
        </SectionCard>
      )}

      {clientNote && (
        <div className="card stack" style={{ borderLeft: "4px solid var(--accent-dark)", borderRadius: "0 16px 16px 0" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Advisor Note</p>
          <h3 style={{ margin: "4px 0 0" }}>{clientNote.title ?? "Notes from Your Advisor"}</h3>
          <p className="preserve-formatting" style={{ lineHeight: 1.65, margin: 0, color: "#374151" }}>{clientNote.content}</p>
        </div>
      )}
    </div>
  );
}

function ItineraryTab({ timelineGroups, hotel, flight, cruise, transfer, rentalCar, activity, insurance }: { timelineGroups: TimelineGroup[]; hotel: HotelData; flight: FlightData; cruise: CruiseData; transfer: TransferData; rentalCar: RentalCarData; activity: ActivityData; insurance: InsuranceData }) {
  const hasAnyComponent = hotel || flight || cruise || transfer || rentalCar || activity || insurance;

  return (
    <div className="stack">
      {timelineGroups.length > 0 ? (
        <SectionCard eyebrow="Timeline" title="Day-by-Day Overview">
          <div style={{ display: "grid", gap: 16 }}>
            {timelineGroups.map((group, i) => (
              <div key={group.dateKey} style={{ border: "1px solid #eef2f5", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#f7fbfc", borderBottom: "1px solid #e6f0f2" }}>
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Day {i + 1}</p>
                  <h3 style={{ margin: "3px 0 0" }}>{group.dateLabel}</h3>
                </div>
                <div style={{ display: "grid", gap: 10, padding: 12 }}>
                  {group.events.map((event, j) => (
                    <div key={j} style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 12, alignItems: "start", padding: 12, border: "1px solid #eef2f5", borderRadius: 14, background: "#fbfdfe" }}>
                      <div aria-hidden style={{ width: 42, height: 42, borderRadius: 999, background: "#f0f7f8", color: "var(--accent-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{event.icon}</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800 }}>{event.title}</p>
                        <p style={{ margin: "4px 0 0", color: "var(--accent-dark)", fontWeight: 700, fontSize: 13 }}>{event.time ?? group.dateLabel}</p>
                        {event.details && <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 13 }}>{event.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : (
        <div className="card" style={{ border: "1px solid #e6f0f2", color: "#667085" }}>
          <p style={{ margin: 0 }}>No timeline events yet. Your itinerary will appear here once your advisor adds trip components.</p>
        </div>
      )}

      {hasAnyComponent && (
        <SectionCard eyebrow="Components" title="Trip Details">
          <div className="stack">
            {hotel && (
              <Collapsible eyebrow="Stay" title="Hotel" subtitle={hotel.name ?? undefined} defaultOpen>
                <div className="grid grid-2">
                  <InfoItem label="Hotel" value={hotel.name} />
                  <InfoItem label="Supplier" value={hotel.supplier} />
                  <InfoItem label="Status" value={hotel.bookingStatus} />
                  <InfoItem label="Address" value={hotel.address} />
                  <InfoItem label="Stars" value={hotel.stars} />
                  <InfoItem label="Check-in" value={fmtDate(hotel.checkIn)} />
                  <InfoItem label="Check-out" value={fmtDate(hotel.checkOut)} />
                  <InfoItem label="Room Category" value={hotel.roomCategory} />
                  <InfoItem label="Confirmation" value={hotel.confirmationNumber} />
                  <PriceItem label="Nightly Rate" value={hotel.nightlyRate} />
                  <PriceItem label="Total" value={hotel.totalPrice} />
                </div>
                {hotel.roomDescription && <InfoItem label="Room Description" value={hotel.roomDescription} />}
                {hotel.hotelDescription && <InfoItem label="Hotel Description" value={hotel.hotelDescription} />}
              </Collapsible>
            )}

            {flight && (
              <Collapsible eyebrow="Flights" title="Air Travel" defaultOpen>
                <div className="grid grid-2">
                  <InfoItem label="Flight Type" value={flight.flightType} />
                  <InfoItem label="Airline" value={flight.supplier} />
                  <InfoItem label="Status" value={flight.bookingStatus} />
                  <InfoItem label="Travelers" value={flight.travelerCount} />
                  <InfoItem label="Rate Class" value={flight.rateClass} />
                  <InfoItem label="Locator" value={flight.airlineLocator} />
                  <InfoItem label="Confirmation" value={flight.confirmationNumber} />
                  <PriceItem label="Total" value={flight.totalPrice} />
                </div>
                {(flight.outboundSegments?.length ? flight.outboundSegments : flight.outbound ? [flight.outbound] : []).map((segment, index) => (
                  <div key={`outbound-${index}`} className="card stack" style={{ background: "#f7fbfc" }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-dark)" }}>
                      Outbound {index === 0 ? "Flight" : "Connection"}
                    </p>
                    <div className="grid grid-2">
                      <InfoItem label="Route" value={segment.route} />
                      <InfoItem label="Flight" value={segment.flight} />
                      <InfoItem label="Departure" value={segment.departure} />
                      <InfoItem label="Arrival" value={segment.arrival} />
                      <InfoItem label="Cabin" value={segment.cabinClass} />
                      <InfoItem label="Seat" value={segment.seat} />
                    </div>
                  </div>
                ))}
                {(flight.returnSegments?.length ? flight.returnSegments : flight.returnFlight ? [flight.returnFlight] : []).map((segment, index) => (
                  <div key={`return-${index}`} className="card stack" style={{ background: "#f7fbfc" }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-dark)" }}>
                      Return {index === 0 ? "Flight" : "Connection"}
                    </p>
                    <div className="grid grid-2">
                      <InfoItem label="Route" value={segment.route} />
                      <InfoItem label="Flight" value={segment.flight} />
                      <InfoItem label="Departure" value={segment.departure} />
                      <InfoItem label="Arrival" value={segment.arrival} />
                      <InfoItem label="Cabin" value={segment.cabinClass} />
                      <InfoItem label="Seat" value={segment.seat} />
                    </div>
                  </div>
                ))}
              </Collapsible>
            )}

            {cruise && (
              <Collapsible eyebrow="Sailing" title="Cruise" subtitle={cruise.shipName ?? undefined}>
                <div className="grid grid-2">
                  <InfoItem label="Cruise Line" value={cruise.cruiseLine} />
                  <InfoItem label="Ship" value={cruise.shipName} />
                  <InfoItem label="Status" value={cruise.bookingStatus} />
                  <InfoItem label="Confirmation" value={cruise.confirmationNumber} />
                  <InfoItem label="Sailing Date" value={fmtDate(cruise.sailingDate)} />
                  <InfoItem label="Return" value={fmtDate(cruise.returnDate)} />
                  <InfoItem label="Departure Port" value={cruise.departurePort} />
                  <InfoItem label="Arrival Port" value={cruise.arrivalPort} />
                  <InfoItem label="Cabin Category" value={cruise.cabinCategory} />
                  <InfoItem label="Cabin Number" value={cruise.cabinNumber} />
                  <InfoItem label="Dining" value={cruise.diningSeating} />
                  <PriceItem label="Total" value={cruise.totalPrice} />
                </div>
                {cruise.description && <InfoItem label="Description" value={cruise.description} />}
              </Collapsible>
            )}

            {transfer && (
              <Collapsible eyebrow="Ground" title="Transfer">
                <div className="grid grid-2">
                  <InfoItem label="Supplier" value={transfer.supplier} />
                  <InfoItem label="Status" value={transfer.bookingStatus} />
                  <InfoItem label="Pickup" value={fmtDateTime(transfer.pickupDatetime)} />
                  <InfoItem label="Passengers" value={transfer.passengerCount} />
                  <InfoItem label="Pickup Location" value={transfer.pickupLocation} />
                  <InfoItem label="Dropoff" value={transfer.dropoffLocation} />
                  <InfoItem label="Vehicle" value={transfer.vehicleType} />
                  <InfoItem label="Confirmation" value={transfer.confirmationNumber} />
                  <PriceItem label="Total" value={transfer.totalPrice} />
                </div>
                {transfer.notes && <InfoItem label="Notes" value={transfer.notes} />}
              </Collapsible>
            )}

            {rentalCar && (
              <Collapsible eyebrow="Ground" title="Rental Car" subtitle={rentalCar.company ?? rentalCar.supplier ?? undefined}>
                <div className="grid grid-2">
                  <InfoItem label="Rental Company" value={rentalCar.company ?? rentalCar.supplier} />
                  <InfoItem label="Status" value={rentalCar.bookingStatus} />
                  <InfoItem label="Pickup" value={fmtDateTime(rentalCar.pickupDatetime)} />
                  <InfoItem label="Return" value={fmtDateTime(rentalCar.returnDatetime)} />
                  <InfoItem label="Pickup Location" value={rentalCar.pickupLocation} />
                  <InfoItem label="Return Location" value={rentalCar.returnLocation} />
                  <InfoItem label="Vehicle Class" value={rentalCar.vehicleClass} />
                  <InfoItem label="Drivers" value={rentalCar.driverCount} />
                  <InfoItem label="Confirmation" value={rentalCar.confirmationNumber} />
                  <PriceItem label="Total" value={rentalCar.totalPrice} />
                </div>
                {rentalCar.notes && <InfoItem label="Notes" value={rentalCar.notes} />}
              </Collapsible>
            )}

            {activity && (
              <Collapsible eyebrow="Experience" title="Activity" subtitle={activity.name ?? undefined}>
                <div className="grid grid-2">
                  <InfoItem label="Activity" value={activity.name} />
                  <InfoItem label="Supplier" value={activity.supplier} />
                  <InfoItem label="Status" value={activity.bookingStatus} />
                  <InfoItem label="Date & Time" value={fmtDateTime(activity.datetime)} />
                  <InfoItem label="Location" value={activity.location} />
                  <InfoItem label="Participants" value={activity.participantCount} />
                  <InfoItem label="Confirmation" value={activity.confirmationNumber} />
                  <PriceItem label="Total" value={activity.totalPrice} />
                </div>
                {activity.notes && <InfoItem label="Notes" value={activity.notes} />}
              </Collapsible>
            )}

            {insurance && (
              <Collapsible eyebrow="Protection" title="Travel Insurance">
                {insurance.quoteOptions.length > 0 ? (
                  <div className="grid grid-3">
                    {insurance.quoteOptions.map((option) => (
                      <div
                        key={option.optionNumber}
                        className="stack"
                        style={{
                          background: "#fbfdfe",
                          border: "1px solid #e6f0f2",
                          borderRadius: 8,
                          padding: 16,
                        }}
                      >
                        <h3 style={{ margin: 0 }}>Plan {option.optionNumber}</h3>
                        <InfoItem label="Provider" value={option.providerName} />
                        <InfoItem label="Plan" value={option.planName} />
                        <PriceItem label="Premium" value={option.premiumAmount} />
                        {option.brochureUrl ? (
                          <Link className="btn btn-outline" href={option.brochureUrl} target="_blank">
                            View flyer
                          </Link>
                        ) : null}
                        {option.coverageDescription ? (
                          <InfoItem label="Coverage" value={option.coverageDescription} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-2">
                    <InfoItem label="Provider" value={insurance.provider} />
                    <InfoItem label="Plan" value={insurance.planName} />
                    <PriceItem label="Total Premium" value={insurance.totalPrice} />
                  </div>
                )}
                <div className="grid grid-2">
                  <InfoItem label="Status" value={insurance.bookingStatus} />
                  <InfoItem label="Policy Number" value={insurance.policyNumber} />
                  <InfoItem label="Coverage Start" value={fmtDate(insurance.coverageStart)} />
                  <InfoItem label="Coverage End" value={fmtDate(insurance.coverageEnd)} />
                  <InfoItem label="Travelers Covered" value={insurance.travelersCount} />
                  <InfoItem label="Claims Phone" value={insurance.claimPhone} />
                </div>
                {insurance.notes && <InfoItem label="Coverage Notes" value={insurance.notes} />}
              </Collapsible>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ProposalTab({
  trip,
  proposal,
  isPrimaryClient,
  hotel,
  flight,
  cruise,
  transfer,
  rentalCar,
  activity,
  insurance,
  timelineGroups,
  onProposalDecision,
}: {
  trip: TripRow;
  proposal: ProposalRow;
  isPrimaryClient: boolean;
  hotel: HotelData;
  flight: FlightData;
  cruise: CruiseData;
  transfer: TransferData;
  rentalCar: RentalCarData;
  activity: ActivityData;
  insurance: InsuranceData;
  timelineGroups: TimelineGroup[];
  onProposalDecision: (formData: FormData) => Promise<void>;
}) {
  const proposalTitle = proposal.proposal_title || `${trip.trip_name ?? "Trip"} Proposal`;

  return (
    <div className="stack">
      <SectionCard eyebrow="Proposal" title={proposalTitle} subtitle={getProposalStatusLabel(proposal.proposal_status, proposal.client_decision)}>
        <div className="grid grid-3">
          <PriceItem label="Planning Fee" value={proposal.planning_fee} />
          <PriceItem label="Proposal Total" value={proposal.total_price} />
          <InfoItem label="Travel Dates" value={`${fmtDate(trip.departure_date, "TBD")} to ${fmtDate(trip.return_date, "TBD")}`} />
        </div>
        {proposal.proposal_welcome_text && (
          <p className="preserve-formatting" style={{ margin: 0, lineHeight: 1.7, color: "#374151" }}>{proposal.proposal_welcome_text}</p>
        )}
      </SectionCard>

      <ItineraryTab
        timelineGroups={timelineGroups}
        hotel={hotel}
        flight={flight}
        cruise={cruise}
        transfer={transfer}
        rentalCar={rentalCar}
        activity={activity}
        insurance={insurance}
      />

      <ProposalPaymentDetails trip={trip} />

      {proposal.proposal_closing_text && (
        <SectionCard eyebrow="Advisor Note" title="Proposal Notes">
          <p className="preserve-formatting" style={{ margin: 0, lineHeight: 1.7, color: "#374151" }}>{proposal.proposal_closing_text}</p>
        </SectionCard>
      )}

      <ProposalDecisionCard
        trip={trip}
        proposal={proposal}
        isPrimaryClient={isPrimaryClient}
        onProposalDecision={onProposalDecision}
      />
    </div>
  );
}

function DocumentsTab({
  tripId,
  documents,
  clientDocuments,
  canAttachClientDocuments,
  onAttachClientDocument,
}: {
  tripId: string;
  documents: DocumentRow[];
  clientDocuments: ClientDocumentRow[];
  canAttachClientDocuments: boolean;
  onAttachClientDocument: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="stack">
      <SectionCard eyebrow="Documents" title="Passport & Trip Document Checklist" subtitle="Review these before your departure date.">
        <div className="grid grid-2">
          <ul style={{ margin: 0, padding: 0, display: "grid", gap: 12 }}>
            <ChecklistItem>Confirm all traveler names match exactly as shown on passports or government IDs.</ChecklistItem>
            <ChecklistItem>Check passport expiration dates — many countries require 6+ months validity beyond your return date.</ChecklistItem>
            <ChecklistItem>Review destination entry, visa, and passport requirements.</ChecklistItem>
          </ul>
          <ul style={{ margin: 0, padding: 0, display: "grid", gap: 12 }}>
            <ChecklistItem>Keep digital and printed copies of confirmations, insurance, passports, and shared trip documents.</ChecklistItem>
            <ChecklistItem>If minors are traveling without both parents, confirm whether consent documents are needed.</ChecklistItem>
            <ChecklistItem>Contact your advisor if anything looks incorrect before departure.</ChecklistItem>
          </ul>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/trips/${tripId}/documents`} className="btn btn-primary" style={{ fontSize: 13, padding: "9px 16px" }}>View Shared Documents</Link>
          <Link href="/profile/documents/upload" className="btn btn-outline" style={{ fontSize: 13, padding: "9px 16px" }}>Upload a Document</Link>
        </div>
      </SectionCard>

      {documents.length > 0 && (
        <SectionCard eyebrow="Files" title="Documents from Your Advisor">
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Component</th>
                  <th>Uploaded</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.file_name}</td>
                    <td>{getComponentTypeLabel(doc.component_type)}</td>
                    <td style={{ fontSize: 13, color: "#667085" }}>{fmtDateTime(doc.created_at, "")}</td>
                    <td>
                      {doc.signedUrl ? (
                        <a href={doc.signedUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Open</a>
                      ) : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {clientDocuments.length > 0 && (
        <SectionCard eyebrow="Client Documentation" title="Your Uploaded Documents">
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Uploaded</th>
                  <th>Trip</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {clientDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 10px", background: "#f0f7f8", color: "var(--accent-dark)", fontWeight: 700, fontSize: 12 }}>
                        {getDocumentTypeLabel(doc.document_type)}
                      </span>
                    </td>
                    <td>{doc.title ?? doc.file_name ?? "—"}</td>
                    <td style={{ fontSize: 13, color: "#667085" }}>{fmtDateTime(doc.uploaded_at, "")}</td>
                    <td>
                      {doc.isAttachedToTrip ? (
                        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 10px", background: "#ecfdf3", color: "#027a48", fontWeight: 800, fontSize: 12 }}>
                          Attached
                        </span>
                      ) : canAttachClientDocuments ? (
                        <form action={onAttachClientDocument}>
                          <input type="hidden" name="trip_id" value={tripId} />
                          <input type="hidden" name="client_document_id" value={doc.id} />
                          <button type="submit" className="btn btn-outline" style={{ fontSize: 12, padding: "6px 10px" }}>
                            Add to Trip
                          </button>
                        </form>
                      ) : (
                        <span style={{ color: "#667085", fontSize: 13 }}>Not attached</span>
                      )}
                    </td>
                    <td>
                      {doc.signedUrl ? (
                        <a href={doc.signedUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Open</a>
                      ) : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {documents.length === 0 && clientDocuments.length === 0 && (
        <div className="card" style={{ border: "1px solid #e6f0f2", color: "#667085" }}>
          <p style={{ margin: 0 }}>No documents have been shared yet. Your advisor will upload documents here as your trip is finalized.</p>
        </div>
      )}
    </div>
  );
}

function TravelCircleTab({ tripId, tripMembers, canManageTravelCircle, onInviteCompanion, onRemoveCompanion }: { tripId: string; tripMembers: TripMemberRow[]; isPrimaryClient: boolean; canManageTravelCircle: boolean; onInviteCompanion: (f: FormData) => Promise<void>; onRemoveCompanion: (f: FormData) => Promise<void> }) {
  const owners = tripMembers.filter((m) => m.role === "owner");
  const companions = tripMembers.filter((m) => m.role !== "owner");

  return (
    <div className="stack">
      <SectionCard eyebrow="Travel Companions" title="Your Travel Circle" subtitle="People who have shared access to this trip. Personal profile details and private documents remain protected.">
        {tripMembers.length === 0 ? (
          <p style={{ margin: 0, color: "#667085" }}>No Travel Companions added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {[...owners, ...companions].map((member) => (
              <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px", borderRadius: 14, border: "1px solid #eef2f5", background: member.role === "owner" ? "#f0fdf4" : "#fbfdfe" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{member.display_name}</p>
                  <p style={{ margin: "3px 0 0", color: "#667085", fontSize: 13 }}>
                    {member.email ?? "Email not provided"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <TravelCompanionBadge role={member.role} />
                  {canManageTravelCircle && member.role !== "owner" && (
                    <form action={onRemoveCompanion}>
                      <input type="hidden" name="trip_id" value={tripId} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <button type="submit" className="btn" style={{ padding: "6px 10px", fontSize: 12, background: "#fff", color: "#b42318", border: "1px solid #fecaca" }}>Remove</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageTravelCircle && (
          <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Invite a Travel Companion</p>
              <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>For privacy, Travel Companions must already have a Cozy Concierge client account.</p>
            </div>
            <InviteCompanionForm threadId="" tripId={tripId} action={onInviteCompanion}>
              <div className="grid grid-2">
                <label className="stack-sm">
                  <span className="label">Access Level</span>
                  <select className="select" name="role" defaultValue="viewer">
                    <option value="viewer">Viewer — read only</option>
                    <option value="contributor">Contributor — can participate</option>
                  </select>
                </label>
              </div>
            </InviteCompanionForm>
          </div>
        )}

        {!canManageTravelCircle && (
          <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>Only the lead traveler or your advisor can manage Travel Companions for this trip.</p>
        )}
      </SectionCard>

      <SectionCard eyebrow="Concierge Messages" title="Send a Message" subtitle="Message your advisor directly about this trip.">
        <div className="card stack" style={{ border: "1px solid #e6f0f2" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Advisor Message</p>
          <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.6 }}>For payments, personal details, documents, travel questions, or anything Cozy Adventure Vacations should review.</p>
          <Link href={`/messages?tripId=${tripId}`} className="btn btn-primary" style={{ fontSize: 13, padding: "9px 16px", alignSelf: "flex-start" }}>Message Advisor</Link>
        </div>
      </SectionCard>
    </div>
  );
}

function HelpTab({ tripId, tripName, advisorEmail, agencyWebsite }: { tripId: string; tripName: string; advisorEmail: string; agencyWebsite: string }) {
  const emailSubject = encodeURIComponent(`Question about ${tripName}`);
  const emailBody = encodeURIComponent(`Hi Jeremy,\n\nI have a question about my trip: ${tripName}\n\n`);

  return (
    <div className="stack">
      <SectionCard eyebrow="Your Advisor" title="Contact Information">
        <div className="grid grid-2">
          <InfoItem label="Advisor" value="Jeremy Brown" />
          <InfoItem label="Agency" value="Cozy Adventure Vacations" />
          <div style={{ padding: "12px", border: "1px solid #eef2f5", borderRadius: 12, background: "#fbfdfe" }}>
            <span className="label">Email</span>
            <p style={{ margin: "6px 0 0" }}>
              <a href={`mailto:${advisorEmail}?subject=${emailSubject}&body=${emailBody}`} style={{ color: "var(--accent-dark)", fontWeight: 700, overflowWrap: "anywhere" }}>{advisorEmail}</a>
            </p>
          </div>
          <div style={{ padding: "12px", border: "1px solid #eef2f5", borderRadius: 12, background: "#fbfdfe" }}>
            <span className="label">Website</span>
            <p style={{ margin: "6px 0 0" }}>
              <a href={agencyWebsite} target="_blank" rel="noreferrer" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>CozyAdventureVacations.com</a>
            </p>
          </div>
        </div>
        <div style={{ padding: "12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
          <span className="label">In-Trip Support</span>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6, fontSize: 14 }}>For urgent supplier issues, contact the supplier first when possible, then notify your advisor so Cozy Adventure Vacations can help support next steps.</p>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Ask Cozy" title="General Travel Questions">
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6, fontSize: 14 }}>Ask Cozy can help with packing tips, destination info, pre-travel prep, and general travel questions. For anything specific to your booking, use Concierge Messages.</p>
        <div>
          <Link href={`/ask-cozy?tripId=${tripId}`} className="btn btn-primary" style={{ fontSize: 13, padding: "9px 16px" }}>Ask Cozy About This Trip</Link>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Before You Go" title="Questions Before You Travel?" subtitle="A quick message now can prevent a headache later.">
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6, fontSize: 14 }}>If names, dates, documents, payment details, or travel components do not look right, please contact your advisor before your departure date.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/messages" className="btn btn-primary" style={{ fontSize: 13, padding: "9px 16px" }}>Open Message Center</Link>
          <Link href="/trips" className="btn btn-outline" style={{ fontSize: 13, padding: "9px 16px" }}>Back to My Trips</Link>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function TripDetailClient({
  trip,
  proposal,
  clientNote,
  clientReminder,
  tripMembers,
  isPrimaryClient,
  canManageTravelCircle,
  documents,
  clientDocuments,
  canAttachClientDocuments,
  timelineGroups,
  hotel,
  flight,
  cruise,
  transfer,
  rentalCar,
  activity,
  insurance,
  advisorEmail,
  agencyWebsite,
  onInviteCompanion,
  onRemoveCompanion,
  onAttachClientDocument,
  onProposalDecision,
}: TripDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tabs = proposal ? BASE_TABS : BASE_TABS.filter((tab) => tab.id !== "proposal");

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Overview";

  return (
    <div className="stack">
      <TripCoverHero trip={trip} />

      {/* Trip summary */}
      <div className="card" style={{ background: "#ffffff", border: "1px solid #e6f0f2", padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <StatusBadge status={trip.trip_status} />
          <span style={{ color: "#667085", fontSize: 14 }}>{fmtDate(trip.departure_date, "TBD")} → {fmtDate(trip.return_date, "TBD")}</span>
        </div>
      </div>
      <TripStatusTimeline trip={trip} />

      {/* Quick action bar */}
      <div className="card" style={{ border: "1px solid #e6f0f2", padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={`/trips/${trip.id}/documents`} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Documents</Link>
          <Link href="/messages" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Messages</Link>
          <Link href={`/trips/${trip.id}/request-payment`} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Request Payment Link</Link>
          <Link href={`/trips/${trip.id}/summary`} className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Print Summary</Link>
          <Link href={`/ask-cozy?tripId=${trip.id}`} className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Ask Cozy</Link>
          <Link href="/trips" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>← My Trips</Link>
        </div>
      </div>

      {/* Tab bar — desktop */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e6f0f2", overflowX: "auto" }} className="desktop-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "10px 18px",
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: 14,
              color: activeTab === tab.id ? "var(--accent-dark)" : "#5e7e8f",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-dark)" : "2px solid transparent",
              marginBottom: -2,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab bar — mobile dropdown */}
      <div className="mobile-tabs" style={{ display: "none" }}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ width: "100%", padding: "12px 16px", background: "#f7fbfc", border: "1px solid #e6f0f2", borderRadius: 12, fontWeight: 700, color: "var(--accent-dark)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }}
        >
          <span>{activeLabel}</span>
          <span>{mobileMenuOpen ? "▲" : "▼"}</span>
        </button>
        {mobileMenuOpen && (
          <div style={{ border: "1px solid #e6f0f2", borderRadius: 12, background: "#fff", overflow: "hidden", marginTop: 4 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                style={{ width: "100%", padding: "12px 16px", background: activeTab === tab.id ? "#f0f7f8" : "#fff", border: "none", borderBottom: "1px solid #f0f5f8", fontWeight: activeTab === tab.id ? 800 : 600, color: activeTab === tab.id ? "var(--accent-dark)" : "#374151", cursor: "pointer", textAlign: "left", fontSize: 14 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .desktop-tabs { display: none !important; }
          .mobile-tabs { display: block !important; }
        }
      `}</style>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab trip={trip} proposal={proposal} clientNote={clientNote} clientReminder={clientReminder} documents={documents} clientDocuments={clientDocuments} tripMembers={tripMembers} />
      )}
      {activeTab === "proposal" && proposal && (
        <ProposalTab
          trip={trip}
          proposal={proposal}
          isPrimaryClient={isPrimaryClient}
          hotel={hotel}
          flight={flight}
          cruise={cruise}
          transfer={transfer}
          rentalCar={rentalCar}
          activity={activity}
          insurance={insurance}
          timelineGroups={timelineGroups}
          onProposalDecision={onProposalDecision}
        />
      )}
      {activeTab === "itinerary" && (
        <ItineraryTab timelineGroups={timelineGroups} hotel={hotel} flight={flight} cruise={cruise} transfer={transfer} rentalCar={rentalCar} activity={activity} insurance={insurance} />
      )}
      {activeTab === "documents" && (
        <DocumentsTab
          tripId={trip.id}
          documents={documents}
          clientDocuments={clientDocuments}
          canAttachClientDocuments={canAttachClientDocuments}
          onAttachClientDocument={onAttachClientDocument}
        />
      )}
      {activeTab === "travel-circle" && (
        <TravelCircleTab tripId={trip.id} tripMembers={tripMembers} isPrimaryClient={isPrimaryClient} canManageTravelCircle={canManageTravelCircle} onInviteCompanion={onInviteCompanion} onRemoveCompanion={onRemoveCompanion} />
      )}
      {activeTab === "help" && (
        <HelpTab tripId={trip.id} tripName={trip.trip_name ?? "Your Trip"} advisorEmail={advisorEmail} agencyWebsite={agencyWebsite} />
      )}
    </div>
  );
}




