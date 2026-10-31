"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { normalizeHostPaylink, validateHostPaylinkDetails } from "@/lib/payment-links";

export type PaylinkActionState = { error?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshPaylinkPages(tripId: string, requestId: string) {
  revalidatePath("/admin/payment-requests");
  revalidatePath(`/admin/payment-requests/${requestId}`);
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/request-payment`);
}

export async function saveHostPaylink(_previous: PaylinkActionState, formData: FormData): Promise<PaylinkActionState> {
  const { supabase } = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "").trim();
  let paymentLink: string;
  try { paymentLink = normalizeHostPaylink(String(formData.get("payment_link_url") ?? "")); }
  catch (error) { return { error: (error as Error).message }; }

  if (requestId) {
    if (!uuid.test(requestId)) return { error: "Payment request not found." };
    const { data: request, error } = await supabase.from("payment_requests")
      .select("id,trip_id,status").eq("id", requestId).single();
    if (error || !request) return { error: "Payment request not found." };
    if (!["new", "sent"].includes(request.status)) return { error: "Reopen this request before sharing a new paylink." };
    const { data: saved, error: saveError } = await supabase.from("payment_requests")
      .update({ payment_link_url: paymentLink, status: "sent" })
      .eq("id", requestId).eq("status", request.status).select("id").single();
    if (saveError || !saved) return { error: "The paylink could not be saved. Reload the request and try again." };
    refreshPaylinkPages(request.trip_id, requestId);
    redirect(`/admin/payment-requests/${requestId}?paylink=saved`);
  }

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (!uuid.test(tripId)) return { error: "Trip not found." };
  let details: ReturnType<typeof validateHostPaylinkDetails>;
  try { details = validateHostPaylinkDetails(String(formData.get("requested_amount") ?? "").trim(), String(formData.get("requested_payment_date") ?? "").trim()); }
  catch (error) { return { error: (error as Error).message }; }
  const { data: trip, error: tripError } = await supabase.from("trips")
    .select("id,client_account_id,deleted_at").eq("id", tripId).single();
  if (tripError || !trip || trip.deleted_at) return { error: "Trip not found or no longer available." };
  const { data: saved, error: saveError } = await supabase.from("payment_requests").insert({
    trip_id: trip.id, client_account_id: trip.client_account_id, ...details,
    payment_link_url: paymentLink, status: "sent",
  }).select("id").single();
  if (saveError || !saved) return { error: "The paylink could not be saved. Please try again." };
  refreshPaylinkPages(tripId, saved.id);
  redirect(`/admin/payment-requests/${saved.id}?paylink=saved`);
}

export async function removeHostPaylink(_previous: PaylinkActionState, formData: FormData): Promise<PaylinkActionState> {
  const { supabase } = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!uuid.test(requestId)) return { error: "Payment request not found." };
  const { data: request, error } = await supabase.from("payment_requests")
    .select("id,trip_id,status").eq("id", requestId).single();
  if (error || !request) return { error: "Payment request not found." };
  const { data: saved, error: saveError } = await supabase.from("payment_requests")
    .update({ payment_link_url: null, ...(request.status === "sent" ? { status: "new" } : {}) })
    .eq("id", requestId).eq("status", request.status).select("id").single();
  if (saveError || !saved) return { error: "The paylink could not be removed. Reload the request and try again." };
  refreshPaylinkPages(request.trip_id, requestId);
  redirect(`/admin/payment-requests/${requestId}?paylink=removed`);
}
