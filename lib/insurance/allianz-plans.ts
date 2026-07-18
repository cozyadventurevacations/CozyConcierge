export type AllianzInsurancePlan = {
  optionNumber: number;
  providerName: string;
  planName: string;
  brochureUrl: string;
  coverageSummary: string;
};

export const allianzInsurancePlans: AllianzInsurancePlan[] = [
  {
    optionNumber: 1,
    providerName: "Allianz Travel Insurance",
    planName: "Journey Plan",
    brochureUrl: "/insurance/allianz/allianz-journey-plan.pdf",
    coverageSummary:
      "Includes trip cancellation up to 100% of insured trip cost, trip interruption up to 150%, Trip Change Protector up to $500, travel delay up to $1,000, emergency medical and dental up to $50,000, emergency transportation up to $500,000, baggage loss/damage up to $1,000, and baggage delay up to $300. See flyer for complete terms, conditions, and exclusions.",
  },
  {
    optionNumber: 2,
    providerName: "Allianz Travel Insurance",
    planName: "Latitude Plan",
    brochureUrl: "/insurance/allianz/allianz-latitude-plan.pdf",
    coverageSummary:
      "Includes trip cancellation up to 100% of insured trip cost, trip interruption up to 150%, Trip Change Protector up to $1,000, travel delay up to $2,000, emergency medical and dental up to $100,000, emergency transportation up to $1,000,000, baggage loss/damage up to $2,000, and baggage delay up to $600. See flyer for complete terms, conditions, and exclusions.",
  },
  {
    optionNumber: 3,
    providerName: "Allianz Travel Insurance",
    planName: "Classic Plan with Cancel Anytime",
    brochureUrl: "/insurance/allianz/allianz-classic-cancel-anytime-plan.pdf",
    coverageSummary:
      "Includes trip cancellation up to 100% of insured trip cost, Cancel Anytime reimbursement of 80% of lost non-refundable trip costs for almost any unforeseeable reason not otherwise covered, trip interruption up to 100%, Trip Change Protector up to $500, travel delay up to $800, emergency medical and dental up to $50,000, emergency transportation up to $500,000, baggage loss/damage up to $1,000, and baggage delay up to $300. See flyer for complete terms, conditions, and exclusions.",
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
