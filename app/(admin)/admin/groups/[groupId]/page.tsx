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
  hero_image_url: string | null;
  overview: string | null;
  included: string | null;
  not_included: string | null;
  notes: string | null;
};

type ParticipantRow = {
  id: string;
  group_id: string;
  client_account_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  party_size: number | null;
  status: string;
  deposit_paid: boolean | null;
  paid_in_full: boolean | null;
  notes: string | null;
  created_at: string | null;
};

const participantStatuses = [
  "interested",
  "invited",
  "registered",
  "deposit_paid",
  "paid_in_full",
  "cancelled",
];

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

function toInteger(value: FormDataEntryValue | null, fallback: number | null = null) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
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

function participantName(participant: ParticipantRow) {
  return `${participant.first_name ?? ""} ${participant.last_name ?? ""}`.trim() || participant.email || "Unnamed participant";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colors =
    normalized === "paid_in_full" || normalized === "deposit_paid" || normalized === "registered"
      ? { background: "#ecfdf3", color: "#027a48" }
      : normalized === "cancelled"
        ? { background: "#fff1f2", color: "#be123c" }
        : { background: "#fff7ed", color: "#c2410c" };

  return (
    <span style={{ display: "inline-flex", borderRadius: 999, padding: "4px 10px", background: colors.background, color: colors.color, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function revalidateGroup(groupId: string, slug?: string | null) {
  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${groupId}`);
  if (slug) revalidatePath(`/groups/${slug}`);
}

async function updateTravelGroup(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const groupName = cleanText(formData, "group_name");
  const slug = slugify(cleanText(formData, "slug") || groupName || "");

  if (!groupId) throw new Error("Missing group ID.");
  if (!groupName) throw new Error("Group name is required.");
  if (!slug) throw new Error("Shareable slug is required.");

  const { error } = await supabase
    .from("travel_groups" as any)
    .update({
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
      hero_image_url: cleanText(formData, "hero_image_url"),
      overview: cleanText(formData, "overview"),
      included: cleanText(formData, "included"),
      not_included: cleanText(formData, "not_included"),
      notes: cleanText(formData, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId);

  if (error) throw new Error(error.message);

  revalidateGroup(groupId, slug);
  redirect(`/admin/groups/${groupId}?saved=1`);
}

async function addParticipant(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const slug = cleanText(formData, "group_slug");

  if (!groupId) throw new Error("Missing group ID.");

  const { error } = await supabase
    .from("travel_group_participants" as any)
    .insert({
      group_id: groupId,
      first_name: cleanText(formData, "first_name"),
      last_name: cleanText(formData, "last_name"),
      email: cleanText(formData, "email"),
      phone: cleanText(formData, "phone"),
      party_size: toInteger(formData.get("party_size"), 1) ?? 1,
      status: cleanText(formData, "status") ?? "interested",
      deposit_paid: formData.get("deposit_paid") === "on",
      paid_in_full: formData.get("paid_in_full") === "on",
      notes: cleanText(formData, "notes"),
    });

  if (error) throw new Error(error.message);

  revalidateGroup(groupId, slug);
}

async function updateParticipant(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const participantId = String(formData.get("participant_id") ?? "").trim();
  const slug = cleanText(formData, "group_slug");

  if (!groupId || !participantId) throw new Error("Missing participant details.");

  const { error } = await supabase
    .from("travel_group_participants" as any)
    .update({
      status: cleanText(formData, "status") ?? "interested",
      party_size: toInteger(formData.get("party_size"), 1) ?? 1,
      deposit_paid: formData.get("deposit_paid") === "on",
      paid_in_full: formData.get("paid_in_full") === "on",
      notes: cleanText(formData, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", participantId)
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);

  revalidateGroup(groupId, slug);
}

async function removeParticipant(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const participantId = String(formData.get("participant_id") ?? "").trim();
  const slug = cleanText(formData, "group_slug");

  if (!groupId || !participantId) throw new Error("Missing participant details.");

  const { error } = await supabase
    .from("travel_group_participants" as any)
    .delete()
    .eq("id", participantId)
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);

  revalidateGroup(groupId, slug);
}

export default async function AdminGroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { groupId } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const [groupResult, participantsResult] = await Promise.all([
    supabase
      .from("travel_groups" as any)
      .select("*")
      .eq("id", groupId)
      .single(),
    supabase
      .from("travel_group_participants" as any)
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  if (groupResult.error || !groupResult.data) {
    return (
      <PageShell title="Group Not Found" subtitle="We could not load this group.">
        <div className="card">
          <p><strong>Error:</strong></p>
          <pre>{JSON.stringify(groupResult.error, null, 2)}</pre>
          <Link href="/admin/groups" className="btn btn-primary">Back to Groups</Link>
        </div>
      </PageShell>
    );
  }

  const group = groupResult.data as TravelGroupRow;
  const participants = (participantsResult.data ?? []) as ParticipantRow[];
  const partyTotal = participants.reduce((sum, participant) => sum + Number(participant.party_size ?? 1), 0);
  const depositPaidCount = participants.filter((participant) => participant.deposit_paid).length;
  const paidInFullCount = participants.filter((participant) => participant.paid_in_full).length;

  return (
    <PageShell title={group.group_name} subtitle="Manage the group landing page, registration details, and participants.">
      <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/admin/groups" className="btn btn-outline">Back to Groups</Link>
          <Link href={`/groups/${group.slug}`} className="btn btn-primary">View Landing Page</Link>
        </div>
        <code style={{ padding: "8px 12px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e6f0f2" }}>
          /groups/{group.slug}
        </code>
      </div>

      {saved === "1" ? (
        <div className="card" style={{ border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#027a48" }}>
          <strong>Group saved.</strong>
        </div>
      ) : null}

      <div className="grid grid-4">
        <div className="card"><span className="label">People Tracking</span><p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>{partyTotal}</p></div>
        <div className="card"><span className="label">Participant Records</span><p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>{participants.length}</p></div>
        <div className="card"><span className="label">Deposit Paid</span><p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>{depositPaidCount}</p></div>
        <div className="card"><span className="label">Paid in Full</span><p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900 }}>{paidInFullCount}</p></div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Group Setup</h2>
        <form action={updateTravelGroup} className="stack">
          <input type="hidden" name="group_id" value={group.id} />
          <div className="grid grid-3">
            <label className="stack-sm"><span className="label">Group Name</span><input className="input" name="group_name" defaultValue={group.group_name} required /></label>
            <label className="stack-sm"><span className="label">Slug</span><input className="input" name="slug" defaultValue={group.slug} required /></label>
            <label className="stack-sm"><span className="label">Destination</span><input className="input" name="destination" defaultValue={group.destination ?? ""} /></label>
          </div>

          <div className="grid grid-4">
            <label className="stack-sm"><span className="label">Group Type</span><input className="input" name="group_type" defaultValue={group.group_type ?? ""} /></label>
            <label className="stack-sm"><span className="label">Status</span><select className="select" name="status" defaultValue={group.status}><option value="planning">planning</option><option value="open">open</option><option value="closed">closed</option><option value="archived">archived</option></select></label>
            <label className="stack-sm"><span className="label">Visibility</span><select className="select" name="visibility" defaultValue={group.visibility}><option value="public">public</option><option value="private">private</option></select></label>
            <label className="stack-sm"><span className="label">Max Participants</span><input className="input" type="number" name="max_participants" defaultValue={group.max_participants ?? ""} /></label>
          </div>

          <div className="grid grid-4">
            <label className="stack-sm"><span className="label">Start Date</span><input className="input" type="date" name="start_date" defaultValue={group.start_date ?? ""} /></label>
            <label className="stack-sm"><span className="label">End Date</span><input className="input" type="date" name="end_date" defaultValue={group.end_date ?? ""} /></label>
            <label className="stack-sm"><span className="label">Registration Deadline</span><input className="input" type="date" name="registration_deadline" defaultValue={group.registration_deadline ?? ""} /></label>
            <label className="stack-sm"><span className="label">Deposit Deadline</span><input className="input" type="date" name="deposit_deadline" defaultValue={group.deposit_deadline ?? ""} /></label>
          </div>

          <div className="grid grid-3">
            <label className="stack-sm"><span className="label">Starting Price</span><input className="input" type="number" step="0.01" name="starting_price" defaultValue={group.starting_price ?? ""} /></label>
            <label className="stack-sm"><span className="label">Deposit Amount</span><input className="input" type="number" step="0.01" name="deposit_amount" defaultValue={group.deposit_amount ?? ""} /></label>
            <label className="stack-sm"><span className="label">Hero Image URL</span><input className="input" name="hero_image_url" defaultValue={group.hero_image_url ?? ""} /></label>
          </div>

          <label className="stack-sm"><span className="label">Overview</span><textarea className="textarea" name="overview" rows={5} defaultValue={group.overview ?? ""} /></label>
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">What&apos;s Included</span><textarea className="textarea" name="included" rows={4} defaultValue={group.included ?? ""} /></label>
            <label className="stack-sm"><span className="label">What&apos;s Not Included</span><textarea className="textarea" name="not_included" rows={4} defaultValue={group.not_included ?? ""} /></label>
          </div>
          <label className="stack-sm"><span className="label">Internal Notes</span><textarea className="textarea" name="notes" rows={4} defaultValue={group.notes ?? ""} /></label>
          <button className="btn btn-primary" type="submit">Save Group</button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Add Person to Group</h2>
        <form action={addParticipant} className="stack">
          <input type="hidden" name="group_id" value={group.id} />
          <input type="hidden" name="group_slug" value={group.slug} />
          <div className="grid grid-4">
            <label className="stack-sm"><span className="label">First Name</span><input className="input" name="first_name" /></label>
            <label className="stack-sm"><span className="label">Last Name</span><input className="input" name="last_name" /></label>
            <label className="stack-sm"><span className="label">Email</span><input className="input" type="email" name="email" /></label>
            <label className="stack-sm"><span className="label">Phone</span><input className="input" name="phone" /></label>
          </div>
          <div className="grid grid-3">
            <label className="stack-sm"><span className="label">Party Size</span><input className="input" type="number" min="1" name="party_size" defaultValue={1} /></label>
            <label className="stack-sm"><span className="label">Status</span><select className="select" name="status" defaultValue="interested">{participantStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="stack-sm"><span className="label">Notes</span><input className="input" name="notes" /></label>
          </div>
          <div className="row">
            <label className="row" style={{ gap: 8 }}><input type="checkbox" name="deposit_paid" /> Deposit paid</label>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" name="paid_in_full" /> Paid in full</label>
          </div>
          <button className="btn btn-primary" type="submit">Add Participant</button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Participants</h2>
        {participants.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No people have been added to this group yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {participants.map((participant) => (
              <div key={participant.id} style={{ padding: 14, border: "1px solid #e6f0f2", borderRadius: 14, background: "#ffffff", display: "grid", gap: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{participantName(participant)}</strong>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                      {participant.email ?? "No email"} {participant.phone ? `- ${participant.phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={participant.status} />
                </div>

                <form action={updateParticipant} className="grid grid-4" style={{ alignItems: "end" }}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="group_slug" value={group.slug} />
                  <input type="hidden" name="participant_id" value={participant.id} />
                  <label className="stack-sm"><span className="label">Status</span><select className="select" name="status" defaultValue={participant.status}>{participantStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="stack-sm"><span className="label">Party Size</span><input className="input" type="number" min="1" name="party_size" defaultValue={participant.party_size ?? 1} /></label>
                  <label className="stack-sm"><span className="label">Notes</span><input className="input" name="notes" defaultValue={participant.notes ?? ""} /></label>
                  <div className="stack-sm">
                    <label className="row" style={{ gap: 8 }}><input type="checkbox" name="deposit_paid" defaultChecked={participant.deposit_paid === true} /> Deposit</label>
                    <label className="row" style={{ gap: 8 }}><input type="checkbox" name="paid_in_full" defaultChecked={participant.paid_in_full === true} /> Paid full</label>
                  </div>
                  <button className="btn btn-primary" type="submit">Save Person</button>
                </form>
                <form action={removeParticipant}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="group_slug" value={group.slug} />
                  <input type="hidden" name="participant_id" value={participant.id} />
                  <button type="submit" className="btn btn-outline" style={{ color: "#be123c", borderColor: "#fecaca" }}>Remove Person</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          Dates: {formatDate(group.start_date)} - {formatDate(group.end_date)}. Starting at {formatMoney(group.starting_price)} with deposit {formatMoney(group.deposit_amount)} due {formatDate(group.deposit_deadline)}.
        </p>
      </div>
    </PageShell>
  );
}
