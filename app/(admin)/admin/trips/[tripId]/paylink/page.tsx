import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { HostPaylinkEditor } from "@/components/payments/host-paylink-editor";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AddTripPaylinkPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { supabase } = await requireAdmin();
  const { data: trip, error } = await supabase.from("trips")
    .select("id,trip_name,balance_due,final_payment_due_date,deleted_at").eq("id", tripId).single();
  if (error || !trip || trip.deleted_at) notFound();
  return <PageShell title="Add Host Paylink" subtitle={`Share a host-provided payment link for ${trip.trip_name || "this trip"}.`}>
    <Link className="btn btn-outline" href={`/admin/trips/${trip.id}#trip-payments`}>Back to Trip Payments</Link>
    <HostPaylinkEditor tripId={trip.id} defaultAmount={trip.balance_due} defaultDate={trip.final_payment_due_date ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" })} />
  </PageShell>;
}
