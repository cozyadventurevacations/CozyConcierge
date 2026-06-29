export type EmailAutomationType =
  | "final_payment_10_day"
  | "pre_travel_30_day"
  | "pre_travel_7_day"
  | "post_travel_7_day"
  | "post_travel_60_day"
  | "birthday"
  | "anniversary"
  | "passport_expiry_6mo";

export type EmailAutomationTemplate = {
  template: string;
  type: EmailAutomationType;
  defaultEnabled: boolean;
  trigger: string;
  category: "payments" | "pre_travel" | "post_travel" | "relationship" | "documents";
};

export const emailAutomationTemplates: EmailAutomationTemplate[] = [
  {
    template: "Final Payment Reminder",
    type: "final_payment_10_day",
    defaultEnabled: true,
    trigger: "10 days before final payment due date",
    category: "payments",
  },
  {
    template: "30-Day Pre-Travel Email",
    type: "pre_travel_30_day",
    defaultEnabled: true,
    trigger: "30 days before departure",
    category: "pre_travel",
  },
  {
    template: "7-Day Pre-Travel Email",
    type: "pre_travel_7_day",
    defaultEnabled: true,
    trigger: "7 days before departure",
    category: "pre_travel",
  },
  {
    template: "7-Day Post-Travel Follow-Up",
    type: "post_travel_7_day",
    defaultEnabled: true,
    trigger: "7 days after return",
    category: "post_travel",
  },
  {
    template: "60-Day Post-Travel Follow-Up",
    type: "post_travel_60_day",
    defaultEnabled: true,
    trigger: "60 days after return",
    category: "post_travel",
  },
  {
    template: "Birthday Email",
    type: "birthday",
    defaultEnabled: true,
    trigger: "Client birthday",
    category: "relationship",
  },
  {
    template: "Anniversary Email",
    type: "anniversary",
    defaultEnabled: true,
    trigger: "Client anniversary date",
    category: "relationship",
  },
  {
    template: "Passport Expiration Reminder",
    type: "passport_expiry_6mo",
    defaultEnabled: true,
    trigger: "180 days before passport expiration",
    category: "documents",
  },
];

export function labelForEmailAutomationType(type: string) {
  return emailAutomationTemplates.find((template) => template.type === type)?.template ?? type;
}
