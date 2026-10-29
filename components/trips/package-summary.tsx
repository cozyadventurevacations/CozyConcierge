import type { TripPackageRecord } from "@/lib/trip-pricing";

export function PackageSummary({ packages, members }: { packages: TripPackageRecord[]; members: { component_type?: string; package_id?: string | null }[] }) {
  if (!packages.length) return null;
  const money = (value: number | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
  const labels: Record<string, string> = { hotel: "Hotel", air: "Flights", cruise: "Cruise", transfer: "Transfers", rental_car: "Rental car", activity: "Activities", insurance: "Insurance" };
  const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return <div className="card stack">
    <h2 style={{ margin: 0 }}>Packages / Bundles</h2>
    {packages.map((item) => <div key={item.id} className="card stack-sm" style={{ background: "#f7fbfc" }}>
      <h3 style={{ margin: 0 }}>{item.display_name || "Vacation package"}</h3>
      <strong>Package total: {money(item.total_price)}</strong>
      {item.supplier_name ? <span>Supplier: {item.supplier_name}</span> : null}
      {item.confirmation_number ? <span>Booking number: {item.confirmation_number}</span> : null}
      <span>Status: {item.booking_status}</span>
      {members.some((member) => member.package_id === item.id) ? <span>Includes: {members.filter((member) => member.package_id === item.id).map((member) => labels[member.component_type ?? ""] || member.component_type).join(", ")}</span> : null}
      {item.deposit_amount !== null ? <span>Deposit: {money(item.deposit_amount)}</span> : null}
      {item.deposit_due_date ? <span>Deposit due: {date(item.deposit_due_date)}</span> : null}
      {item.final_payment_due_date ? <span>Final payment due: {date(item.final_payment_due_date)}</span> : null}
    </div>)}
  </div>;
}
