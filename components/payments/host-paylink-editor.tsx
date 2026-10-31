"use client";

import { useActionState } from "react";
import { saveHostPaylink, removeHostPaylink } from "@/lib/payment-links/actions";

type Props = {
  tripId?: string;
  requestId?: string;
  url?: string | null;
  status?: string;
  defaultAmount?: number | null;
  defaultDate?: string | null;
};

export function HostPaylinkEditor({ tripId, requestId, url, status, defaultAmount, defaultDate }: Props) {
  const [state, action, pending] = useActionState(saveHostPaylink, {});
  const [removeState, removeAction, removing] = useActionState(removeHostPaylink, {});
  const closed = Boolean(requestId && status && !["new", "sent"].includes(status));
  return <div className="card stack">
    <h2 style={{ margin: 0 }}>Host Agency Paylink</h2>
    <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
      Paste the complete HTTPS link provided by your host agency. Saving shares it with this trip&apos;s main client in Cozy Concierge. Card details are entered on the host&apos;s website.
    </p>
    {closed ? <p>Reopen this payment request to share a replacement link. Closed requests do not show an active paylink to the client.</p> : null}
    <form action={action} className="stack">
      {requestId ? <input type="hidden" name="request_id" value={requestId} /> : <input type="hidden" name="trip_id" value={tripId} />}
      {!requestId ? <div className="grid grid-2">
        <label className="stack-sm"><span className="label">Requested Amount</span><input className="input" name="requested_amount" type="number" min="0.01" max="9999999999.99" step="0.01" defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount : ""} required /></label>
        <label className="stack-sm"><span className="label">Requested Payment Date</span><input className="input" name="requested_payment_date" type="date" defaultValue={defaultDate ?? ""} required /></label>
      </div> : null}
      <label className="stack-sm"><span className="label">Host Paylink URL</span><input className="input" name="payment_link_url" type="url" inputMode="url" placeholder="https://your-hosts-payment-website/..." maxLength={8192} defaultValue={url ?? ""} disabled={closed} autoComplete="off" spellCheck={false} required /></label>
      {state.error ? <p role="alert" style={{ color: "#b42318", margin: 0 }}>{state.error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending || removing || closed}>{pending ? "Saving…" : "Save & Share Paylink"}</button>
    </form>
    {requestId && url ? <form action={removeAction} className="stack-sm">
      <input type="hidden" name="request_id" value={requestId} />
      {removeState.error ? <p role="alert" style={{ color: "#b42318", margin: 0 }}>{removeState.error}</p> : null}
      <button type="submit" className="btn btn-outline" disabled={pending || removing}>{removing ? "Removing…" : "Remove Paylink"}</button>
    </form> : null}
    <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.5 }}>Sharing a link does not send an email or record a payment. Mark the request completed only after confirming payment with your host.</p>
  </div>;
}
