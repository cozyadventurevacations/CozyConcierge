export type TravelLibraryCategory =
  | "before-you-book"
  | "pre-departure"
  | "packing"
  | "documents"
  | "airports-flights"
  | "cruises"
  | "resorts-hotels"
  | "payments-insurance";

export type TravelLibraryItem = {
  slug: string;
  title: string;
  category: TravelLibraryCategory;
  summary: string;
  answer: string[];
  tags: string[];
  pdfUrl?: string;
  pdfLabel?: string;
  askAdvisorWhen?: string[];
};

export const travelLibraryCategories: {
  id: TravelLibraryCategory | "all";
  label: string;
  description: string;
}[] = [
  {
    id: "all",
    label: "All",
    description: "Browse every travel tip and FAQ.",
  },
  {
    id: "before-you-book",
    label: "Before You Book",
    description: "Choosing dates, trip style, rooms, and expectations.",
  },
  {
    id: "pre-departure",
    label: "Pre-Departure",
    description: "What to review before your trip gets close.",
  },
  {
    id: "packing",
    label: "Packing",
    description: "Practical packing and carry-on reminders.",
  },
  {
    id: "documents",
    label: "Documents",
    description: "Passports, IDs, confirmations, and secure uploads.",
  },
  {
    id: "airports-flights",
    label: "Airports & Flights",
    description: "Airport timing, delays, seats, and luggage basics.",
  },
  {
    id: "cruises",
    label: "Cruises",
    description: "Embarkation, onboard accounts, excursions, and dining.",
  },
  {
    id: "resorts-hotels",
    label: "Resorts & Hotels",
    description: "Check-in, room requests, resort fees, and amenities.",
  },
  {
    id: "payments-insurance",
    label: "Payments & Insurance",
    description: "Due dates, protection plans, receipts, and claims.",
  },
];

