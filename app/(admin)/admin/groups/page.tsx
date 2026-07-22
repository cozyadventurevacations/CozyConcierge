import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TravelGroupRow = {
  id: string;
  group_name: string;
  slug: string;
  destination: string | null;
  group_type: string | null;
  status: string;
  visibility: string;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  deposit_deadline: string | null;
  starting_price: number | null;
  deposit_amount: number | null;
  max_participants: number | null;
  created_at: string | null;
};

type ParticipantCountRow = {
  group_id: string;
  status: string;
  party_size: number | null;
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function toMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function toInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colors =
    normalized === "open"
      ? { background: "#ecfdf3", color: "#027a48" }
      : normalized === "archived"
        ? { background: "#f1f5f9", color: "#475569" }
        : normalized === "closed"
          ? { background: "#fff1f2", color: "#be123c" }
          : { background: "#fff7ed", color: "#c2410c" };

  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 10px",
        background: colors.background,
        color: colors.color,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

async function createTravelGroup(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const groupName = cleanText(formData, "group_name");
  if (!groupName) throw new Error("Group name is required.");

  const requestedSlug = cleanText(formData, "slug");
  const baseSlug = slugify(requestedSlug || groupName);
  if (!baseSlug) throw new Error("A shareable URL slug is required.");

  let slug = baseSlug;
  for (let attempt = 2; attempt <= 20; attempt++) {
    const { data: existing, error } = await supabase
      .from("travel_groups" as any)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!existing) break;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data, error } = await supabase
    .from("travel_groups" as any)
    .insert({
      group_name: groupName,
      slug,
      destination: cleanText(formData, "destination"),
      group_type: cleanText(formData, "group_type"),
      status: cleanText(formData, "status") ?? "planning",
      visibility: cleanText(formData, "visibility") ?? "public",
      start_date: cleanText(formData, "start_date"),
      end_date: cleanText(formData, "end_date"),
      registration_deadline: cleanText(formData, "registration_deadline"),
      deposit_deadline: cleanText(formData, "deposit_deadline"),
      starting_price: toMoney(formData.get("starting_price")),
      deposit_amount: toMoney(formData.get("deposit_amount")),
      max_participants: toInteger(formData.get("max_participants")),
      overview: cleanText(formData, "overview"),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create group.");
  }

  revalidatePath("/admin/groups");
  redirect(`/admin/groups/${data.id}`);
}

export default async function AdminGroupsPage() {
  const { supabase } = await requireAdmin();

  const [groupsResult, participantsResult] = await Promise.all([
    supabase
      .from("travel_groups" as any)
      .select("id, group_name, slug, destination, group_type, status, visibility, start_date, end_date, registration_deadline, deposit_deadline, starting_price, deposit_amount, max_participants, created_at")
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("travel_group_participants" as any)
      .select("group_id, status, party_size"),
  ]);

  if (groupsResult.error) {
    return (
      <PageShell title="Groups" subtitle="Build and manage group travel.">
        <div className="card">
          <p><strong>Error loading groups:</strong></p>
          <pre>{JSON.stringify(groupsResult.error, null, 2)}</pre>
          <p style={{ color: "#64748b", lineHeight: 1.6 }}>
            Groups need a database setup step before they can be used.
          </p>
        </div>
      </PageShell>
    );
  }

  const groups = (groupsResult.data ?? []) as TravelGroupRow[];
  const participants = (participantsResult.data ?? []) as ParticipantCountRow[];
  const participantTotals = new Map<string, { records: number; party: number; registered: number }>();

  for (const participant of participants) {
    const current = participantTotals.get(participant.group_id) ?? {
      records: 0,
      party: 0,
      registered: 0,
    };
    current.records += 1;
    current.party += Number(participant.party_size ?? 1);
    if (["registered", "deposit_paid", "paid_in_full"].includes(participant.status)) {
      current.registered += 1;
    }
    participantTotals.set(participant.group_id, current);
  }

  return (
    <PageShell title="Groups" subtitle="Create public group landing pages and manage group participants.">
      <div className="grid grid-3">
        <div className="card">
          <span className="label">Active Groups</span>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>
            {groups.filter((group) => group.status !== "archived").length}
          </p>
        </div>
        <div className="card">
          <span className="label">Public Landing Pages</span>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>
            {groups.filter((group) => group.visibility === "public").length}
          </p>
        </div>
        <div className="card">
          <span className="label">People Tracking</span>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>
            {participants.reduce((sum, participant) => sum + Number(participant.party_size ?? 1), 0)}
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Create Group</h2>
        <form action={createTravelGroup} className="stack">
          <div className="grid grid-3">
            <label className="stack-sm">
              <span className="label">Group Name</span>
              <input className="input" name="group_name" placeholder="Smith Family Alaska Cruise" required />
            </label>
            <label className="stack-sm">
              <span className="label">Shareable Slug</span>
              <input className="input" name="slug" placeholder="smith-family-alaska" />
            </label>
            <label className="stack-sm">
              <span className="label">Group Type</span>
              <select className="select" name="group_type" defaultValue="family">
                <option value="family">Family / Friends</option>
                <option value="destination_wedding">Destination Wedding</option>
                <option value="cruise">Cruise Group</option>
                <option value="school">School / Student</option>
                <option value="church">Church / Organization</option>
                <option value="hosted">Hosted Departure</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="grid grid-4">
            <label className="stack-sm">
              <span className="label">Destination</span>
              <input className="input" name="destination" />
            </label>
            <label className="stack-sm">
              <span className="label">Start Date</span>
              <input className="input" type="date" name="start_date" />
            </label>
            <label className="stack-sm">
              <span className="label">End Date</span>
              <input className="input" type="date" name="end_date" />
            </label>
            <label className="stack-sm">
              <span className="label">Status</span>
              <select className="select" name="status" defaultValue="planning">
                <option value="planning">planning</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>

          <div className="grid grid-4">
            <label className="stack-sm">
              <span className="label">Starting Price</span>
              <input className="input" type="number" step="0.01" name="starting_price" />
            </label>
            <label className="stack-sm">
              <span className="label">Deposit Amount</span>
              <input className="input" type="number" step="0.01" name="deposit_amount" />
            </label>
            <label className="stack-sm">
              <span className="label">Deposit Deadline</span>
              <input className="input" type="date" name="deposit_deadline" />
            </label>
            <label className="stack-sm">
              <span className="label">Max Participants</span>
              <input className="input" type="number" min="0" name="max_participants" />
            </label>
          </div>

          <label className="stack-sm">
            <span className="label">Landing Page Overview</span>
            <textarea className="textarea" name="overview" rows={4} />
          </label>

          <input type="hidden" name="visibility" value="public" />
          <button className="btn btn-primary" type="submit">Create Group</button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Group Management</h2>
        {groups.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No groups yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Actions</th>
                  <th>Group</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Deposit</th>
                  <th>Participants</th>
                  <th>Landing Page</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const totals = participantTotals.get(group.id) ?? {
                    records: 0,
                    party: 0,
                    registered: 0,
                  };
                  return (
                    <tr key={group.id}>
                      <td>
                        <div style={{ display: "grid", gap: 6, minWidth: 92 }}>
                          <Link href={`/admin/groups/${group.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: "6px 10px" }}>Manage</Link>
                          <Link href={`/groups/${group.slug}`} className="btn btn-outline" style={{ fontSize: 13, padding: "6px 10px" }}>View</Link>
                        </div>
                      </td>
                      <td>
                        <strong>{group.group_name}</strong>
                        <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>
                          {group.destination ?? "No destination"} {group.group_type ? `- ${group.group_type}` : ""}
                        </span>
                      </td>
                      <td>{formatDate(group.start_date)} - {formatDate(group.end_date)}</td>
                      <td><StatusBadge status={group.status} /></td>
                      <td>{formatMoney(group.starting_price)}</td>
                      <td>
                        {formatMoney(group.deposit_amount)}
                        <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>
                          Due {formatDate(group.deposit_deadline)}
                        </span>
                      </td>
                      <td>{totals.party} traveler{totals.party === 1 ? "" : "s"} / {totals.records} record{totals.records === 1 ? "" : "s"}</td>
                      <td><code>/groups/{group.slug}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
