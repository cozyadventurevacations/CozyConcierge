import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const allowedQuoteStatuses = [
  "new",
  "reviewed",
  "in_progress",
  "awaiting_client_response",
  "converted_to_trip",
  "closed",
];

const travelComponentLabels: Record<string, string> = {
  tour: "Tour Details",
  cruise: "Cruise Details",
  air: "Air Details",
  hotel: "Hotel Details",
  transfer: "Transfer Details",
  theme_park: "Theme Park Details",
  rental_car: "Rental Car Details",
  rail: "Rail Details",
  vacation_package: "Vacation Package Details",
  insurance: "Insurance Details",
  activity: "Activity / Excursion Details",
};

type QuoteRequestRow = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  preferred_contact_method: string | null;
  client_address_line_1: string | null;
  client_address_line_2: string | null;
  client_city: string | null;
  client_state: string | null;
  client_postal_code: string | null;
  client_date_of_birth: string | null;
  client_preferred_airport: string | null;
  air_preferred_airline: string | null;
  air_departure_airport: string | null;
  hotel_preferred_chain: string | null;
  cruise_line_preference: string | null;
  rental_car_preferred_company: string | null;
  theme_park_preference: string | null;
  departure_date: string | null;
  return_date: string | null;
  destinations: string | null;
  optional_travel_dates: string | null;
  number_of_travelers: number | string | null;
  traveler_ages: unknown;
  budget: string | null;
  trip_vision_notes: string | null;
  zoom_call_availability: string | null;
  travel_types_requested: unknown;
  converted_trip_id: string | null;
  client_account_id: string | null;
};

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

function formatTravelType(value: string) {
  return travelComponentLabels[value] ?? value.replaceAll("_", " ");
}

function formatAddress(request: QuoteRequestRow) {
  const cityStatePostal = [
    [request.client_city, request.client_state].filter(Boolean).join(", "),
    request.client_postal_code,
  ].filter(Boolean).join(" ");

  return [
    request.client_address_line_1,
    request.client_address_line_2,
    cityStatePostal,
  ].filter(Boolean).join("\n");
}

function formatTravelerAges(value: unknown) {
  if (!value) return "Not provided";

  if (Array.isArray(value)) {
    if (value.length === 0) return "Not provided";
    return value.map(String).join(", ");
  }

  if (typeof value === "string") {
    return value.trim() || "Not provided";
  }

  return JSON.stringify(value, null, 2);
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
    <form action={updateQuoteRequestStatus}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="btn btn-primary">
        {label}
      </button>
    </form>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
        overflow: "hidden",
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
        }}
      >
        {title}
      </summary>

      <div style={{ padding: 16 }} className="stack">
        {children}
      </div>
    </details>
  );
}

