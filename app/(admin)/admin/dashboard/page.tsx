import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TripRow = {
  id: string;
  trip_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  destinations: string | null;
  trip_status: string | null;
  final_payment_due_date?: string | null;
  balance_due?: number | null;
};

type QuoteRequestRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  destinations: string | null;
  departure_date: string | null;
  status: string | null;
  submitted_at: string | null;
};

type CommissionRow = {
  id: string;
  commission_name: string;
  booking_number: string | null;
  supplier_name_snapshot: string | null;
  client_name_snapshot: string | null;
  trip_name_snapshot: string | null;
  full_commission_amount: number | null;
  agency_commission_percent: number | null;
  expected_commission_amount: number | null;
  received_commission_amount: number | null;
  commission_status: string | null;
  expected_payment_date: string | null;
  received_payment_date: string | null;
};

type ClientFollowUpRow = {
  id: string;
  client_account_id: string;
  note_type: string;
  title: string | null;
  content: string | null;
  follow_up_date: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  client_accounts:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

type RecentClientDocRow = {
  id: string;
  document_title: string | null;
  document_type: string | null;
  created_at: string | null;
  client_accounts:
    | { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }
    | { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }[]
    | null;
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatMoney(value: number | null | undefined, fallback = "$0.00") {
  if (typeof value !== "number") return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "") {
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

function getOutstandingCommission(row: CommissionRow) {
  return getExpectedCommission(row) - Number(row.received_commission_amount ?? 0);
}

function getClientFromFollowUp(row: ClientFollowUpRow) {
  if (Array.isArray(row.client_accounts)) {
    return row.client_accounts[0] ?? null;
  }

  return row.client_accounts ?? null;
}

function getClientDisplayName(row: ClientFollowUpRow) {
  const client = getClientFromFollowUp(row);

  if (!client) return "Unknown Client";

  const name = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();

  return name || client.email || "Unnamed Client";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "unknown";

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
      {label}
    </span>
  );
}

function FollowUpBadge({ isOverdue }: { isOverdue: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        background: isOverdue ? "#fff1f2" : "#f0f7f8",
        color: isOverdue ? "#be123c" : "var(--accent-dark)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {isOverdue ? "overdue" : "upcoming"}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card stack"
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e6f0f2",
      }}
    >
      <span className="label">{title}</span>
      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{value}</strong>
      {subtitle ? (
        <span style={{ color: "#64748b", lineHeight: 1.45 }}>{subtitle}</span>
      ) : null}
    </Link>
  );
}

