import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientAccountRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  welcome_dismissed_at: string | null;
};

type TripRow = {
  trip_id: string;
  client_account_id: string;
  trip_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  destinations: string | null;
  trip_status: string | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
};

type MessageThreadRow = {
  id: string;
  status: string | null;
  client_unread_count: number | null;
  last_message_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateLong(value: string | null | undefined) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getPreferredName(client: ClientAccountRow) {
  return (
    client.preferred_name?.trim() ||
    client.first_name?.trim() ||
    client.email ||
    "Traveler"
  );
}

function getDaysUntilDeparture(departureDate: string | null | undefined): number | null {
  if (!departureDate) return null;
  const [year, month, day] = departureDate.split("-").map(Number);
  const departure = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((departure.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getDaysSinceReturn(returnDate: string | null | undefined): number | null {
  if (!returnDate) return null;
  const [year, month, day] = returnDate.split("-").map(Number);
  const returned = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - returned.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Countdown Banner ─────────────────────────────────────────────────────────

function TripCountdownBanner({ trip }: { trip: TripRow }) {
  const days = getDaysUntilDeparture(trip.departure_date);

  if (days === null || days < 0 || days > 365) return null;

  const isToday = days === 0;
  const isTomorrow = days === 1;
  const isVeryClose = days <= 7;
  const isClose = days <= 30;

  let emoji = "✈️";
  let headline = "";
  let subline = "";
  let bgFrom = "#f0f7f8";
  let bgTo = "#ffffff";
  let borderColor = "#e6f0f2";
  let accentColor = "var(--accent-dark)";
  let numberColor = "var(--accent-dark)";

  if (isToday) {
    emoji = "🎉";
    headline = "Today is the day!";
    subline = `Your ${trip.trip_name ?? "adventure"} begins today. Safe travels!`;
    bgFrom = "#f0fdf4";
    bgTo = "#ffffff";
    borderColor = "#bbf7d0";
    accentColor = "#027a48";
    numberColor = "#027a48";
  } else if (isTomorrow) {
    emoji = "🧳";
    headline = "Departure is tomorrow!";
    subline = `Time to pack — ${trip.trip_name ?? "your trip"} starts tomorrow.`;
    bgFrom = "#f0fdf4";
    bgTo = "#ffffff";
    borderColor = "#bbf7d0";
    accentColor = "#027a48";
    numberColor = "#027a48";
  } else if (isVeryClose) {
    emoji = "🌟";
    headline = `${days} days to go!`;
    subline = `${trip.trip_name ?? "Your adventure"} is almost here${trip.destinations ? ` — ${trip.destinations}` : ""}.`;
    bgFrom = "#fffbeb";
    bgTo = "#ffffff";
    borderColor = "#fde68a";
    accentColor = "#92400e";
    numberColor = "#92400e";
  } else if (isClose) {
    emoji = "📅";
    headline = `${days} days until departure`;
    subline = `${trip.trip_name ?? "Your trip"}${trip.destinations ? ` to ${trip.destinations}` : ""} is coming up soon.`;
    bgFrom = "#eff6ff";
    bgTo = "#ffffff";
    borderColor = "#bfdbfe";
    accentColor = "#1d4ed8";
    numberColor = "#1d4ed8";
  } else {
    emoji = "✈️";
    headline = `${days} days until departure`;
    subline = `${trip.trip_name ?? "Your trip"}${trip.destinations ? ` to ${trip.destinations}` : ""}${trip.departure_date ? ` · ${formatDateShort(trip.departure_date)}` : ""}.`;
    bgFrom = "#f7fbfc";
    bgTo = "#ffffff";
    borderColor = "#e6f0f2";
    accentColor = "var(--accent-dark)";
    numberColor = "var(--accent-dark)";
  }

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 70%)`,
        padding: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* Big number */}
        {!isToday && !isTomorrow && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: "3.5rem", fontWeight: 900, lineHeight: 1, color: numberColor }}>
              {days}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: numberColor, opacity: 0.7 }}>
              {days === 1 ? "day" : "days"}
            </div>
          </div>
        )}

        {isToday || isTomorrow ? (
          <span style={{ fontSize: 40 }} aria-hidden>{emoji}</span>
        ) : null}

        {/* Text */}
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: accentColor, fontWeight: 800 }}>
            {isToday || isTomorrow ? "Trip Alert" : "Trip Countdown"}
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: "1.3rem", color: accentColor }}>
            {headline}
          </h2>
          <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 14, lineHeight: 1.5 }}>
            {subline}
          </p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/trips/${trip.trip_id}`}
        className="btn btn-primary"
        style={{ fontSize: 13, padding: "9px 18px", background: accentColor, flexShrink: 0 }}
      >
        {isToday ? "View Trip Details" : "Open Trip →"}
      </Link>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  helper,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  helper?: string;
  href?: string;
  tone?: "neutral" | "warning";
}) {
  const isWarning = tone === "warning";
  const content = (
    <>
      <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5e7e8f", fontWeight: 700 }}>
        {label}
      </span>
      <strong style={{ fontSize: "1.7rem", lineHeight: 1, color: isWarning ? "#6b3a08" : "var(--accent-dark)" }}>
        {value}
      </strong>
      {helper && (
        <span style={{ fontSize: 12, color: "#5e7e8f", lineHeight: 1.4 }}>{helper}</span>
      )}
    </>
  );
  const cardStyle = {
    gap: 8,
    border: isWarning ? "1px solid #fed7aa" : "1px solid #e6f0f2",
    background: isWarning ? "#fffbf7" : "#ffffff",
  };

  if (href) {
    return (
      <Link
        href={href}
        className="card stack"
        style={{ ...cardStyle, color: "inherit", textDecoration: "none", cursor: "pointer" }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className="card stack"
      style={cardStyle}
    >
      {content}
    </div>
  );
}

function AdvisorCard({ unreadCount }: { unreadCount: number }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        gap: 18,
        alignItems: "center",
        flexWrap: "wrap",
        background: "linear-gradient(135deg, #f0f7f8 0%, #ffffff 60%)",
        border: "1px solid #e6f0f2",
      }}
    >
      <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #e6f0f2" }}>
        <Image
          src="/jeremy.jpg"
          alt="Jeremy Brown, Cozy Adventure Vacations"
          width={64}
          height={64}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          priority
        />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Your Advisor</p>
        <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800 }}>Jeremy Brown</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5e7e8f" }}>Cozy Adventure Vacations &middot; <em>Memories Await!</em></p>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <Link href="/messages" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
          {unreadCount > 0 ? `✉ ${unreadCount} Unread` : "✉ Messages"}
        </Link>
        <Link href="/travel-request" className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
          Request a Quote
        </Link>
      </div>
    </div>
  );
}