function RequestedComponents({
  travelTypes,
  request,
}: {
  travelTypes: string[];
  request: QuoteRequestRow;
}) {
  if (!travelTypes.length) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>No travel components were selected.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {travelTypes.map((type) => {
        const componentDetails = [];

        if (type === "air") {
          componentDetails.push(
            <InfoItem key="airline" label="Preferred Airline" value={request.air_preferred_airline ?? "Not provided"} />,
            <InfoItem key="departure-airport" label="Preferred Departure Airport" value={request.air_departure_airport ?? request.client_preferred_airport ?? "Not provided"} />,
          );
        }

        if (type === "hotel") {
          componentDetails.push(
            <InfoItem key="hotel-chain" label="Preferred Hotel Chain" value={request.hotel_preferred_chain ?? "Not provided"} />,
          );
        }

        if (type === "cruise") {
          componentDetails.push(
            <InfoItem key="cruise-line" label="Cruise Line Preference" value={request.cruise_line_preference ?? "Any"} />,
          );
        }

        if (type === "rental_car") {
          componentDetails.push(
            <InfoItem key="rental-car-company" label="Preferred Rental Car Company" value={request.rental_car_preferred_company ?? "Not provided"} />,
          );
        }

        if (type === "theme_park") {
          componentDetails.push(
            <InfoItem key="theme-park" label="Theme Park Preference" value={request.theme_park_preference ?? "Not provided"} />,
          );
        }

        return (
          <CollapsibleSection key={type} title={formatTravelType(type)}>
            <div className="grid grid-2">
              <InfoItem label="Requested Component" value={formatTravelType(type)} />
              <InfoItem label="Destination(s)" value={request.destinations} />
              <InfoItem label="Departure Date" value={formatDate(request.departure_date)} />
              <InfoItem label="Return Date" value={formatDate(request.return_date)} />
              <InfoItem label="Number of Travelers" value={request.number_of_travelers} />
              <InfoItem label="Traveler Ages" value={formatTravelerAges(request.traveler_ages)} />
              <InfoItem label="Budget" value={request.budget ?? "Not provided"} />
              <InfoItem
                label="Optional Travel Dates"
                value={request.optional_travel_dates ?? "Not provided"}
              />
              {componentDetails}
            </div>

            <InfoItem
              label="Trip Vision Notes"
              value={request.trip_vision_notes ?? "Not provided"}
            />

            <InfoItem
              label="Zoom Call Availability"
              value={request.zoom_call_availability ?? "Not provided"}
            />
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

async function updateQuoteRequestStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();

  if (!requestId) {
    throw new Error("Missing quote request ID.");
  }

  if (!allowedQuoteStatuses.includes(newStatus)) {
    throw new Error("Invalid quote request status.");
  }

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("id", requestId)
    .single();

  if (existingRequestError || !existingRequest) {
    throw new Error(existingRequestError?.message ?? "Quote request not found.");
  }

  const { error } = await supabase
    .from("quote_requests")
    .update({
      status: newStatus,
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/quote-requests");
  revalidatePath(`/admin/quote-requests/${requestId}`);
}

async function deleteQuoteRequest(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) {
    throw new Error("Missing travel request ID.");
  }

  const { error } = await supabase
    .from("quote_requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/quote-requests");
  revalidatePath("/admin/dashboard");
  redirect("/admin/quote-requests");
}

async function convertToTrip(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) {
    throw new Error("Missing request ID.");
  }

  const { data: request, error: requestError } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  const quoteRequest = request as QuoteRequestRow | null;

  if (requestError || !quoteRequest) {
    throw new Error(requestError?.message ?? "Quote request not found.");
  }

  if (quoteRequest.converted_trip_id) {
    redirect(`/admin/trips/${quoteRequest.converted_trip_id}`);
  }

  if (!quoteRequest.client_account_id) {
    throw new Error(
      "This quote request is not linked to a client account yet. Link or create a client before converting to a trip.",
    );
  }

  const { data: clientAccount, error: clientAccountError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("id", quoteRequest.client_account_id)
    .single();

  if (clientAccountError || !clientAccount) {
    throw new Error("Linked client account was not found.");
  }

  const tripName =
    quoteRequest.destinations && quoteRequest.departure_date
      ? `${quoteRequest.destinations} Trip`
      : "New Trip";

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      client_account_id: clientAccount.id,
      trip_name: tripName,
      departure_date: quoteRequest.departure_date,
      return_date: quoteRequest.return_date,
      destinations: quoteRequest.destinations,
      primary_contact_client_id: clientAccount.id,
      occasion: null,
      trip_status: "draft",
      total_paid: 0,
      balance_due: 0,
      created_from_quote_request_id: quoteRequest.id,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    throw new Error(tripError?.message ?? "Failed to create trip.");
  }

  const { error: proposalError } = await supabase.from("trip_proposals").insert({
    trip_id: trip.id,
    planning_fee: 0,
    total_price: 0,
    commission_admin_only: 0,
    proposal_title: quoteRequest.destinations
      ? `${quoteRequest.destinations} Proposal`
      : "Trip Proposal",
    proposal_welcome_text: quoteRequest.trip_vision_notes ?? null,
    proposal_highlights: [],
    proposal_closing_text: null,
  });

  if (proposalError) {
    throw new Error(proposalError.message);
  }

  const { error: requestUpdateError } = await supabase
    .from("quote_requests")
    .update({
      status: "converted_to_trip",
      converted_trip_id: trip.id,
    })
    .eq("id", quoteRequest.id);

  if (requestUpdateError) {
    throw new Error(requestUpdateError.message);
  }

  revalidatePath("/admin/quote-requests");
  revalidatePath(`/admin/quote-requests/${quoteRequest.id}`);
  revalidatePath("/admin/trips");
  revalidatePath(`/admin/trips/${trip.id}`);
  revalidatePath(`/trips/${trip.id}`);

  redirect(`/admin/trips/${trip.id}`);
}

export default async function AdminQuoteRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !data) {
    return (
      <PageShell
        title="Travel Request Detail"
        subtitle="We could not load this travel request."
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

  const request = data as QuoteRequestRow;

  const travelTypesRequested = Array.isArray(request.travel_types_requested)
    ? request.travel_types_requested.map(String)
    : [];

  return (
    <PageShell
      title="Travel Request Detail"
      subtitle={`${request.full_name ?? "Unknown Client"} • ${request.destinations ?? "Destination not provided"}`}
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
        <ActionLink href="/admin/quote-requests">Back to Quote Requests</ActionLink>

        {request.converted_trip_id ? (
          <ActionLink href={`/admin/trips/${request.converted_trip_id}`}>
            Open Converted Trip
          </ActionLink>
        ) : null}
      </div>

      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
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
              Travel Request
            </p>

            <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>
              {request.full_name ?? "Unknown Client"}
            </h1>

            <p style={{ margin: "6px 0 0", color: "#667085" }}>
              {request.destinations ?? "Destination not provided"}
            </p>
          </div>

          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Status</span>
          <p style={{ marginTop: 8 }}>
            <StatusBadge status={request.status} />
          </p>
        </div>

        <div className="card">
          <span className="label">Submitted</span>
          <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 800 }}>
            {formatDateTime(request.submitted_at)}
          </p>
        </div>

        <div className="card">
          <span className="label">Converted Trip</span>
          <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 800 }}>
            {request.converted_trip_id ? "Yes" : "No"}
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Request Overview</h2>

        <div className="grid grid-2">
          <InfoItem label="Full Name" value={request.full_name} />
          <InfoItem label="Email" value={request.email} />
          <InfoItem label="Phone Number" value={request.phone_number} />
          <InfoItem
            label="Preferred Contact Method"
            value={request.preferred_contact_method}
          />
          <InfoItem label="Date of Birth" value={formatDate(request.client_date_of_birth)} />
          <InfoItem label="Preferred Airport" value={request.client_preferred_airport ?? "Not provided"} />
          <InfoItem label="Address" value={formatAddress(request) || "Not provided"} />
          <InfoItem label="Departure Date" value={formatDate(request.departure_date)} />
          <InfoItem label="Return Date" value={formatDate(request.return_date)} />
          <InfoItem label="Number of Travelers" value={request.number_of_travelers} />
          <InfoItem label="Traveler Ages" value={formatTravelerAges(request.traveler_ages)} />
          <InfoItem label="Budget" value={request.budget ?? "Not provided"} />
          <InfoItem
            label="Travel Components"
            value={
              travelTypesRequested.length
                ? travelTypesRequested.map(formatTravelType).join(", ")
                : "Not provided"
            }
          />
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Trip Notes</h2>

        <InfoItem label="Destination(s)" value={request.destinations ?? "Not provided"} />
        <InfoItem
          label="Optional Travel Dates"
          value={request.optional_travel_dates ?? "Not provided"}
        />
        <InfoItem
          label="Trip Vision Notes"
          value={request.trip_vision_notes ?? "Not provided"}
        />
        <InfoItem
          label="Zoom Call Availability"
          value={request.zoom_call_availability ?? "Not provided"}
        />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Requested Travel Components</h2>

        <RequestedComponents
          travelTypes={travelTypesRequested}
          request={request}
        />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Status Actions</h2>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusButton requestId={request.id} status="new" label="Mark New" />
          <StatusButton requestId={request.id} status="reviewed" label="Mark Reviewed" />
          <StatusButton requestId={request.id} status="in_progress" label="Mark In Progress" />
          <StatusButton
            requestId={request.id}
            status="awaiting_client_response"
            label="Awaiting Client"
          />
          <StatusButton requestId={request.id} status="closed" label="Mark Closed" />
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Next Steps</h2>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {!request.converted_trip_id ? (
            <form action={convertToTrip}>
              <input type="hidden" name="request_id" value={request.id} />
              <button type="submit" className="btn btn-primary">
                Convert to Trip
              </button>
            </form>
          ) : null}

          {request.converted_trip_id ? (
            <ActionLink href={`/admin/trips/${request.converted_trip_id}`}>
              Open Converted Trip
            </ActionLink>
          ) : null}

          <ActionLink href="/admin/quote-requests">Back to Quote Requests</ActionLink>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#fff1f2",
          border: "1px solid #fecdd3",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#9f1239" }}>Delete Travel Request</h2>
          <p style={{ margin: "6px 0 0", color: "#9f1239", lineHeight: 1.6 }}>
            This removes the travel request from the admin queue. If it was already converted, the trip itself will not be deleted.
          </p>
        </div>

        <form action={deleteQuoteRequest}>
          <input type="hidden" name="request_id" value={request.id} />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ background: "#be123c", color: "#ffffff" }}
          >
            Delete Travel Request
          </button>
        </form>
      </div>
    </PageShell>
  );
}
