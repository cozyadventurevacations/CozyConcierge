export type AllianzInsurancePlan = {
  optionNumber: number;
  providerName: string;
  planName: string;
  brochureUrl: string;
};

export const allianzInsurancePlans: AllianzInsurancePlan[] = [
  {
    optionNumber: 1,
    providerName: "Allianz Travel Insurance",
    planName: "Journey Plan",
    brochureUrl: "/insurance/allianz/allianz-journey-plan.pdf",
  },
  {
    optionNumber: 2,
    providerName: "Allianz Travel Insurance",
    planName: "Latitude Plan",
    brochureUrl: "/insurance/allianz/allianz-latitude-plan.pdf",
  },
  {
    optionNumber: 3,
    providerName: "Allianz Travel Insurance",
    planName: "Classic Plan with Cancel Anytime",
    brochureUrl: "/insurance/allianz/allianz-classic-cancel-anytime-plan.pdf",
  },
];

export function getAllianzInsurancePlan(optionNumber: number) {
  return allianzInsurancePlans.find((plan) => plan.optionNumber === optionNumber) ?? null;
}

export function getInsurancePlanBrochureUrl(
  optionNumber: number | null | undefined,
  planName: string | null | undefined,
) {
  const standardPlan = optionNumber ? getAllianzInsurancePlan(Number(optionNumber)) : null;
  if (standardPlan) return standardPlan.brochureUrl;

  const normalizedPlanName = String(planName ?? "").toLowerCase();
  if (normalizedPlanName.includes("journey")) return allianzInsurancePlans[0].brochureUrl;
  if (normalizedPlanName.includes("latitude")) return allianzInsurancePlans[1].brochureUrl;
  if (normalizedPlanName.includes("classic")) return allianzInsurancePlans[2].brochureUrl;

  return null;
}
