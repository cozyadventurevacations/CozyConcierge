import { availableHostPaylink, type HostPaylinkRequest } from "@/lib/payment-links";

export function HostPaymentLinks({ requests }: { requests: HostPaylinkRequest[] }) {
  const available = requests.flatMap((request) => {
    const url = availableHostPaylink(request);
    return url ? [{ request, url }] : [];
  });
  if (!available.length) return null;
  const money = (amount: number | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount ?? 0));
  const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return <section className="card stack" aria-label="Your Payment Links" style={{ background: "#f7fbfc", border: "1px solid #d9ecf2" }}>
    <h2 style={{ margin: 0 }}>Your Payment Links</h2>
    <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>Open the payment page provided by your advisor to submit your card details. It opens in a new tab. Your advisor will confirm payment before your trip balance is updated.</p>
    {available.map(({ request, url }) => <div key={request.id} className="card stack-sm">
      <strong>Requested payment: {money(request.requested_amount)}</strong>
      {request.requested_payment_date ? <span>Payment date: {date(request.requested_payment_date)}</span> : null}
      <span style={{ overflowWrap: "anywhere" }}>Payment website: {new URL(url).hostname}</span>
      <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open Secure Paylink</a>
    </div>)}
    <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>If a link has expired or does not open, message your advisor for a replacement.</p>
  </section>;
}
