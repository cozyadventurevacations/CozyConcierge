export type RegistrationField = {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "tel" | "date" | "textarea";
  autoComplete?: string;
  maxLength: number;
  placeholder?: string;
  options?: string[];
};

export const registrationSections: { title: string; optional?: boolean; intro: string; fields: RegistrationField[] }[] = [
  {
    title: "Personal information",
    intro: "Use your full name as it appears on your ID. Fields marked * are required.",
    fields: [
      { name: "first_name", label: "First name", required: true, autoComplete: "given-name", maxLength: 100 },
      { name: "middle_name", label: "Middle name", autoComplete: "additional-name", maxLength: 100 },
      { name: "last_name", label: "Last name", required: true, autoComplete: "family-name", maxLength: 100 },
      { name: "date_of_birth", label: "Date of birth", type: "date", required: true, autoComplete: "bday", maxLength: 10 },
      { name: "phone_primary", label: "Primary phone", type: "tel", required: true, autoComplete: "tel", maxLength: 50, placeholder: "Include country code if outside the US" },
    ],
  },
  {
    title: "Home address",
    intro: "Enter your complete mailing address.",
    fields: [
      { name: "address_line_1", label: "Street address", required: true, autoComplete: "address-line1", maxLength: 200 },
      { name: "address_line_2", label: "Apartment, suite, or unit", autoComplete: "address-line2", maxLength: 200 },
      { name: "city", label: "City", required: true, autoComplete: "address-level2", maxLength: 100 },
      { name: "state", label: "State / province / region", required: true, autoComplete: "address-level1", maxLength: 100 },
      { name: "postal_code", label: "ZIP / postal code", required: true, autoComplete: "postal-code", maxLength: 20 },
    ],
  },
  {
    title: "More about you", optional: true,
    intro: "Share as much as you like. You can add or update these details in your profile later.",
    fields: [
      { name: "preferred_name", label: "Preferred name", maxLength: 100 },
      { name: "phone_secondary", label: "Secondary phone", type: "tel", maxLength: 50 },
      { name: "anniversary_date", label: "Anniversary date", type: "date", maxLength: 10 },
    ],
  },
  {
    title: "Emergency contact", optional: true,
    intro: "Let us know who to contact in an emergency.",
    fields: [
      { name: "emergency_contact_name", label: "Emergency contact name", maxLength: 200 },
      { name: "emergency_contact_relationship", label: "Relationship", maxLength: 100, options: ["Spouse", "Parent", "Child", "Sibling", "Friend", "Travel Companion", "Other"] },
      { name: "emergency_contact_phone", label: "Emergency contact phone", type: "tel", maxLength: 50 },
    ],
  },
  {
    title: "Travel preferences", optional: true,
    intro: "Help your advisor plan trips around the way you like to travel.",
    fields: [
      { name: "preferred_airport", label: "Preferred airport", maxLength: 200, placeholder: "Airport name, city, or code, e.g. ORD" },
      { name: "travel_style", label: "Travel style", maxLength: 500, placeholder: "Relaxed, adventurous, luxury, family-friendly..." },
      { name: "airline_seating_preference", label: "Airline seating", maxLength: 100, options: ["Aisle", "Window", "Middle", "No preference"] },
      { name: "airline_class_preference", label: "Airline class", maxLength: 100, options: ["First Class", "Business", "Premium Economy / Economy Plus", "Economy", "No preference"] },
      { name: "cruise_cabin_preference", label: "Cruise cabin", maxLength: 100, options: ["Suite", "Family Suite", "Junior Suite", "Balcony", "Ocean View", "Interior", "Accessible Cabin", "Connecting Cabins", "Family Cabin", "No preference"] },
      { name: "travel_preference_notes", label: "Additional travel preferences", type: "textarea", maxLength: 2000 },
      { name: "accessibility_notes", label: "Accessibility / mobility needs", type: "textarea", maxLength: 2000 },
      { name: "food_allergies", label: "Food allergies and dietary notes", type: "textarea", maxLength: 2000, placeholder: "List any allergies or dietary needs, or enter no known food allergies." },
      { name: "notes", label: "Anything else for your advisor", type: "textarea", maxLength: 2000, placeholder: "Special occasions, interests, or anything else you would like us to know." },
    ],
  },
];

export const registrationNotificationFields = [
  { name: "notify_new_messages", label: "New messages from my advisor" },
  { name: "notify_payment_reminders", label: "Payment reminders" },
  { name: "notify_trip_updates", label: "Trip updates and documents" },
  { name: "notify_travel_circle_invites", label: "Travel Circle invitations" },
];

export function validateRegistrationProfile(input: Record<string, unknown>, now = new Date()) {
  const profile: Record<string, string | boolean | null> = {};
  for (const field of registrationSections.flatMap((section) => section.fields)) {
    const raw = input[field.name];
    if (raw != null && typeof raw !== "string") return { error: `Enter a valid ${field.label.toLowerCase()}.` };
    const value = typeof raw === "string" ? raw.trim() : "";
    if (field.required && !value) return { error: `${field.label} is required.` };
    if (value.length > field.maxLength) return { error: `${field.label} must be ${field.maxLength} characters or fewer.` };
    if (value && field.type === "date") {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01") {
        return { error: `Enter a valid ${field.label.toLowerCase()}.` };
      }
      if (field.name === "date_of_birth" && date > now) return { error: "Date of birth cannot be in the future." };
    }
    if (value && field.type === "tel") {
      const digits = value.replace(/\D/g, "");
      if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) return { error: `Enter a valid ${field.label.toLowerCase()}.` };
    }
    if (value && field.options && !field.options.includes(value)) return { error: `Choose a valid ${field.label.toLowerCase()}.` };
    // Keep the same notes format that the existing profile editor reads.
    profile[field.name] = value ? (field.name === "food_allergies" ? `Other / Notes: ${value.replace(/\r?\n/g, "; ")}` : value) : null;
  }
  for (const field of registrationNotificationFields) {
    const value = input[field.name];
    if (value !== undefined && typeof value !== "boolean") return { error: "Choose valid email preferences." };
    profile[field.name] = value ?? true;
  }
  return { profile };
}
