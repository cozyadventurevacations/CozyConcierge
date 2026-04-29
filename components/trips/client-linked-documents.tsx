import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClientDocumentRow = {
  id: string;
  document_type: string;
  document_title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  notes: string | null;
  created_at: string | null;
};

type LinkedDocumentRow = {
  id: string;
  trip_id: string;
  client_document_id: string;
  visibility: string;
  display_title: string | null;
  notes: string | null;
  client_documents: ClientDocumentRow | ClientDocumentRow[] | null;
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

function normalizeClientDocument(
  value: LinkedDocumentRow["client_documents"],
): ClientDocumentRow | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
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
      return type ?? "Travel Document";
  }
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

async function getCurrentClientAccountId() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = user.email?.trim().toLowerCase();

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (userProfile) {
    const { data: clientAccountByProfile, error: clientProfileError } = await supabase
      .from("client_accounts")
      .select("id")
      .eq("user_profile_id", userProfile.id)
      .maybeSingle();

    if (clientProfileError) {
      throw new Error(clientProfileError.message);
    }

    if (clientAccountByProfile?.id) {
      return clientAccountByProfile.id as string;
    }
  }

  if (userEmail) {
    const { data: clientAccountByEmail, error: clientEmailError } = await supabase
      .from("client_accounts")
      .select("id")
      .ilike("email", userEmail)
      .maybeSingle();

    if (clientEmailError) {
      throw new Error(clientEmailError.message);
    }

    if (clientAccountByEmail?.id) {
      return clientAccountByEmail.id as string;
    }
  }

  throw new Error("Client account not found.");
}

export async function ClientLinkedDocuments({ tripId }: { tripId: string }) {
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const clientAccountId = await getCurrentClientAccountId();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, client_account_id")
    .eq("id", tripId)
    .eq("client_account_id", clientAccountId)
    .maybeSingle();

  if (tripError) {
    throw new Error(tripError.message);
  }

  if (!trip) {
    return null;
  }

  const { data: linkedDocuments, error: linkedDocumentsError } = await supabase
    .from("trip_client_documents")
    .select(
      `
      id,
      trip_id,
      client_document_id,
      visibility,
      display_title,
      notes,
      client_documents (
        id,
        document_type,
        document_title,
        file_name,
        storage_path,
        content_type,
        notes,
        created_at
      )
      `,
    )
    .eq("trip_id", tripId)
    .eq("visibility", "client")
    .order("created_at", { ascending: false });

  if (linkedDocumentsError) {
    return (
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Uploaded Documents for This Trip</h2>
        <p style={{ color: "#b42318", lineHeight: 1.6 }}>
          There was a problem loading attached client documents.
        </p>
      </div>
    );
  }

  const linkedRows = (linkedDocuments ?? []) as LinkedDocumentRow[];

  if (linkedRows.length === 0) {
    return null;
  }

  const documentsWithUrls = await Promise.all(
    linkedRows.map(async (linkedDocument) => {
      const clientDocument = normalizeClientDocument(linkedDocument.client_documents);

      let signedUrl: string | null = null;

      if (clientDocument?.storage_path) {
        const { data, error } = await supabaseAdmin.storage
          .from("client-documents")
          .createSignedUrl(clientDocument.storage_path, 60 * 5);

        signedUrl = error ? null : data?.signedUrl ?? null;
      }

      return {
        ...linkedDocument,
        clientDocument,
        signedUrl,
      };
    }),
  );

  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Uploaded Documents for This Trip</h2>

      <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
        These are client-uploaded documents your advisor has attached to this trip.
        Temporary document links expire after 5 minutes.
      </p>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>File Name</th>
              <th>Uploaded</th>
              <th>Notes</th>
              <th>Open</th>
            </tr>
          </thead>

          <tbody>
            {documentsWithUrls.map((linkedDocument) => {
              const clientDocument = linkedDocument.clientDocument;

              return (
                <tr key={linkedDocument.id}>
                  <td>
                    <DocumentTypeBadge type={clientDocument?.document_type} />
                  </td>

                  <td>
                    {linkedDocument.display_title ||
                      clientDocument?.document_title ||
                      "Travel Document"}
                  </td>

                  <td>{clientDocument?.file_name ?? "Not provided"}</td>

                  <td>{formatDateTime(clientDocument?.created_at)}</td>

                  <td>{linkedDocument.notes ?? clientDocument?.notes ?? "Not provided"}</td>

                  <td>
                    {linkedDocument.signedUrl ? (
                      <a
                        href={linkedDocument.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{
                          padding: "6px 10px",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Open 5-Min Link
                      </a>
                    ) : (
                      "Unavailable"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}