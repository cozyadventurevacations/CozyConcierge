export type PricedTripComponent = {
  id?: string;
  component_type?: string;
  total_price?: number | string | null;
  package_id?: string | null;
};

// Package members keep their reference prices, but only the package is billable.
export function sumBillableComponents(components: readonly (PricedTripComponent | null | undefined)[]) {
  const cents = components.reduce((sum, component) => {
    if (!component || component.package_id) return sum;
    const amount = Number(component.total_price ?? 0);
    if (!Number.isFinite(amount)) throw new Error("A trip component has an invalid price.");
    return sum + Math.round(amount * 100);
  }, 0);
  return cents / 100;
}

export type TripPackageRecord = {
  id: string;
  display_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  confirmation_number: string | null;
  booking_status: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  final_payment_due_date: string | null;
  commission_admin_only: number | null;
};

export function includedPackageName(component: { package_id?: string | null } | null | undefined, packages: readonly TripPackageRecord[]) {
  if (!component?.package_id) return null;
  return packages.find((item) => item.id === component.package_id)?.display_name || "your package";
}
