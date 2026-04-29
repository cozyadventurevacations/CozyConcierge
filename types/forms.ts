export type QuoteRequestFormValues = {
  name: string;
  email: string;
  phoneNumber: string;
  preferredContactMethod: "email" | "text" | "phone";
  departureDate: string;
  returnDate: string;
  optionalTravelDates?: string;
  numberOfTravelers: number;
  travelerAges?: number[];
  travelTypesRequested: string[];
  destinations: string;
  budget?: string;
  tripVisionNotes?: string;
  zoomCallAvailability?: string;
};

export type PaymentRequestFormValues = {
  amountToPay: number;
  dateToPay: string;
};