function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T23:59:59`);
  const today = new Date();
  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

function getPaymentStatus(trip: TripRow) {
  const balanceDue = Number(trip.balance_due ?? 0);
  const depositPaid = trip.deposit_paid === true;

  if (balanceDue <= 0) return { label: "Paid in Full", tone: "success" as const };

  if (!depositPaid && trip.deposit_due_date) {
    return {
      label: isPastDue(trip.deposit_due_date) ? "Deposit Past Due" : "Deposit Pending",
      tone: isPastDue(trip.deposit_due_date) ? "danger" as const : "warning" as const,
    };
  }

  if (trip.final_payment_due_date) {
    return {
      label: isPastDue(trip.final_payment_due_date) ? "Final Payment Past Due" : "Final Payment Due",
      tone: isPastDue(trip.final_payment_due_date) ? "danger" as const : "warning" as const,
    };
  }

  return { label: "Balance Due", tone: "warning" as const };
}

function PaymentStatusBadge({ trip }: { trip: TripRow }) {
  const status = getPaymentStatus(trip);
  const styles = {
    success: { background: "#ecfdf3", color: "#027a48" },
    warning: { background: "#fff7ed", color: "#9a3412" },
    danger: { background: "#fef2f2", color: "#991b1b" },
  }[status.tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", background: styles.background, color: styles.color, fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}>
      {status.label}
    </span>
  );
}

function TripStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "draft";
  const colors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: "#eaf3de", color: "#3b6d11" },
    active: { bg: "#eaf3de", color: "#3b6d11" },
    completed: { bg: "#f0f7f8", color: "var(--accent-dark)" },
    cancelled: { bg: "#fef2f2", color: "#991b1b" },
    draft: { bg: "#f0f7f8", color: "var(--accent-dark)" },
  };
  const style = colors[s] ?? colors.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", background: style.bg, color: style.color, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
      {s}
    </span>
  );
}

function WelcomeHomeCard({ trip }: { trip: TripRow }) {
  const returnedLabel = formatDateLong(trip.return_date);

  return (
    <div
      className="card"
      style={{
        border: "1px solid #bbf7d0",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 72%)",
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#027a48", fontWeight: 900 }}>
            Welcome Home
          </p>
          <h2 style={{ margin: "6px 0 0" }}>
            We hope {trip.trip_name ?? "your trip"} was wonderful.
          </h2>
          <p style={{ margin: "8px 0 0", color: "#166534", lineHeight: 1.6 }}>
            You returned {returnedLabel}. If you need help with post-trip questions, receipts, or starting the next adventure, your advisor is here.
          </p>
        </div>
        <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", border: "2px solid #bbf7d0", flexShrink: 0 }}>
          <Image src="/jeremy.jpg" alt="Jeremy Brown" width={58} height={58} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/messages" className="btn btn-primary" style={{ background: "#027a48", padding: "9px 16px", fontSize: 13 }}>
          Message Jeremy
        </Link>
        <Link href="/travel-request" className="btn btn-outline" style={{ padding: "9px 16px", fontSize: 13, background: "#ffffff" }}>
          Plan Another Trip
        </Link>
        <Link href={`/trips/${trip.trip_id}`} className="btn btn-outline" style={{ padding: "9px 16px", fontSize: 13, background: "#ffffff" }}>
          View Trip Details
        </Link>
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: TripRow }) {
  const departure = formatDateShort(trip.departure_date);
  const returnDate = formatDateShort(trip.return_date);
  const hasBalance = typeof trip.balance_due === "number" && trip.balance_due > 0;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "14px 0", borderBottom: "1px solid #f0f5f8" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{trip.trip_name ?? "Trip"}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#5e7e8f" }}>
          {trip.destinations ?? "Destination TBD"}
          {departure ? ` · ${departure}` : ""}
          {returnDate ? ` → ${returnDate}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <TripStatusBadge status={trip.trip_status} />
        <PaymentStatusBadge trip={trip} />
        {hasBalance && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#6b3a08", whiteSpace: "nowrap" }}>
            {formatMoney(trip.balance_due)} due
          </span>
        )}
        <Link href={`/trips/${trip.trip_id}`} className="btn btn-primary" style={{ padding: "7px 14px", fontSize: 13 }}>
          View Trip
        </Link>
      </div>
    </div>
  );
}

