"use client";

import Link from "next/link";
import { useState } from "react";
import type { TripPackageRecord } from "@/lib/trip-pricing";

type Supplier = { id: string; supplier_name: string };
type EditablePackage = { id: string; display_name: string; supplier_id: string; confirmation_number: string; booking_status: string; total_price: string; deposit_amount: string; deposit_due_date: string; final_payment_due_date: string; commission_admin_only: string };

export function PackagePricingEditor({ packages, suppliers, memberCounts, tripId }: {
  packages: TripPackageRecord[]; suppliers: Supplier[]; memberCounts: Record<string, number>; tripId: string;
}) {
  const [rows, setRows] = useState<EditablePackage[]>(() => packages.map((item) => ({
    id: item.id, display_name: item.display_name ?? "", supplier_id: item.supplier_id ?? "", confirmation_number: item.confirmation_number ?? "",
    booking_status: item.booking_status ?? "quoted", total_price: String(item.total_price ?? ""), deposit_amount: String(item.deposit_amount ?? ""),
    deposit_due_date: item.deposit_due_date ?? "", final_payment_due_date: item.final_payment_due_date ?? "", commission_admin_only: String(item.commission_admin_only ?? ""),
  })));
  function update(id: string, field: keyof EditablePackage, value: string) { setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row)); }
  return (
    <div className="card stack" style={{ background: "#f7fbfc", border: "1px solid #d9ecf2" }}>
      <h3 style={{ margin: 0 }}>Packages / Bundles</h3>
      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>Enter one total for each supplier package. Save Trip Overview, then check “Part of a package” in each included component. Included components keep their itinerary details and do not add a second charge.</p>
      <input type="hidden" name="trip_packages_json" value={JSON.stringify(rows)} />
      {rows.map((row, index) => (
        <div className="card stack" key={row.id}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <h4 style={{ margin: 0 }}>Package {index + 1}: {row.display_name || "New package"}</h4>
            <button type="button" className="btn btn-outline" disabled={Boolean(memberCounts[row.id])} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove package</button>
          </div>
          {memberCounts[row.id] ? <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>{memberCounts[row.id]} component(s) included. To remove this package, first uncheck and save those components.</p> : null}
          <div className="grid grid-2">
            <label className="stack-sm"><span className="label">Package name</span><input className="input" maxLength={200} value={row.display_name} onChange={(event) => update(row.id, "display_name", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package supplier</span><select className="select" value={row.supplier_id} onChange={(event) => update(row.id, "supplier_id", event.target.value)}><option value="">No supplier selected</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}</select></label>
            <label className="stack-sm"><span className="label">Package total price</span><input className="input" type="number" min="0" step="0.01" value={row.total_price} onChange={(event) => update(row.id, "total_price", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package booking number</span><input className="input" maxLength={100} value={row.confirmation_number} onChange={(event) => update(row.id, "confirmation_number", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package booking status</span><select className="select" value={row.booking_status} onChange={(event) => update(row.id, "booking_status", event.target.value)}>{["quoted", "on_hold", "reserved"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="stack-sm"><span className="label">Package deposit amount</span><input className="input" type="number" min="0" step="0.01" value={row.deposit_amount} onChange={(event) => update(row.id, "deposit_amount", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package deposit due date</span><input className="input" type="date" value={row.deposit_due_date} onChange={(event) => update(row.id, "deposit_due_date", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package final payment due date</span><input className="input" type="date" value={row.final_payment_due_date} onChange={(event) => update(row.id, "final_payment_due_date", event.target.value)} /></label>
            <label className="stack-sm"><span className="label">Package commission amount (advisor only)</span><input className="input" type="number" min="0" step="0.01" value={row.commission_admin_only} onChange={(event) => update(row.id, "commission_admin_only", event.target.value)} /></label>
          </div>
          {packages.some((item) => item.id === row.id) ? <Link className="btn btn-outline" href={`/admin/commissions/new?${new URLSearchParams({ tripId, componentId: row.id, supplierId: row.supplier_id, commissionName: `${row.display_name} Commission`, grossBookingAmount: row.total_price, fullCommissionAmount: row.commission_admin_only, bookingNumber: row.confirmation_number })}`}>Track package commission</Link> : null}
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), display_name: `Package ${current.length + 1}`, supplier_id: "", confirmation_number: "", booking_status: "quoted", total_price: "", deposit_amount: "", deposit_due_date: "", final_payment_due_date: "", commission_admin_only: "" }])}>Add package / bundle</button>
    </div>
  );
}

export function ComponentPackageControl({ componentType, packages, defaultPackageId }: { componentType: string; packages: TripPackageRecord[]; defaultPackageId?: string | null }) {
  const [included, setIncluded] = useState(Boolean(defaultPackageId));
  return (
    <div className="card stack-sm" style={{ background: "#f7fbfc", border: "1px solid #d9ecf2" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" name={`${componentType}_included_in_package`} checked={included} disabled={!packages.length} onChange={(event) => setIncluded(event.target.checked)} /><strong>Part of a package</strong></label>
      {!packages.length ? <span style={{ color: "#667085", fontSize: 13 }}>Create and save a package under Trip Overview first.</span> : null}
      {included ? <>
        <label className="stack-sm"><span className="label">Included in package</span><select className="select" name={`${componentType}_package_id`} defaultValue={defaultPackageId || packages[0]?.id} required>{packages.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
        <span style={{ color: "#667085", fontSize: 13 }}>This component&apos;s price is excluded from trip totals. Its entered amount is retained for reference. Track commission on the package unless the supplier pays it separately.</span>
      </> : null}
    </div>
  );
}
