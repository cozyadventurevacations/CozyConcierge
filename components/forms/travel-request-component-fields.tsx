"use client";

import { useState } from "react";
import { AirlinePicker } from "@/components/forms/airline-picker";
import { AirportPicker } from "@/components/forms/airport-picker";

type TravelType = {
  value: string;
  label: string;
};

const cruiseLineOptions = [
  "Any",
  "Royal Caribbean International",
  "Celebrity Cruises",
  "Norwegian Cruise Line",
  "Princess Cruises",
  "Holland America Line",
  "Disney Cruise Line",
  "Virgin Voyages",
  "MSC Cruises",
  "Viking",
  "AmaWaterways",
  "Avalon Waterways",
  "Uniworld Boutique River Cruises",
  "Azamara",
  "Oceania Cruises",
  "Regent Seven Seas Cruises",
  "Seabourn",
  "Silversea",
];

const themeParkOptions = [
  "Walt Disney World Florida",
  "Disneyland California",
  "Universal Studios Orlando",
  "Universal Studios California",
  "SeaWorld Orlando",
  "Busch Gardens Tampa Bay",
  "LEGOLAND Florida",
  "Dollywood",
  "Cedar Point",
  "Six Flags Magic Mountain",
  "Other / not sure",
];

function ComponentDetailCard({
  title,
  helper,
  children,
}: {
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="stack"
      style={{
        border: "1px solid #d9ecf2",
        borderRadius: 14,
        background: "#fbfdfe",
        padding: 14,
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
        <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.5, fontSize: 14 }}>
          {helper}
        </p>
      </div>

      {children}
    </div>
  );
}

export function TravelRequestComponentFields({
  travelTypes,
  defaultDepartureAirport,
}: {
  travelTypes: TravelType[];
  defaultDepartureAirport?: string | null;
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  function toggleTravelType(value: string, checked: boolean) {
    setSelectedTypes((current) => {
      if (checked) {
        return current.includes(value) ? current : [...current, value];
      }

      return current.filter((type) => type !== value);
    });
  }

  const includesAir = selectedTypes.includes("air");
  const includesCruise = selectedTypes.includes("cruise");
  const includesThemePark = selectedTypes.includes("theme_park");

  return (
    <div className="stack">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {travelTypes.map((type) => (
          <label
            key={type.value}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "11px 12px",
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "#ffffff",
              cursor: "pointer",
              lineHeight: 1.35,
              fontWeight: 800,
              color: "var(--accent-dark)",
            }}
          >
            <input
              type="checkbox"
              name="travel_types_requested"
              value={type.value}
              checked={selectedTypes.includes(type.value)}
              onChange={(event) => toggleTravelType(type.value, event.target.checked)}
            />
            <span>{type.label}</span>
          </label>
        ))}
      </div>

      {includesAir ? (
        <ComponentDetailCard
          title="Air Preferences"
          helper="These help narrow flight options before your advisor starts shopping."
        >
          <div className="grid grid-2">
            <AirlinePicker
              label="Preferred Airline"
              name="air_preferred_airline"
              helper="Optional. Search by airline code or name, or type a custom value."
            />
            <AirportPicker
              label="Preferred Departure Airport"
              name="air_departure_airport"
              defaultValue={defaultDepartureAirport}
              helper="Filled from your profile when available. You can change it for this trip."
            />
          </div>
        </ComponentDetailCard>
      ) : null}

      {includesCruise ? (
        <ComponentDetailCard
          title="Cruise Preferences"
          helper="Carnival is intentionally not listed because Cozy Adventure Vacations does not sell Carnival cruises."
        >
          <label className="stack-sm">
            <span className="label">Cruise Line Preference</span>
            <select className="select" name="cruise_line_preference" defaultValue="Any">
              {cruiseLineOptions.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </label>
        </ComponentDetailCard>
      ) : null}

      {includesThemePark ? (
        <ComponentDetailCard
          title="Theme Park Preferences"
          helper="Pick the park that best matches the request. Your advisor can refine tickets, hotels, and add-ons later."
        >
          <label className="stack-sm">
            <span className="label">Theme Park Destination</span>
            <select className="select" name="theme_park_preference" defaultValue="">
              <option value="">Select a theme park</option>
              {themeParkOptions.map((park) => (
                <option key={park} value={park}>
                  {park}
                </option>
              ))}
            </select>
          </label>
        </ComponentDetailCard>
      ) : null}
    </div>
  );
}
