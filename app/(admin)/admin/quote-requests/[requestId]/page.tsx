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
  request: Record<string, any>;
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
      {travelTypes.map((type) => (
        <CollapsibleSection key={type} title={formatTravelType(type)}>
          <div className="grid grid-2">
            <InfoItem label="Requested Component" value={formatTravelType(type)} />
            <InfoItem label="Destination(s)" value={request.destinations} />
            <InfoItem label="Departure Date" value={formatDate(request.departure_date)} />
            <InfoItem label="Return Date" value={formatDate(request.return_date)} />
            <InfoItem label="Number of Travelers" value={request.number_of_travelers} />
            <InfoItem label="Traveler Ages" value={JSON.stringify(request.traveler_ages ?? [], null, 2)} />
            <InfoItem label="Budget" value={request.budget ?? "Not provided"} />
            <InfoItem
              label="Optional Travel Dates"
              value={request.optional_travel_dates ?? "Not provided"}
            />
          </div>

          <InfoItem
            label="Trip Vision Notes"
            value={request.trip_vision_notes ?? "Not provided"}
          />

          <InfoItem
            label="Zoom Call Availability"
            value={request.zoom_call_availability ?? "Not provided"}
          />

          <div
            style={{
              padding: "12px",
              border: "1px solid #eef2f5",
              borderRadius: 12,
              background: "#fbfdfe",
            }}
          >
            <span className="label">Admin Planning Notes</span>
            <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.5 }}>
              Future update: this area can become a component-specific planning workspace
              for supplier options, pricing, confirmation numbers, commission notes, and
              client-facing proposal details.
            </p>
          </div>
        </CollapsibleSection>
      ))}
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

  if (requestError || !request) {
    throw new Error(requestError?.message ?? "Quote request not found.");
  }

  if (request.converted_trip_id) {
    redirect(`/admin/trips/${request.converted_trip_id}`);
  }

  if (!request.client_account_id) {
    throw new Error(
      "This quote request is not linked to a client account yet. Link or create a client before converting to a trip.",
    );
  }

  const { data: clientAccount, error: clientAccountError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("id", request.client_account_id)
    .single();

  if (clientAccountError || !clientAccount) {
    throw new Error("Linked client account was not found.");
  }

  const tripName =
    request.destinations && request.departure_date
      ? `${request.destinations} Trip`
      : "New Trip";

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      client_account_id: clientAccount.id,
      trip_name: tripName,
      departure_date: request.departure_date,
      return_date: request.return_date,
      destinations: request.destinations,
      primary_contact_client_id: clientAccount.id,
      occasion: null,
      trip_status: "draft",
      total_paid: 0,
      balance_due: 0,
      created_from_quote_request_id: request.id,
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
    proposal_title: request.destinations
      ? `${request.destinations} Proposal`
      : "Trip Proposal",
    proposal_welcome_text: request.trip_vision_notes ?? null,
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
    .eq("id", request.id);

  if (requestUpdateError) {
    throw new Error(requestUpdateError.message);
  }

  revalidatePath("/admin/quote-requests");
  revalidatePath(`/admin/quote-requests/${request.id}`);
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

  const { data: request, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !request) {
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

  const travelTypesRequested = Array.isArray(request.travel_types_requested)
    ? request.travel_types_requested.map(String)
    : [];

  return (
    <PageShell
      title="Travel Request Detail"
      subtitle="Review the request details and selected travel components."
    >
      <div className="card stack">
        <CollapsibleSection title="Request Overview" defaultOpen>
          <div className="grid grid-2">
            <InfoItem label="Status" value={request.status} />
            <InfoItem label="Submitted" value={formatDateTime(request.submitted_at)} />
            <InfoItem label="Full Name" value={request.full_name} />
            <InfoItem label="Email" value={request.email} />
            <InfoItem label="Phone Number" value={request.phone_number} />
            <InfoItem
              label="Preferred Contact Method"
              value={request.preferred_contact_method}
            />
            <InfoItem label="Departure Date" value={formatDate(request.departure_date)} />
            <InfoItem label="Return Date" value={formatDate(request.return_date)} />
            <InfoItem label="Number of Travelers" value={request.number_of_travelers} />
            <InfoItem label="Budget" value={request.budget ?? "Not provided"} />
            <InfoItem
              label="Converted Trip"
              value={request.converted_trip_id ? "Yes" : "No"}
            />
            <InfoItem
              label="Travel Components"
              value={
                travelTypesRequested.length
                  ? travelTypesRequested.map(formatTravelType).join(", ")
                  : "Not provided"
              }
            />
          </div>

          {request.converted_trip_id ? (
            <div className="row">
              <a
                href={`/admin/trips/${request.converted_trip_id}`}
                className="btn btn-primary"
              >
                Open Converted Trip
              </a>
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection title="General Trip Notes" defaultOpen>
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
          <InfoItem
            label="Traveler Ages"
            value={JSON.stringify(request.traveler_ages ?? [], null, 2)}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Requested Travel Components">
          <RequestedComponents
            travelTypes={travelTypesRequested}
            request={request as Record<string, any>}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Status Actions">
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <form action={updateQuoteRequestStatus}>
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="status" value="new" />
              <button type="submit" className="btn btn-outline">
                Mark New
              </button>
            </form>

            <form action={updateQuoteRequestStatus}>
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="status" value="reviewed" />
              <button type="submit" className="btn btn-outline">
                Mark Reviewed
              </button>
            </form>

            <form action={updateQuoteRequestStatus}>
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="status" value="in_progress" />
              <button type="submit" className="btn btn-outline">
                Mark In Progress
              </button>
            </form>

            <form action={updateQuoteRequestStatus}>
              <input type="hidden" name="request_id" value={request.id} />
              <input
                type="hidden"
                name="status"
                value="awaiting_client_response"
              />
              <button type="submit" className="btn btn-outline">
                Awaiting Client
              </button>
            </form>

            <form action={updateQuoteRequestStatus}>
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="status" value="closed" />
              <button type="submit" className="btn btn-outline">
                Mark Closed
              </button>
            </form>
          </div>
        </CollapsibleSection>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {!request.converted_trip_id ? (
            <form action={convertToTrip}>
              <input type="hidden" name="request_id" value={request.id} />
              <button type="submit" className="btn btn-primary">
                Convert to Trip
              </button>
            </form>
          ) : null}

          <a href="/admin/quote-requests" className="btn btn-outline">
            Back to Quote Requests
          </a>
        </div>
      </div>
    </PageShell>
  );
}