import { getAllianzInsurancePlan, getInsurancePlanBrochureUrl } from "./allianz-plans";

export type InsuranceQuoteOption = {
  optionNumber: number;
  providerName: string | null;
  planName: string | null;
  premiumAmount: number | null;
  coverageDescription: string | null;
  brochureUrl: string | null;
};
type InsuranceDetails = {
  quote_options?: unknown;
  selected_option_number?: number | null;
  provider_name?: string | null;
  plan_name?: string | null;
  premium_amount?: number | string | null;
  coverage_description?: string | null;
};
const bookedStatuses = new Set(["reserved", "confirmed", "pending_final_payment", "paid_in_full", "travel_complete"]);
export function isInsuranceBooked(status: string | null | undefined) {
  return bookedStatuses.has(String(status ?? "").trim());
}
function premium(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}
export function getInsuranceQuoteOptions(details: InsuranceDetails | null | undefined): InsuranceQuoteOption[] {
  const options = Array.isArray(details?.quote_options) ? details.quote_options : [];
  const mapped: InsuranceQuoteOption[] = options.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const option = value as Record<string, unknown>;
    const optionNumber = Number(option.option_number);
    const standard = getAllianzInsurancePlan(optionNumber);
    if (!standard) return [];
    return [{ optionNumber,
      providerName: typeof option.provider_name === "string" ? option.provider_name : standard.providerName,
      planName: typeof option.plan_name === "string" ? option.plan_name : standard.planName,
      premiumAmount: premium(option.premium_amount),
      coverageDescription: typeof option.coverage_description === "string" ? option.coverage_description : standard.coverageSummary,
      brochureUrl: getInsurancePlanBrochureUrl(optionNumber, standard.planName),
    }];
  });
  if (mapped.length) return mapped;
  if (!details || !(details.provider_name || details.plan_name || details.premium_amount != null || details.coverage_description)) return [];
  // Preserve existing single-plan components without inventing a plan or coverage.
  const knownPlan = [1, 2, 3].map(getAllianzInsurancePlan).find((plan) => plan?.planName === details.plan_name);
  return [{ optionNumber: knownPlan?.optionNumber ?? 1, providerName: details.provider_name ?? null,
    planName: details.plan_name ?? null, premiumAmount: premium(details.premium_amount),
    coverageDescription: details.coverage_description ?? null,
    brochureUrl: knownPlan?.brochureUrl ?? null }];
}
export function getSelectedInsuranceOptionNumber(details: InsuranceDetails | null | undefined, status?: string | null): number | null {
  const explicit = Number(details?.selected_option_number);
  if ([1, 2, 3].includes(explicit)) return explicit;
  if (!isInsuranceBooked(status)) return null;
  const matching = getInsuranceQuoteOptions(details).filter((option) => option.planName === details?.plan_name);
  return matching.length === 1 ? matching[0].optionNumber : null;
}
export function getVisibleInsuranceQuoteOptions(details: InsuranceDetails | null | undefined, status?: string | null) {
  const options = getInsuranceQuoteOptions(details);
  const selected = getSelectedInsuranceOptionNumber(details, status);
  return selected ? options.filter((option) => option.optionNumber === selected) : options;
}
export function getInsuranceSelectionPayload(options: InsuranceQuoteOption[], selected: number | null, status: string) {
  if (selected !== null && ![1, 2, 3].includes(selected)) throw new Error("Choose a valid insurance plan.");
  const option = selected === null ? null : options.find((quote) => quote.optionNumber === selected);
  if (selected !== null && (!option || option.premiumAmount === null)) throw new Error("Enter a valid premium for the selected insurance plan.");
  if (isInsuranceBooked(status) && !option) throw new Error("Select an insurance plan before marking insurance reserved or confirmed.");
  return { option, totalPrice: isInsuranceBooked(status) ? option?.premiumAmount ?? 0 : 0 };
}