function TripReadinessCard({
  trip,
  passportUploaded,
  sharedDocumentCount,
}: {
  trip: TripRow | null;
  passportUploaded: boolean;
  sharedDocumentCount: number;
}) {
  if (!trip) return null;

  const items = [
    { label: "Trip dates confirmed", complete: Boolean(trip.departure_date && trip.return_date), href: `/trips/${trip.trip_id}` },
    { label: "Passport uploaded", complete: passportUploaded, href: "/profile/passport-upload" },
    { label: "Payment complete", complete: Number(trip.balance_due ?? 0) <= 0, href: Number(trip.balance_due ?? 0) > 0 ? `/trips/${trip.trip_id}/request-payment` : `/trips/${trip.trip_id}` },
    { label: "Travel documents shared", complete: sharedDocumentCount > 0, href: `/trips/${trip.trip_id}/documents` },
  ];
  const completeCount = items.filter((item) => item.complete).length;
  const percent = Math.round((completeCount / items.length) * 100);
  const tone = percent >= 100 ? "#027a48" : percent >= 50 ? "var(--accent-dark)" : "#9a3412";

  return (
    <div className="card stack" style={{ border: percent >= 100 ? "1px solid #bbf7d0" : "1px solid #e6f0f2", background: percent >= 100 ? "#f0fdf4" : "#ffffff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: tone, fontWeight: 800 }}>
            Trip Readiness
          </p>
          <h2 style={{ margin: "4px 0 0" }}>{percent}% ready for {trip.trip_name ?? "your trip"}</h2>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 14 }}>
            A quick check of the essentials before departure.
          </p>
        </div>
        <div style={{ minWidth: 140 }}>
          <div style={{ height: 10, borderRadius: 999, background: "#e6f0f2", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: tone }} />
          </div>
          <p style={{ margin: "6px 0 0", textAlign: "right", fontSize: 12, color: tone, fontWeight: 800 }}>{completeCount} of {items.length} complete</p>
        </div>
      </div>
      <div className="grid grid-4" style={{ gap: 10 }}>
        {items.map((item) => (
          <Link key={item.label} href={item.href} style={{ padding: 12, borderRadius: 12, border: "1px solid #e6f0f2", background: item.complete ? "#f0fdf4" : "#fff7ed", color: "inherit", textDecoration: "none", display: "block" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: item.complete ? "#027a48" : "#9a3412" }}>
              {item.complete ? "✓" : "○"} {item.label}
            </p>
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/trips/${trip.trip_id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }}>Review Trip</Link>
        {!passportUploaded && <Link href="/profile/passport-upload" className="btn btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>Upload Passport</Link>}
      </div>
    </div>
  );
}
function AskCozyCompact({ nextTrip }: { nextTrip: TripRow | null }) {
  const selectedTripQuery = nextTrip ? `&tripId=${encodeURIComponent(nextTrip.trip_id)}` : "";
  const suggestedActions = [
    {
      label: "Packing List",
      href: `/ask-cozy?question=${encodeURIComponent("Create a custom packing list for this trip.")}${selectedTripQuery}`,
    },
    {
      label: "Destination Deep Dive",
      href: `/ask-cozy?question=${encodeURIComponent("Research this destination and suggest the best activities, excursions, and day-by-day priorities to discuss with my advisor.")}${selectedTripQuery}`,
    },
    {
      label: "Supplier Ideas",
      href: `/ask-cozy?question=${encodeURIComponent("Deep dive common travel suppliers for this destination and trip style, including cruise lines, tour operators, resorts, transfer companies, and excursion providers I should ask my advisor about.")}${selectedTripQuery}`,
    },
  ];

  return (
    <div className="card stack" style={{ gap: 14, border: "1px solid #bfdbfe", background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 70%)" }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Ask Cozy</p>
        <h2 style={{ margin: "4px 0 0" }}>Plan smarter with your AI travel helper</h2>
        <p style={{ margin: "6px 0 0", color: "#5e7e8f", lineHeight: 1.55, fontSize: 13 }}>
          Generate trip-specific packing lists, explore destination activities and excursions, or compare common suppliers to discuss with Jeremy.
        </p>
      </div>
      <form action="/ask-cozy" method="get" style={{ display: "flex", gap: 8 }}>
        {nextTrip ? <input type="hidden" name="tripId" value={nextTrip.trip_id} /> : null}
        <input className="input" name="question" placeholder={nextTrip ? `Ask about ${nextTrip.trip_name ?? "your next trip"}` : "Ask about packing, activities, excursions, or suppliers"} style={{ flex: 1, padding: "9px 13px", fontSize: 13 }} />
        <button type="submit" className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13, whiteSpace: "nowrap" }}>Ask</button>
      </form>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestedActions.map((action) => (
          <Link key={action.label} href={action.href} className="btn btn-outline" style={{ padding: "8px 12px", fontSize: 12, background: "#ffffff" }}>
            {action.label}
          </Link>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "#5e7e8f", lineHeight: 1.5 }}>
        For booking-specific questions, use Concierge Messages so your advisor can see the full context.
      </p>
    </div>
  );
}

function QuickActions({ nextTripId }: { nextTripId: string | null }) {
  const actions = [
    { label: "My Trips", href: "/trips" },
    { label: "Messages", href: "/messages" },
    { label: "My Profile", href: "/profile" },
    ...(nextTripId ? [{ label: "Open Next Trip", href: `/trips/${nextTripId}` }] : []),
  ];

  return (
    <div className="card stack" style={{ gap: 10, border: "1px solid #e6f0f2" }}>
      <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>Quick Actions</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0f7f8", color: "var(--accent-dark)", border: "1px solid #e6f0f2", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Welcome Banner ───────────────────────────────────────────────────────────

const TOUR_ITEMS = [
  {
    icon: "✈️",
    title: "Your Trips",
    description: "View your upcoming trips, travel details, itinerary, payment timeline, and shared documents all in one place.",
    href: "/trips",
    cta: "View Trips",
  },
  {
    icon: "✉️",
    title: "Concierge Messages",
    description: "Send private messages directly to your advisor for booking questions, payments, documents, and trip support.",
    href: "/messages",
    cta: "Open Messages",
  },
  {
    icon: "👤",
    title: "Your Profile",
    description: "Keep your travel preferences, passport details, emergency contacts, and loyalty numbers up to date for seamless planning.",
    href: "/profile",
    cta: "Complete Profile",
  },
  {
    icon: "🤖",
    title: "Ask Cozy",
    description: "Get instant answers to general travel questions — packing tips, destination info, pre-travel prep, and more.",
    href: "/ask-cozy",
    cta: "Ask a Question",
  },
];

function WelcomeBanner({
  preferredName,
  onDismiss,
}: {
  preferredName: string;
  onDismiss: (formData: FormData) => Promise<void>;
}) {
  return (
    <div
      className="card stack"
      style={{
        border: "1px solid #bfdbfe",
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 70%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1d4ed8", fontWeight: 800 }}>
            Welcome to Cozy Concierge
          </p>
          <h2 style={{ margin: "6px 0 0", fontSize: "1.5rem" }}>
            Hi {preferredName}, we&apos;re so glad you&apos;re here! 🎉
          </h2>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.65, maxWidth: 620 }}>
            Your personal travel concierge portal is ready. Here&apos;s a quick look at everything available to you.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: "2px solid #bfdbfe", flexShrink: 0 }}>
            <Image src="/jeremy.jpg" alt="Jeremy Brown" width={56} height={56} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>Jeremy Brown</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5e7e8f" }}>Your Advisor</p>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        {TOUR_ITEMS.map((item) => (
          <div key={item.href} style={{ padding: 16, borderRadius: 14, border: "1px solid #dbeafe", background: "#ffffff", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }} aria-hidden>{item.icon}</span>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "var(--accent-dark)" }}>{item.title}</p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#667085", lineHeight: 1.55, flex: 1 }}>{item.description}</p>
            <Link href={item.href} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", padding: "7px 14px", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 13, textDecoration: "none", border: "1px solid #bfdbfe" }}>
              {item.cta} →
            </Link>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 4, borderTop: "1px solid #dbeafe" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#667085" }}>
          Your advisor Jeremy is here whenever you need anything.{" "}
          <Link href="/messages" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Send a message</Link> any time.
        </p>
        <form action={onDismiss}>
          <button type="submit" className="btn btn-primary" style={{ background: "#1d4ed8", fontSize: 13, padding: "9px 18px" }}>
            Got it — let&apos;s go! ✓
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Server action ────────────────────────────────────────────────────────────

async function dismissWelcome() {
  "use server";

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return;

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) return;

  const { data: byEmail } = await supabase
    .from("client_accounts")
    .select("id")
    .ilike("email", userEmail)
    .maybeSingle();

  let clientAccountId = byEmail?.id ?? null;

  if (!clientAccountId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profile) {
      const { data: byProfile } = await supabase
        .from("client_accounts")
        .select("id")
        .eq("user_profile_id", profile.id)
        .maybeSingle();
      clientAccountId = byProfile?.id ?? null;
    }
  }

  if (!clientAccountId) return;

  await supabase
    .from("client_accounts")
    .update({ welcome_dismissed_at: new Date().toISOString() })
    .eq("id", clientAccountId);

  revalidatePath("/dashboard");
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getCurrentClientAccount() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) throw new Error("Your login account does not have an email address.");

  const { data: byEmail, error: emailError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email, welcome_dismissed_at")
    .ilike("email", userEmail)
    .maybeSingle();

  if (emailError) throw new Error(emailError.message);
  if (byEmail) return { supabase, user, clientAccount: byEmail as ClientAccountRow };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User profile not found.");

  const { data: byProfile, error: profileAccountError } = await supabase
    .from("client_accounts")
    .select("id, first_name, last_name, preferred_name, email, welcome_dismissed_at")
    .eq("user_profile_id", profile.id)
    .maybeSingle();

  if (profileAccountError) throw new Error(profileAccountError.message);
  if (!byProfile) throw new Error("Client account not found.");

  return { supabase, user, clientAccount: byProfile as ClientAccountRow };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDashboardPage() {
  let clientContext: Awaited<ReturnType<typeof getCurrentClientAccount>>;

  try {
    clientContext = await getCurrentClientAccount();
  } catch (error) {
    return (
      <PageShell title="Dashboard" subtitle="We could not load your dashboard.">
        <div className="card">
          <p><strong>Error:</strong> {error instanceof Error ? error.message : "Client account not found."}</p>
        </div>
      </PageShell>
    );
  }

  const { supabase, clientAccount } = clientContext;

  const [tripsResult, threadsResult] = await Promise.all([
    supabase
      .from("client_trip_summaries")
      .select("trip_id, client_account_id, trip_name, departure_date, return_date, destinations, trip_status, balance_due, final_payment_due_date, deposit_amount, deposit_due_date, deposit_paid")
      .eq("client_account_id", clientAccount.id)
      .order("departure_date", { ascending: true }),

    supabase
      .from("message_threads")
      .select("id, status, client_unread_count, last_message_at")
      .eq("client_account_id", clientAccount.id)
      .eq("thread_type", "private")
      .order("last_message_at", { ascending: false }),

  ]);

  const rows = (tripsResult.data ?? []) as TripRow[];
  const messageThreads = (threadsResult.data ?? []) as MessageThreadRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingTrips = rows.filter((t) => {
    if (!t.departure_date) return false;
    return new Date(`${t.departure_date}T00:00:00`) >= today;
  });

  const nextTrip = upcomingTrips[0] ?? null;
  const recentCompletedTrip = rows
    .map((trip) => ({ trip, daysSinceReturn: getDaysSinceReturn(trip.return_date) }))
    .filter(({ trip, daysSinceReturn }) => {
      if (daysSinceReturn === null || daysSinceReturn < 0 || daysSinceReturn > 45) return false;
      const status = (trip.trip_status ?? "").toLowerCase();
      return status.includes("complete") || status.includes("travel") || daysSinceReturn >= 0;
    })
    .sort((a, b) => (a.daysSinceReturn ?? 999) - (b.daysSinceReturn ?? 999))[0]?.trip ?? null;

  const [passportUploadResult, sharedDocumentsResult] = await Promise.all([
    supabase
      .from("client_documents")
      .select("id", { count: "exact", head: true })
      .eq("client_account_id", clientAccount.id)
      .ilike("document_type", "passport"),
    nextTrip
      ? supabase
          .from("trip_documents")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", nextTrip.trip_id)
          .in("visibility", ["client", "client_travel_circle"])
      : Promise.resolve({ count: 0 }),
  ]);

  const passportUploaded = Number(passportUploadResult.count ?? 0) > 0;
  const sharedDocumentCount = Number(sharedDocumentsResult.count ?? 0);

  const totalBalance = rows.reduce(
    (sum, t) => sum + (typeof t.balance_due === "number" ? t.balance_due : 0),
    0,
  );

  const nextPaymentTrip =
    rows
      .filter((t) => t.final_payment_due_date && (t.balance_due ?? 0) > 0)
      .sort((a, b) => String(a.final_payment_due_date).localeCompare(String(b.final_payment_due_date)))[0] ?? null;

  const unreadMessages = messageThreads.reduce(
    (sum, t) => sum + Number(t.client_unread_count ?? 0),
    0,
  );

  const openThreads = messageThreads.filter((t) => t.status === "open").length;
  const preferredName = getPreferredName(clientAccount);
  const showWelcome = !clientAccount.welcome_dismissed_at;

  return (
    <PageShell
      title={`Welcome back, ${preferredName}`}
      subtitle={getTodayLabel()}
    >
      {/* ── Welcome banner — first login only ── */}
      {showWelcome && (
        <WelcomeBanner preferredName={preferredName} onDismiss={dismissWelcome} />
      )}

      {/* ── Trip countdown — only when there's an upcoming trip ── */}
      {nextTrip && <TripCountdownBanner trip={nextTrip} />}

      {recentCompletedTrip && <WelcomeHomeCard trip={recentCompletedTrip} />}

      <div className="grid grid-3">
        <MetricCard
          label="Upcoming Trips"
          value={upcomingTrips.length}
          helper={nextTrip ? `Next: ${nextTrip.trip_name ?? "Trip"} · ${formatDateShort(nextTrip.departure_date) ?? ""}` : "No upcoming trips yet."}
          href={nextTrip ? `/trips/${nextTrip.trip_id}` : "/trips"}
        />
        <MetricCard
          label="Balance Due"
          value={formatMoney(totalBalance)}
          helper={nextPaymentTrip ? `Final payment due ${formatDateLong(nextPaymentTrip.final_payment_due_date)}` : "No outstanding balance."}
          href={nextPaymentTrip ? `/trips/${nextPaymentTrip.trip_id}/request-payment` : "/trips"}
          tone={totalBalance > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Messages"
          value={openThreads}
          helper={unreadMessages > 0 ? `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}` : "No unread messages."}
          href="/messages"
          tone={unreadMessages > 0 ? "warning" : "neutral"}
        />
      </div>

      <AdvisorCard unreadCount={unreadMessages} />

      <TripReadinessCard
        trip={nextTrip}
        passportUploaded={passportUploaded}
        sharedDocumentCount={sharedDocumentCount}
      />

      <div className="card stack" style={{ border: "1px solid #e6f0f2" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>My Trips</p>
            <h2 style={{ margin: "3px 0 0" }}>Upcoming Adventures</h2>
          </div>
          <Link href="/trips" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>View All Trips</Link>
        </div>

        {upcomingTrips.length === 0 ? (
          <p style={{ margin: 0, color: "#5e7e8f", lineHeight: 1.6 }}>
            No upcoming trips yet.{" "}
            <Link href="/travel-request" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Request a quote</Link>{" "}
            to start planning your next adventure.
          </p>
        ) : (
          <div style={{ paddingTop: 4 }}>
            {upcomingTrips.slice(0, 5).map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <AskCozyCompact nextTrip={nextTrip} />
        <QuickActions nextTripId={nextTrip?.trip_id ?? null} />
      </div>
    </PageShell>
  );
}