export const travelLibraryItems: TravelLibraryItem[] = [
  {
    slug: "life-onboard-cruise-rhythm",
    title: "Life Onboard: Finding Your Cruise Rhythm",
    category: "cruises",
    summary: "How to enjoy the ship without trying to do every activity.",
    answer: [
      "Modern cruise ships offer more than most guests can experience in one sailing. That is a benefit, not a challenge.",
      "Use the cruise line app or printed schedule to review shows, activities, dining times, port information, live music, family programming, and theme nights. Then choose a few priorities each day and leave room for rest.",
      "The best cruise schedule is not the one with the most activities. It is the one that leaves you rested, connected, and excited for the next day.",
    ],
    tags: ["cruise", "onboard", "sea days", "entertainment", "pool deck"],
    pdfUrl: "/travel-library/life-onboard-cruise-rhythm.pdf",
    pdfLabel: "Download Life Onboard Guide",
    askAdvisorWhen: [
      "You want help choosing shows, dining, or excursion timing.",
      "You are unsure about dress codes or theme nights.",
      "You want a calmer onboard plan for a family or group.",
    ],
  },
  {
    slug: "join-your-cruise-facebook-group",
    title: "Join Your Cruise's Facebook Group",
    category: "pre-departure",
    summary: "Find your sailing group for ideas, community, and optional events.",
    answer: [
      "Before your cruise, search Facebook for a group created specifically for your sailing. These groups are often named using the ship and departure date.",
      "They can be helpful for port ideas, hotel recommendations, transportation tips, theme-night information, and optional activities such as meet-and-greets or gift exchanges.",
      "Facebook groups are not official cruise line resources. Verify important details with your cruise line or travel advisor, and avoid sharing personal information publicly.",
    ],
    tags: ["cruise", "facebook group", "pre-departure", "community", "safety"],
    pdfUrl: "/travel-library/join-your-cruise-facebook-group.pdf",
    pdfLabel: "Download Facebook Group Tip Sheet",
    askAdvisorWhen: [
      "A group post mentions document, boarding, or itinerary changes.",
      "You are considering a group excursion.",
      "You are not sure whether information from the group is accurate.",
    ],
  },
  {
    slug: "30-day-cruise-countdown-checklist",
    title: "30-Day Cruise Countdown Checklist",
    category: "pre-departure",
    summary: "A final-month cruise checklist for a smoother departure.",
    answer: [
      "Use the final 30 days to confirm documents, online check-in, cruise app access, luggage tags, reservations, packing needs, transfers, and flight timing.",
      "Add one simple pre-cruise step: find and join the Facebook group for your specific sailing.",
      "Keep passports, IDs, medications, valuables, chargers, and first-day essentials in your carry-on.",
    ],
    tags: ["cruise", "checklist", "30 days", "packing", "documents"],
    pdfUrl: "/travel-library/30-day-cruise-countdown-checklist.pdf",
    pdfLabel: "Download 30-Day Checklist",
    askAdvisorWhen: [
      "Any traveler name, date, document, or transfer detail looks wrong.",
      "You cannot complete online check-in.",
      "You need help deciding what belongs in your carry-on.",
    ],
  },
  {
    slug: "passport-validity",
    title: "How long should my passport be valid after travel?",
    category: "documents",
    summary: "Many destinations require extra validity beyond your return date.",
    answer: [
      "For international travel, review passport validity early. Many destinations require your passport to remain valid for at least six months after your return date, even if your trip is shorter.",
      "Also check that your legal name on the passport matches your airline tickets and supplier reservations. Small differences can cause delays or denied boarding.",
      "Upload passport documents only through the secure portal when your advisor requests them. Do not send passport scans by email or chat.",
    ],
    tags: ["passport", "international", "documents", "id"],
    askAdvisorWhen: [
      "Your passport expires within a year of travel.",
      "Your name recently changed.",
      "You are traveling with minors or mixed last names.",
    ],
  },
  {
    slug: "final-payment-dates",
    title: "Why final payment dates matter",
    category: "payments-insurance",
    summary: "Suppliers can cancel space automatically when payments are late.",
    answer: [
      "Final payment dates are set by the supplier and are often earlier than travelers expect. Missing a payment deadline can lead to cancellation, penalties, or loss of promotional pricing.",
      "Keep your payment method current and review your trip page for due dates. If you need a payment link or receipt, use the secure portal or message your advisor.",
      "For payment security, never send full card numbers, CVV codes, or sensitive payment details by email, text, or chat.",
    ],
    tags: ["payments", "due dates", "receipts", "security"],
    askAdvisorWhen: [
      "You need to split a payment across cards.",
      "A payment date conflicts with your plans.",
      "You need a fresh secure payment link.",
    ],
  },
  {
    slug: "carry-on-essentials",
    title: "What should go in my carry-on?",
    category: "packing",
    summary: "Pack anything critical where you can reach it.",
    answer: [
      "Keep passports, IDs, travel documents, medications, chargers, valuables, a change of clothes, and essential toiletries in your carry-on.",
      "If you are checking luggage, assume it could be delayed. Anything you need in the first 24 hours of travel should stay with you.",
      "Liquids in carry-ons must follow airport screening rules. Review current TSA or airport guidance before packing restricted items.",
    ],
    tags: ["packing", "carry-on", "luggage", "medications"],
    askAdvisorWhen: [
      "You have medical devices or refrigerated medication.",
      "Your itinerary includes multiple connections.",
      "You are packing for a cruise, safari, or remote destination.",
    ],
  },
  {
    slug: "airport-arrival-times",
    title: "How early should I arrive at the airport?",
    category: "airports-flights",
    summary: "Give yourself more time than the best-case version of the day.",
    answer: [
      "A common guideline is to arrive at least two hours before domestic flights and three hours before international flights.",
      "Add more time for holiday travel, checked bags, mobility assistance, large groups, unfamiliar airports, or separate tickets.",
      "Always verify airline and airport guidance for your specific departure, because security wait times and check-in cutoffs can change.",
    ],
    tags: ["airport", "flights", "check-in", "security"],
    askAdvisorWhen: [
      "Your connection looks tight.",
      "You are traveling with a group.",
      "You need wheelchair or mobility assistance.",
    ],
  },
  {
    slug: "cruise-embarkation-day",
    title: "What happens on cruise embarkation day?",
    category: "cruises",
    summary: "Boarding day is smoother when documents and essentials are handy.",
    answer: [
      "Before arriving at the terminal, complete online check-in, review your arrival window, and keep passports or IDs easily accessible.",
      "Checked bags may not reach your stateroom immediately. Carry medications, swimwear, documents, valuables, and anything needed before dinner.",
      "Cruise lines can change boarding requirements, health forms, and app steps, so review the cruise line instructions close to sailing.",
    ],
    tags: ["cruise", "boarding", "embarkation", "documents"],
    askAdvisorWhen: [
      "You are flying in the same day as embarkation.",
      "You need transfers to the port.",
      "Your documents or names do not match exactly.",
    ],
  },
  {
    slug: "resort-room-requests",
    title: "Are resort room requests guaranteed?",
    category: "resorts-hotels",
    summary: "Room requests are helpful, but they are usually not guarantees.",
    answer: [
      "Requests like adjoining rooms, bedding type, floor, view, or proximity can usually be noted with the supplier, but final assignment is handled by the property.",
      "Guaranteed categories are different from requests. If a view, room type, or bedding arrangement is essential, ask whether it can be booked as a confirmed category.",
      "At check-in, polite flexibility helps. Properties may have more options later in the day, but availability depends on occupancy and housekeeping.",
    ],
    tags: ["hotel", "resort", "rooms", "requests"],
    askAdvisorWhen: [
      "A room setup is essential for accessibility or family care.",
      "You need connecting rooms.",
      "You are celebrating a special occasion.",
    ],
  },
  {
    slug: "travel-insurance-basics",
    title: "When should I consider travel insurance?",
    category: "payments-insurance",
    summary: "Protection is usually most valuable when reviewed early.",
    answer: [
      "Travel insurance can help protect prepaid trip costs and may include benefits for covered cancellations, medical issues, baggage delays, or travel interruptions.",
      "Plan details vary. Some benefits require purchase within a specific window after the first trip deposit, so review options early.",
      "Insurance is regulated and plan-specific. Read the policy documents carefully and ask questions before assuming a situation is covered.",
    ],
    tags: ["insurance", "protection", "cancellation", "medical"],
    askAdvisorWhen: [
      "You recently made your first deposit.",
      "You have nonrefundable trip costs.",
      "You are traveling internationally or cruising.",
    ],
  },
  {
    slug: "before-booking-details",
    title: "What details help before requesting a quote?",
    category: "before-you-book",
    summary: "A clearer trip vision makes options stronger and faster.",
    answer: [
      "Helpful details include destination ideas, travel dates or a flexible window, number of travelers, ages of children, room needs, budget comfort, travel style, must-dos, and must-avoids.",
      "If you are unsure, start with the experience you want: relaxing beach, theme parks, cruise, cultural exploring, food, adventure, family time, or celebration travel.",
      "Your advisor can refine the plan, but sharing constraints early helps avoid options that look appealing yet do not fit the real trip.",
    ],
    tags: ["quote", "planning", "budget", "travel request"],
    askAdvisorWhen: [
      "Your dates are flexible.",
      "You are comparing destinations.",
      "You have accessibility, bedding, or family logistics to consider.",
    ],
  },
  {
    slug: "week-before-departure",
    title: "What should I check the week before departure?",
    category: "pre-departure",
    summary: "A final review catches small issues while there is still time.",
    answer: [
      "Review traveler names, dates, flight times, hotel or cruise documents, transfer details, payment status, passport or ID requirements, and any supplier apps.",
      "Confirm luggage rules, weather, arrival instructions, and whether reservations or excursions require printed documents.",
      "If anything looks off in your portal or supplier documents, message your advisor before departure day.",
    ],
    tags: ["departure", "checklist", "documents", "review"],
    askAdvisorWhen: [
      "A name, date, destination, or document looks wrong.",
      "You cannot find transfer or arrival instructions.",
      "A supplier app or online check-in is not working.",
    ],
  },
];

export function getTravelLibraryCategoryLabel(category: TravelLibraryCategory) {
  return travelLibraryCategories.find((item) => item.id === category)?.label ?? category;
}
