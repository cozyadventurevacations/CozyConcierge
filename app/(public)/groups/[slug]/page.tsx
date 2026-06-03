import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
};

function cleanText(formData: FormData, fieldName: string) {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || null;
}

function toInteger(value: FormDataEntryValue | null, fallback = 1) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(1, Math.round(number)) : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "To be announced";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "To be announced";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function splitLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function requestGroupSpot(formData: FormData) {
  "use server";

  const supabase = await createServerSupabaseClient();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const groupSlug = String(formData.get("group_slug") ?? "").trim();
  const firstName = cleanText(formData, "first_name");
  const lastName = cleanText(formData, "last_name");
  const email = cleanText(formData, "email");

  if (!groupId || !groupSlug) throw new Error("Missing group details.");
  if (!firstName || !lastName || !email) {
    throw new Error("First name, last name, and email are required.");
  }

  const { error } = await supabase
    .from("travel_group_participants" as any)
    .insert({
      group_id: groupId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: cleanText(formData, "phone"),
      party_size: toInteger(formData.get("party_size")),
      status: "interested",
      notes: cleanText(formData, "notes"),
    });

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupSlug}`);
  redirect(`/groups/${groupSlug}?requested=1`);
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "#ffffff", border: "1px solid #e6f0f2" }}>
      <span className="label">{label}</span>
      <p style={{ margin: "8px 0 0", fontWeight: 900, color: "var(--accent-dark)" }}>{value}</p>
    </div>
  );
}

export default async function PublicGroupLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ requested?: string }>;
}) {
  const { slug } = await params;
  const { requested } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("travel_groups" as any)
    .select("*")
    .eq("slug", slug)
    .eq("visibility", "public")
    .neq("status", "archived")
    .single();

  if (error || !data) {
    return (
      <PageShell title="Group Not Found" subtitle="This group landing page is not available.">
        <div className="card stack">
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            The group may be private, archived, or the link may have changed.
          </p>
          <Link href="/travel-request" className="btn btn-primary">Request Travel Help</Link>
        </div>
      </PageShell>
    );
  }

  const group = data as TravelGroupRow;
  const included = splitLines(group.included);
  const notIncluded = splitLines(group.not_included);

  return (
    <main style={{ minHeight: "100vh", background: "#f7fafb" }}>
      <section
        style={{
          minHeight: "62vh",
          display: "grid",
          alignItems: "end",
          padding: "32px 24px",
          background: group.hero_image_url
            ? `linear-gradient(180deg, rgba(18,63,91,0.25), rgba(18,63,91,0.82)), url(${group.hero_image_url}) center/cover`
            : "linear-gradient(135deg, #d9ecf2 0%, #ffffff 52%, #eef7f8 100%)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto", color: group.hero_image_url ? "#ffffff" : "var(--accent-dark)" }}>
          {!group.hero_image_url ? (
            <Image src="/cozy-logo.png" alt="Cozy Adventure Vacations" width={180} height={90} priority />
          ) : null}
          <p style={{ margin: "12px 0 0", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 900 }}>
            Cozy Adventure Vacations Group Travel
          </p>
          <h1 style={{ margin: "10px 0 0", maxWidth: 840, fontSize: "clamp(2rem, 5vw, 4.5rem)", lineHeight: 1.02 }}>
            {group.group_name}
          </h1>
          <p style={{ margin: "14px 0 0", maxWidth: 680, fontSize: 18, lineHeight: 1.6 }}>
            {group.destination ?? "A curated group travel experience"}
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 56px", display: "grid", gap: 18 }}>
        {requested === "1" ? (
          <div className="card" style={{ border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#027a48" }}>
            <strong>We received your group travel request.</strong> Jeremy will follow up with next steps.
          </div>
        ) : null}

        <div className="grid grid-4">
          <DetailCard label="Travel Dates" value={`${formatDate(group.start_date)} - ${formatDate(group.end_date)}`} />
          <DetailCard label="Starting At" value={formatMoney(group.starting_price)} />
          <DetailCard label="Deposit" value={formatMoney(group.deposit_amount)} />
          <DetailCard label="Deposit Deadline" value={formatDate(group.deposit_deadline)} />
        </div>

        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>About This Group</h2>
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {group.overview || "Details are being finalized. Submit the form and we will follow up with the current group information."}
            </p>

            {included.length > 0 ? (
              <div>
                <h3>What&apos;s Included</h3>
                <ul style={{ lineHeight: 1.8 }}>{included.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}

            {notIncluded.length > 0 ? (
              <div>
                <h3>Not Included</h3>
                <ul style={{ lineHeight: 1.8 }}>{notIncluded.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
          </div>

          <div className="card stack" style={{ border: "1px solid #d9ecf2", background: "#ffffff" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>Join the interest list</p>
              <h2 style={{ margin: "6px 0 0" }}>Request Group Details</h2>
              <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.6 }}>
                Send your information and Cozy Adventure Vacations will help with availability, registration, and next steps.
              </p>
            </div>

            <form action={requestGroupSpot} className="stack">
              <input type="hidden" name="group_id" value={group.id} />
              <input type="hidden" name="group_slug" value={group.slug} />
              <div className="grid grid-2">
                <label className="stack-sm"><span className="label">First Name</span><input className="input" name="first_name" required /></label>
                <label className="stack-sm"><span className="label">Last Name</span><input className="input" name="last_name" required /></label>
              </div>
              <label className="stack-sm"><span className="label">Email</span><input className="input" type="email" name="email" required /></label>
              <label className="stack-sm"><span className="label">Phone</span><input className="input" name="phone" /></label>
              <label className="stack-sm"><span className="label">How many travelers?</span><input className="input" type="number" min="1" name="party_size" defaultValue={1} /></label>
              <label className="stack-sm"><span className="label">Questions or notes</span><textarea className="textarea" name="notes" rows={4} /></label>
              <button className="btn btn-primary" type="submit">Request Group Information</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
