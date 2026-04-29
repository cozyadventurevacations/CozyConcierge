import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientAccount = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TripRow = {
  id: string;
  client_account_id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
};

type TripDocumentRow = {
  id: string;
  trip_id: string;
  file_name: string;
  storage_path: string;
  visibility: string | null;
  created_at: string | null;
};

type DocumentWithUrl = TripDocumentRow & {
  signedUrl: string | null;
};

function formatDate(value: string | null | undefined, fallback = "Not set") {
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

function formatDateTime(value: string | null | undefined, fallback = "Not set") {
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

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "draft";

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
      clientAccount: clientAccountByEmail as ClientAccount,
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
    clientAccount: clientAccountByProfile as ClientAccount,
  };
}

export default async function ClientTripDocumentsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { supabase, clientAccount } = await getCurrentClientAccount();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, client_account_id, trip_name, destinations, departure_date, return_date, trip_status",
    )
    .eq("id", tripId)
    .eq("client_account_id", clientAccount.id)
    .single();

  if (tripError || !trip) {
    return (
      <PageShell title="Trip Documents" subtitle="We could not load this trip.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <p>Trip not found or access denied.</p>
        </div>
      </PageShell>
    );
  }

  const { data: documents, error: documentsError } = await supabase
    .from("trip_documents")
    .select("id, trip_id, file_name, storage_path, visibility, created_at")
    .eq("trip_id", tripId)
    .eq("visibility", "client")
    .order("created_at", { ascending: false });

  if (documentsError) {
    return (
      <PageShell title="Trip Documents" subtitle="We could not load your documents.">
        <div className="card">
          <p>
            <strong>Error:</strong>
          </p>
          <pre>{JSON.stringify(documentsError, null, 2)}</pre>
        </div>
      </PageShell>
    );
  }

  const documentRows = (documents ?? []) as TripDocumentRow[];

  const documentsWithUrls: DocumentWithUrl[] = await Promise.all(
    documentRows.map(async (doc) => {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(doc.storage_path, 60 * 60);

      return {
        ...doc,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  const tripRow = trip as TripRow;

  return (
    <PageShell
      title="Trip Documents"
      subtitle="Client-visible files shared by Cozy Adventure Vacations."
    >
      <div
        className="card stack"
        style={{
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
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
          Cozy Concierge Documents
        </p>

        <h1 style={{ margin: "4px 0 0", fontSize: 30 }}>
          {tripRow.trip_name ?? "Your Trip"}
        </h1>

        <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
          {tripRow.destinations ?? "Your destination details are coming soon."}
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusBadge status={tripRow.trip_status} />
          <span style={{ color: "#667085", lineHeight: 1.5 }}>
            {formatDate(tripRow.departure_date)} → {formatDate(tripRow.return_date)}
          </span>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          background: "#f7fbfc",
          border: "1px solid #e6f0f2",
        }}
      >
        <h2 style={{ margin: 0 }}>Before Opening Documents</h2>

        <div className="grid grid-2">
          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Review Carefully</span>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Confirm traveler names, dates, confirmation numbers, payment details,
              and document requirements match your booking.
            </p>
          </div>

          <div
            style={{
              padding: "12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <span className="label">Secure Access</span>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Document links are temporary for security. Reopen this page if a link
              expires and you need a fresh one.
            </p>
          </div>
        </div>
      </div>

      <div className="card stack">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Shared Documents</h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
              These are the files your advisor has made visible for this trip.
            </p>
          </div>

          <Link href={`/trips/${tripId}`} className="btn btn-outline">
            Back to Trip
          </Link>
        </div>

        {documentsWithUrls.length === 0 ? (
          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#f7fbfc",
              border: "1px solid #e6f0f2",
            }}
          >
            <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
              No client-visible documents have been shared for this trip yet.
              When Cozy Adventure Vacations uploads documents for you, they will
              appear here.
            </p>
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 720 }}>
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
                    <td>{formatDateTime(doc.created_at)}</td>
                    <td>
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline"
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open Document
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
        )}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Link href={`/trips/${tripId}`} className="btn btn-primary">
          Back to Trip
        </Link>

        <Link href="/trips" className="btn btn-outline">
          Back to My Trips
        </Link>
      </div>
    </PageShell>
  );
}