function SectionTitle({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div
      className="row"
      style={{
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>
      <Link href={href} className="btn btn-primary">
        {linkLabel}
      </Link>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const today = startOfToday();
  const in7Days = addDays(today, 7);
  const in14Days = addDays(today, 14);
  const in30Days = addDays(today, 30);
  const sevenDaysAgo = addDays(today, -7);

  const todayStr = today.toISOString().slice(0, 10);
  const in7DaysStr = in7Days.toISOString().slice(0, 10);
  const in14DaysStr = in14Days.toISOString().slice(0, 10);
  const in30DaysStr = in30Days.toISOString().slice(0, 10);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [
    newQuoteRequestsResult,
    paymentRequestsResult,
    finalPaymentsDueResult,
    departuresResult,
    recentClientDocsResult,
    upcomingDeparturesResult,
    recentQuoteRequestsResult,
    upcomingFinalPaymentsResult,
    upcomingCommissionsResult,
    overdueClientFollowUpsResult,
    upcomingClientFollowUpsResult,
    openClientFollowUpsResult,
  ] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),

    supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "pending", "sent"]),

    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .gte("final_payment_due_date", todayStr)
      .lte("final_payment_due_date", in7DaysStr),

    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .gte("departure_date", todayStr)
      .lte("departure_date", in14DaysStr),

    supabase
      .from("client_documents")
      .select("id, document_title, document_type, created_at, client_accounts(id, first_name, last_name, preferred_name)")
      .gte("created_at", sevenDaysAgoIso)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("trips")
      .select("id, trip_name, departure_date, return_date, destinations, trip_status")
      .gte("departure_date", todayStr)
      .order("departure_date", { ascending: true })
      .limit(10),

    supabase
      .from("quote_requests")
      .select("id, full_name, email, destinations, departure_date, status, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(10),

    supabase
      .from("trips")
      .select(
        "id, trip_name, destinations, departure_date, return_date, trip_status, final_payment_due_date, balance_due",
      )
      .gte("final_payment_due_date", todayStr)
      .lte("final_payment_due_date", in30DaysStr)
      .order("final_payment_due_date", { ascending: true })
      .limit(10),

    supabase
      .from("commissions")
      .select(
        "id, commission_name, booking_number, supplier_name_snapshot, client_name_snapshot, trip_name_snapshot, full_commission_amount, agency_commission_percent, expected_commission_amount, received_commission_amount, commission_status, expected_payment_date, received_payment_date",
      )
      .neq("commission_status", "received")
      .neq("commission_status", "cancelled")
      .gte("expected_payment_date", todayStr)
      .lte("expected_payment_date", in30DaysStr)
      .order("expected_payment_date", { ascending: true })
      .limit(10),

    supabase
      .from("client_notes")
      .select(
        "id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)",
      )
      .eq("is_completed", false)
      .lt("follow_up_date", todayStr)
      .order("follow_up_date", { ascending: true })
      .limit(10),

    supabase
      .from("client_notes")
      .select(
        "id, client_account_id, note_type, title, content, follow_up_date, is_completed, created_at, client_accounts(id, first_name, last_name, email)",
      )
      .eq("is_completed", false)
      .gte("follow_up_date", todayStr)
      .lte("follow_up_date", in7DaysStr)
      .order("follow_up_date", { ascending: true })
      .limit(10),

    supabase
      .from("client_notes")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false),
  ]);

  const upcomingCommissions =
    (upcomingCommissionsResult.data ?? []) as CommissionRow[];

  const upcomingDepartures =
    (upcomingDeparturesResult.data ?? []) as TripRow[];

  const recentQuoteRequests =
    (recentQuoteRequestsResult.data ?? []) as QuoteRequestRow[];

  const upcomingFinalPayments =
    (upcomingFinalPaymentsResult.data ?? []) as TripRow[];

  const overdueClientFollowUps =
    (overdueClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];

  const upcomingClientFollowUps =
    (upcomingClientFollowUpsResult.data ?? []) as ClientFollowUpRow[];

  const recentClientDocs =
    (recentClientDocsResult.data ?? []) as RecentClientDocRow[];

  const upcomingCommissionTotal = upcomingCommissions.reduce(
    (sum, commission) => sum + getOutstandingCommission(commission),
    0,
  );

  const upcomingFinalPaymentTotal = upcomingFinalPayments.reduce(
    (sum, trip) => sum + Number(trip.balance_due ?? 0),
    0,
  );

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle="Your live overview of quotes, payments, trips, commissions, follow-ups, and recent activity."
    >
      <div className="grid grid-3">
        <SummaryCard
          title="New Travel Requests"
          value={newQuoteRequestsResult.count ?? 0}
          subtitle="Requests waiting for review"
          href="/admin/quote-requests"
        />

        <SummaryCard
          title="Payment Requests Needing Action"
          value={paymentRequestsResult.count ?? 0}
          subtitle="New, pending, or sent"
          href="/admin/payment-requests"
        />

        <SummaryCard
          title="Open Client Follow-Ups"
          value={openClientFollowUpsResult.count ?? 0}
          subtitle="Client notes still open"
          href="/admin/clients"
        />

        <SummaryCard
          title="Overdue Client Follow-Ups"
          value={overdueClientFollowUps.length}
          subtitle="Follow-ups past due"
          href="/admin/clients"
        />

        <SummaryCard
          title="Follow-Ups Due in 7 Days"
          value={upcomingClientFollowUps.length}
          subtitle="Client reminders coming up"
          href="/admin/clients"
        />

        <SummaryCard
          title="Trips Departing in 14 Days"
          value={departuresResult.count ?? 0}
          subtitle="Upcoming client travel"
          href="/admin/trips"
        />

        <SummaryCard
          title="Final Payments Due in 7 Days"
          value={finalPaymentsDueResult.count ?? 0}
          subtitle="Trips needing payment attention"
          href="/admin/trips"
        />

        <SummaryCard
          title="Expected Commissions in 30 Days"
          value={formatMoney(upcomingCommissionTotal)}
          subtitle={`${upcomingCommissions.length} expected commission${upcomingCommissions.length === 1 ? "" : "s"}`}
          href="/admin/commissions"
        />

        <SummaryCard
          title="Final Payments in 30 Days"
          value={formatMoney(upcomingFinalPaymentTotal)}
          subtitle={`${upcomingFinalPayments.length} trip balance${upcomingFinalPayments.length === 1 ? "" : "s"} due soon`}
          href="/admin/trips"
        />
      </div>

      <div className="card stack">
        <SectionTitle
          title="Client Follow-Ups Needing Attention"
          href="/admin/clients"
          linkLabel="View All Clients"
        />

        {overdueClientFollowUpsResult.error || upcomingClientFollowUpsResult.error ? (
          <pre>
            {JSON.stringify(
              overdueClientFollowUpsResult.error ?? upcomingClientFollowUpsResult.error,
              null,
              2,
            )}
          </pre>
        ) : overdueClientFollowUps.length === 0 &&
          upcomingClientFollowUps.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No overdue or upcoming client follow-ups. Look at you, suspiciously organized.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Note</th>
                  <th>Follow-Up Date</th>
                  <th>Open Client</th>
                </tr>
              </thead>
              <tbody>
                {[...overdueClientFollowUps, ...upcomingClientFollowUps].map(
                  (followUp) => {
                    const client = getClientFromFollowUp(followUp);
                    const isOverdue =
                      Boolean(followUp.follow_up_date) &&
                      followUp.follow_up_date! < todayStr;

                    return (
                      <tr key={followUp.id}>
                        <td>
                          <FollowUpBadge isOverdue={isOverdue} />
                        </td>
                        <td>{getClientDisplayName(followUp)}</td>
                        <td>{followUp.note_type}</td>
                        <td>{followUp.title ?? "Not provided"}</td>
                        <td style={{ maxWidth: 360 }}>
                          <span
                            style={{
                              display: "block",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.45,
                            }}
                          >
                            {followUp.content ?? "Not provided"}
                          </span>
                        </td>
                        <td>{formatDate(followUp.follow_up_date)}</td>
                        <td>
                          {client?.id ? (
                            <Link href={`/admin/clients/${client.id}`}>Open</Link>
                          ) : (
                            "Unavailable"
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle
          title="New Client Documents — Last 7 Days"
          href="/admin/client-documents"
          linkLabel="View All Documents"
        />

        {recentClientDocs.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No new client documents uploaded in the last 7 days.
          </p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {recentClientDocs.map((doc) => {
              const client = Array.isArray(doc.client_accounts)
                ? doc.client_accounts[0]
                : doc.client_accounts;
              const clientName = client
                ? `${client.preferred_name ?? client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unknown Client"
                : "Unknown Client";
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "1px solid #e6f0f2",
                    borderRadius: 12,
                    background: "#f7fbfc",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                      {clientName} has uploaded new documentation
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                      {doc.document_title ?? doc.document_type ?? "Document"} — {formatDateTime(doc.created_at)}
                    </p>
                  </div>
                  {client?.id ? (
                    <Link href={`/admin/clients/${client.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>
                      Open Client
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle
          title="Commissions Expected in 30 Days"
          href="/admin/commissions"
          linkLabel="View All Commissions"
        />

        {upcomingCommissionsResult.error ? (
          <pre>{JSON.stringify(upcomingCommissionsResult.error, null, 2)}</pre>
        ) : upcomingCommissions.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No commissions expected in the next 30 days.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th>Commission</th>
                  <th>Supplier</th>
                  <th>Client</th>
                  <th>Trip</th>
                  <th>Booking #</th>
                  <th>Status</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Expected Date</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {upcomingCommissions.map((commission) => {
                  const expected = getExpectedCommission(commission);
                  const outstanding = getOutstandingCommission(commission);

                  return (
                    <tr key={commission.id}>
                      <td>{commission.commission_name}</td>
                      <td>{commission.supplier_name_snapshot ?? "Not provided"}</td>
                      <td>{commission.client_name_snapshot ?? "Not provided"}</td>
                      <td>{commission.trip_name_snapshot ?? "Not provided"}</td>
                      <td>{commission.booking_number ?? "Not provided"}</td>
                      <td>
                        <StatusBadge status={commission.commission_status} />
                      </td>
                      <td>{formatMoney(expected)}</td>
                      <td>{formatMoney(commission.received_commission_amount)}</td>
                      <td>{formatMoney(outstanding)}</td>
                      <td>{formatDate(commission.expected_payment_date)}</td>
                      <td>
                        <Link href={`/admin/commissions/${commission.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle
          title="Upcoming Final Payments"
          href="/admin/trips"
          linkLabel="View All Trips"
        />

        {upcomingFinalPaymentsResult.error ? (
          <pre>{JSON.stringify(upcomingFinalPaymentsResult.error, null, 2)}</pre>
        ) : upcomingFinalPayments.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No final payments due in the next 30 days.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th>Trip Name</th>
                  <th>Destination</th>
                  <th>Final Payment Due</th>
                  <th>Balance Due</th>
                  <th>Departure</th>
                  <th>Status</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {upcomingFinalPayments.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.trip_name ?? "Trip"}</td>
                    <td>{trip.destinations ?? "Not set"}</td>
                    <td>{formatDate(trip.final_payment_due_date)}</td>
                    <td>{formatMoney(trip.balance_due)}</td>
                    <td>{formatDate(trip.departure_date)}</td>
                    <td>
                      <StatusBadge status={trip.trip_status} />
                    </td>
                    <td>
                      <Link href={`/admin/trips/${trip.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle
          title="Upcoming Departures"
          href="/admin/trips"
          linkLabel="View All Trips"
        />

        {upcomingDeparturesResult.error ? (
          <pre>{JSON.stringify(upcomingDeparturesResult.error, null, 2)}</pre>
        ) : upcomingDepartures.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No upcoming departures found.
          </p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Trip Name</th>
                  <th>Destination</th>
                  <th>Departure</th>
                  <th>Return</th>
                  <th>Status</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {upcomingDepartures.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.trip_name ?? "Trip"}</td>
                    <td>{trip.destinations ?? "Not set"}</td>
                    <td>{formatDate(trip.departure_date)}</td>
                    <td>{formatDate(trip.return_date)}</td>
                    <td>
                      <StatusBadge status={trip.trip_status} />
                    </td>
                    <td>
                      <Link href={`/admin/trips/${trip.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <SectionTitle
          title="Recent Travel Requests"
          href="/admin/quote-requests"
          linkLabel="View All Travel Requests"
        />

        {recentQuoteRequestsResult.error ? (
          <pre>{JSON.stringify(recentQuoteRequestsResult.error, null, 2)}</pre>
        ) : recentQuoteRequests.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            No travel requests found.
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
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {recentQuoteRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.full_name ?? ""}</td>
                    <td>{request.email ?? ""}</td>
                    <td>{request.destinations ?? ""}</td>
                    <td>{formatDate(request.departure_date)}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>{formatDateTime(request.submitted_at)}</td>
                    <td>
                      <Link href={`/admin/quote-requests/${request.id}`}>
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