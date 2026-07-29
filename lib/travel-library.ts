export type TravelLibraryCategory =
  | "working-with-advisor"
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
  sourceUrl?: string;
  sourceLabel?: string;
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
    id: "working-with-advisor",
    label: "Working With Your Advisor",
    description: "How Cozy supports you before, during, and after travel.",
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
    slug: "why-work-with-travel-advisor",
    title: "Why work with a travel advisor instead of booking everything online?",
    category: "working-with-advisor",
    summary: "A trusted advisor helps turn a reservation into a thoughtfully prepared trip.",
    answer: [
      "Booking online can confirm a reservation, but working with Cozy Adventure Vacations gives you relationship-driven travel planning with proactive personal care.",
      "Jeremy helps you compare options, understand what fits your travel style, watch deadlines, prepare documents, think through accessibility or family logistics, and avoid common surprises before departure.",
      "The Cozy Concierge app keeps helpful details close by, but it is there to strengthen the personal service. Technology for convenience. Personal guidance for everything that matters.",
    ],
    tags: ["advisor", "planning", "concierge service", "cozy concierge"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "You are comparing destinations, resorts, cruises, or room types.",
      "You want help matching the trip to your priorities instead of choosing from too many options.",
      "You have accessibility, family, payment, or documentation needs to plan around.",
    ],
  },
  {
    slug: "what-happens-after-booking",
    title: "What happens after my trip is booked?",
    category: "working-with-advisor",
    summary: "Support continues after confirmation through reminders, documents, and trip guidance.",
    answer: [
      "After booking, Cozy Adventure Vacations continues helping with itinerary coordination, supplier documents, payment reminders, travel tips, and questions that come up before departure.",
      "You may see trip details, documents, deadline reminders, messages, and helpful resources inside Cozy Concierge. Some clients may also receive organized physical travel materials when appropriate for the trip.",
      "You are still responsible for reviewing confirmations, names, dates, payment deadlines, documents, and supplier rules. If anything looks off, message Jeremy early so there is time to help.",
    ],
    tags: ["after booking", "documents", "payment reminders", "portal"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "A traveler name, date, destination, or room detail does not look right.",
      "You cannot find a document, payment link, or supplier instruction.",
      "You have a new request after the trip is confirmed.",
    ],
  },
  {
    slug: "quotes-pricing-availability",
    title: "Are quotes, prices, and availability guaranteed while I decide?",
    category: "working-with-advisor",
    summary: "Travel pricing can change until the supplier confirms the booking and payment is processed.",
    answer: [
      "Quotes are based on the information and availability available at the time they are prepared. Supplier pricing, taxes, fees, promotions, exchange rates, and inventory can change before confirmation.",
      "A quote is not guaranteed until the supplier confirms the booking and required payments have been received and processed.",
      "Cozy Adventure Vacations does not use high-pressure language or promise best-price guarantees. The goal is to help you choose confidently, with clear expectations about timing and supplier rules.",
    ],
    tags: ["quotes", "pricing", "availability", "deposits"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "You are interested in a price-sensitive offer or limited inventory.",
      "Your travel dates, room type, or number of travelers may change.",
      "You want to understand what payment is needed to hold the booking.",
    ],
  },
  {
    slug: "changes-cancellations-refunds",
    title: "What if I need to change, cancel, or request a refund?",
    category: "working-with-advisor",
    summary: "Supplier rules control most change, cancellation, credit, and refund outcomes.",
    answer: [
      "Change and cancellation rules vary by supplier and may include non-refundable deposits, penalties, fare differences, repricing, or loss of promotional benefits.",
      "Cozy Adventure Vacations can assist with supplier communications and refund requests when appropriate, but supplier decisions, refund eligibility, processing times, credit validity, and alternate options are controlled by the supplier.",
      "Before initiating a payment dispute or chargeback, contact Cozy promptly. A direct conversation often gives Jeremy the best chance to help gather facts, review supplier rules, and advocate appropriately.",
    ],
    tags: ["cancellation", "changes", "refunds", "supplier rules"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "You are thinking about changing dates, names, flights, rooms, or package components.",
      "A supplier cancellation or schedule change affects the rest of your trip.",
      "You are unsure whether to accept a refund, future travel credit, or alternate arrangement.",
    ],
  },
  {
    slug: "travel-insurance-advisor-guidance",
    title: "Why does my advisor discuss travel insurance?",
    category: "working-with-advisor",
    summary: "Insurance is part of preparing carefully for the unexpected, but coverage is policy-specific.",
    answer: [
      "Cozy Adventure Vacations strongly recommends that every traveler review comprehensive travel insurance or travel protection for cancellation, interruption, medical emergencies, evacuation, supplier default, baggage issues, travel delay, and other unexpected events.",
      "Insurance benefits, exclusions, pre-existing condition rules, purchase deadlines, claim requirements, and coverage limits are determined by the insurer and policy documents.",
      "Jeremy can help you understand why protection may matter for your trip, but travelers are responsible for reviewing policy documents and deciding whether coverage is adequate.",
    ],
    tags: ["travel insurance", "protection", "claims", "coverage"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "You recently made your first trip deposit.",
      "You have nonrefundable trip costs or international travel plans.",
      "You need help finding claim documentation after a covered disruption may have occurred.",
    ],
  },
  {
    slug: "traveler-responsibilities",
    title: "What am I responsible for as the traveler?",
    category: "working-with-advisor",
    summary: "Your advisor guides the process, and travelers still need to review details and meet requirements.",
    answer: [
      "Travelers are responsible for providing accurate names, dates of birth, contact details, passport information, traveler preferences, payment information, and other trip details.",
      "You are also responsible for obtaining, carrying, and presenting required travel documents, including passports, visas, government ID, entry forms, vaccination records, consent documents, cruise boarding documents, and supplier-required materials.",
      "Cozy may provide reminders and links as a courtesy, but official entry, health, legal, immigration, and supplier requirements can change. Review official sources and supplier documents before departure and again close to travel.",
    ],
    tags: ["traveler responsibility", "documents", "passport", "entry requirements"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "A name does not match government-issued identification.",
      "You are traveling internationally, with minors, or with mixed last names.",
      "You see a destination rule, health note, or supplier requirement you do not understand.",
    ],
  },
  {
    slug: "support-during-travel",
    title: "What should I do if something goes wrong while I am traveling?",
    category: "working-with-advisor",
    summary: "Use the right urgent contact first, then loop Jeremy in with clear details and documentation.",
    answer: [
      "If there is an emergency, contact local emergency services, medical help, airport staff, ship crew, hotel management, or the responsible supplier first.",
      "When you are safe, message Jeremy with your booking details, location, what happened, and any time-sensitive deadlines. Keep receipts, screenshots, reports, emails, and names of people you spoke with.",
      "Cozy Adventure Vacations can provide guidance and assist with supplier or insurance communication when appropriate, but suppliers, insurers, airlines, governments, and local authorities control many real-time decisions.",
    ],
    tags: ["during travel", "support", "disruption", "supplier"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "A delay, illness, lost bag, denied boarding, or hotel issue affects your itinerary.",
      "You need help deciding what documentation to save for insurance or supplier follow-up.",
      "A supplier gives you an option and you are unsure how it affects the rest of the trip.",
    ],
  },
  {
    slug: "special-requests-accessibility",
    title: "Are special requests or accessibility needs guaranteed?",
    category: "working-with-advisor",
    summary: "Requests are communicated when feasible, but suppliers decide what can be confirmed.",
    answer: [
      "Tell Cozy Adventure Vacations as early as possible about mobility needs, medical considerations, dietary restrictions, bedding preferences, connecting rooms, celebrations, accessibility requests, or other special requests.",
      "Jeremy can communicate requests to suppliers when feasible, but special requests are not guaranteed unless confirmed directly by the supplier in writing.",
      "Travelers are responsible for confirming that travel arrangements are suitable for their personal, medical, mobility, dietary, or accessibility needs.",
    ],
    tags: ["accessibility", "special requests", "dietary", "rooms"],
    sourceUrl: "/terms-and-conditions",
    sourceLabel: "Cozy Terms & Conditions",
    askAdvisorWhen: [
      "A request is essential for mobility, medical, dietary, or family care.",
      "You need connecting rooms, specific bedding, or a confirmed accessible room.",
      "A supplier asks for documentation, advance notice, or additional fees.",
    ],
  },
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
    slug: "tsa-liquids-rule",
    title: "What is the TSA 3-1-1 liquids rule?",
    category: "packing",
    summary: "Carry-on liquids, gels, creams, aerosols, and pastes must follow TSA size limits.",
    answer: [
      "For most carry-on liquids, gels, creams, pastes, and aerosols, TSA uses the 3-1-1 rule: travel-size containers of 3.4 ounces or 100 milliliters or less, packed in one quart-size bag, with one bag per passenger.",
      "Pack larger toiletries in checked luggage when possible, and place your small liquids bag where it is easy to remove if requested during screening.",
      "Some medically necessary liquids may be allowed in larger amounts, but they should be declared for screening. Rules and screening decisions can vary by item, so check TSA guidance before packing anything unusual.",
    ],
    tags: ["tsa", "liquids", "carry-on", "packing", "security"],
    sourceUrl: "https://www.tsa.gov/news/press/factsheets/tsa-travel-tips",
    sourceLabel: "TSA Travel Tips",
    askAdvisorWhen: [
      "You are packing medical liquids, specialty toiletries, or food for a traveler with medical needs.",
      "You are unsure whether an item belongs in checked or carry-on luggage.",
      "Your itinerary includes multiple flights or international screening points.",
    ],
  },
  {
    slug: "traveling-with-medications",
    title: "How should I pack medications for travel?",
    category: "packing",
    summary: "Keep medications accessible, clearly packed, and protected from luggage delays.",
    answer: [
      "Keep prescription medications, medical devices, and anything medically necessary in your carry-on rather than checked luggage.",
      "TSA allows medications through screening, but they may need additional review. Liquid medications and medically necessary liquids can be screened separately from the standard liquids bag.",
      "For international travel, bring medications in original packaging when practical and review destination rules before departure. Some medicines that are common at home may be restricted elsewhere.",
    ],
    tags: ["medications", "tsa", "carry-on", "health", "international"],
    sourceUrl: "https://www.tsa.gov/news/press/factsheets/tsa-travel-tips",
    sourceLabel: "TSA Medication Guidance",
    askAdvisorWhen: [
      "You travel with refrigerated medication or medical equipment.",
      "You need to carry syringes, liquid medication, or mobility-related supplies.",
      "You are traveling internationally with controlled or specialty medication.",
    ],
  },
  {
    slug: "flight-delay-cancellation-next-steps",
    title: "What should I do if my flight is delayed or canceled?",
    category: "airports-flights",
    summary: "Stay calm, keep records, and review your airline options before choosing.",
    answer: [
      "Start with the airline app, gate agents, and official airline notifications. Rebooking options can change quickly, so check more than one channel when possible.",
      "If the disruption is within the airline's control, some airlines have committed to meals, hotels, transportation, or rebooking support in certain situations. DOT maintains a dashboard showing each major U.S. airline's commitments.",
      "Save screenshots, emails, boarding passes, receipts, and delay notices. If you have travel insurance, documentation is often important for a claim.",
    ],
    tags: ["flight delay", "cancellation", "airline", "rebooking", "receipts"],
    sourceUrl: "https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard",
    sourceLabel: "DOT Airline Cancellation and Delay Dashboard",
    askAdvisorWhen: [
      "A delay could affect a cruise, tour, transfer, or hotel check-in.",
      "You are unsure whether to accept a rebooking, voucher, or refund.",
      "You need documentation for a travel insurance claim.",
    ],
  },
  {
    slug: "airline-refunds-basics",
    title: "When might I be entitled to an airline refund?",
    category: "airports-flights",
    summary: "DOT refund rules may apply when the airline cancels or significantly changes a flight.",
    answer: [
      "Under DOT rules, passengers may be entitled to a refund when an airline cancels a flight or makes a significant delay or schedule change, and the traveler chooses not to travel or accept the airline's alternative.",
      "Refund rules are not the same as compensation for inconvenience. Meals, hotels, or vouchers depend on the airline's commitments and the cause of the disruption.",
      "Before accepting a credit, voucher, or alternate flight, pause and review your options. The right choice can depend on the rest of your trip and any insurance coverage.",
    ],
    tags: ["refund", "flight cancellation", "schedule change", "dot", "airline"],
    sourceUrl: "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
    sourceLabel: "DOT Airline Refunds",
    askAdvisorWhen: [
      "The new flight affects a cruise departure, tour start, or prepaid hotel.",
      "You are offered a voucher and are not sure whether to accept it.",
      "You booked air as part of a package or through a supplier.",
    ],
  },
  {
    slug: "international-travel-checklist",
    title: "What should I check before international travel?",
    category: "documents",
    summary: "Review destination rules, documents, copies, health notes, and emergency contacts early.",
    answer: [
      "Before traveling abroad, review your destination's entry, exit, visa, passport validity, health, and local-law information.",
      "Make copies of important documents and keep one set separate from the originals. It can also help to leave a copy with someone you trust at home.",
      "The State Department's STEP program can send safety, weather, health, and security alerts for your destination and can help an embassy or consulate contact you in an emergency.",
    ],
    tags: ["international", "documents", "passport", "visa", "step"],
    sourceUrl: "https://travel.state.gov/en/international-travel/planning/checklist.html?sfns=mo",
    sourceLabel: "State Department International Travel Checklist",
    askAdvisorWhen: [
      "Your destination has visa, vaccination, or passport validity requirements.",
      "You are traveling with minors or multiple households.",
      "You want help organizing documents before departure.",
    ],
  },
  {
    slug: "passport-processing-timing",
    title: "When should I renew or apply for a passport?",
    category: "documents",
    summary: "Start early, because mailing, processing, and return delivery all take time.",
    answer: [
      "Check passport expiration dates as soon as you start planning. Some destinations require at least six months of validity beyond your travel dates, and some airlines may deny boarding if this requirement is not met.",
      "Passport timing includes more than processing alone. Mailing the application and receiving the completed passport can each add time.",
      "If your trip is approaching, review the State Department's current processing options and ask your advisor if timing could affect your booking.",
    ],
    tags: ["passport", "renewal", "processing", "international", "documents"],
    sourceUrl: "https://travel.state.gov/en/passports.html",
    sourceLabel: "U.S. Passports",
    askAdvisorWhen: [
      "Your passport expires within a year of travel.",
      "A child passport is involved.",
      "Your name recently changed or your passport is damaged.",
    ],
  },
  {
    slug: "customs-declarations",
    title: "What do I need to declare when returning to the United States?",
    category: "documents",
    summary: "Declare food, agriculture items, alcohol, tobacco, certain medications, and large currency amounts.",
    answer: [
      "When entering the United States, CBP requires travelers to declare all foods, plants, agricultural items, and wildlife items.",
      "Currency or monetary instruments over $10,000 must be declared. Medications should generally be declared, kept in original packaging, and carried with a prescription in the traveler's name when applicable.",
      "If you are unsure whether an item must be declared, declare it and let CBP make the determination. Penalties and confiscation are much more stressful than asking at inspection.",
    ],
    tags: ["customs", "cbp", "food", "medications", "declaration"],
    sourceUrl: "https://www.help.cbp.gov/s/article/Article-1909?language=en_US",
    sourceLabel: "CBP Declaration Guidance",
    askAdvisorWhen: [
      "You are bringing food, alcohol, tobacco, gifts, or medication home.",
      "You bought expensive items abroad.",
      "You are unsure whether a souvenir is agricultural or wildlife-related.",
    ],
  },
  {
    slug: "food-water-safety",
    title: "How can I reduce the chance of getting sick from food or water?",
    category: "pre-departure",
    summary: "Choose food and drinks carefully when sanitation or water safety is uncertain.",
    answer: [
      "In destinations where tap water safety is uncertain, use factory-sealed bottled water or properly disinfected water for drinking, brushing teeth, making ice, and preparing food or drinks.",
      "Choose foods that are cooked and served hot. Be cautious with raw or undercooked meat, seafood, eggs, unpeeled produce, unpasteurized dairy, and food that has not been kept hot or cold enough.",
      "Wash hands before eating. If soap and water are not available, use hand sanitizer with at least 60 percent alcohol.",
    ],
    tags: ["food safety", "water", "health", "international", "cdc"],
    sourceUrl: "https://wwwnc.cdc.gov/travel/page/food-water-safety",
    sourceLabel: "CDC Food and Drink Considerations",
    askAdvisorWhen: [
      "You have immune, pregnancy, age-related, or medical risk factors.",
      "You are traveling somewhere with limited water treatment or sanitation.",
      "You need help matching dining plans to health or accessibility needs.",
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
