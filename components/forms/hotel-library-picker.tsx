"use client";

import { useMemo, useState } from "react";

export type HotelLibraryRow = {
  id: string;
  hotel_name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  website_url: string | null;
  google_place_id: string | null;
  google_maps_url?: string | null;
};

type HotelFormValues = {
  hotelName: string;
  googlePlaceId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  websiteUrl: string;
  googleMapsUrl: string;
};

type HotelFieldNames = {
  hotelName: string;
  googlePlaceId?: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
};

type GoogleSuggestion = {
  placeId: string;
  text: string;
};

type HotelLibraryPickerProps = {
  savedHotels: HotelLibraryRow[];
  fieldNames: HotelFieldNames;
  defaults?: Partial<HotelFormValues>;
  title?: string;
  helpText?: string;
  showContactFields?: boolean;
};

const emptyValues: HotelFormValues = {
  hotelName: "",
  googlePlaceId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  websiteUrl: "",
  googleMapsUrl: "",
};

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function resolveFieldNames(fieldNames: HotelFieldNames) {
  return {
    ...fieldNames,
    googlePlaceId: fieldNames.googlePlaceId ?? "hotel_google_place_id",
    phone: fieldNames.phone ?? "hotel_phone",
    websiteUrl: fieldNames.websiteUrl ?? "hotel_website_url",
    googleMapsUrl: fieldNames.googleMapsUrl ?? "hotel_google_maps_url",
  };
}

function hotelToValues(hotel: HotelLibraryRow): HotelFormValues {
  return {
    hotelName: normalize(hotel.hotel_name),
    googlePlaceId: normalize(hotel.google_place_id),
    addressLine1: normalize(hotel.address_line_1),
    addressLine2: normalize(hotel.address_line_2),
    city: normalize(hotel.city),
    state: normalize(hotel.state),
    postalCode: normalize(hotel.postal_code),
    country: normalize(hotel.country),
    phone: normalize(hotel.phone),
    websiteUrl: normalize(hotel.website_url),
    googleMapsUrl: normalize(hotel.google_maps_url),
  };
}

export function HotelLibraryPicker({
  savedHotels,
  fieldNames,
  defaults,
  title = "Hotel Lookup",
  helpText = "Choose a saved hotel or search Google to fill the address and contact basics.",
  showContactFields = false,
}: HotelLibraryPickerProps) {
  const names = resolveFieldNames(fieldNames);
  const initialValues = { ...emptyValues, ...defaults };
  const [values, setValues] = useState<HotelFormValues>(initialValues);
  const [query, setQuery] = useState(initialValues.hotelName);
  const [suggestions, setSuggestions] = useState<GoogleSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const savedHotelOptions = useMemo(() => {
    return savedHotels.map((hotel) => ({
      id: hotel.id,
      label: [
        hotel.hotel_name,
        [hotel.city, hotel.state].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" - "),
      values: hotelToValues(hotel),
    }));
  }, [savedHotels]);

  function updateValues(nextValues: Partial<HotelFormValues>) {
    setValues((current) => ({ ...current, ...nextValues }));
  }

  function applyValues(nextValues: HotelFormValues) {
    setValues(nextValues);
    setQuery(nextValues.hotelName);
    setSuggestions([]);
    setError("");
  }

  async function searchGoogleHotels() {
    const searchTerm = query.trim();

    if (searchTerm.length < 3) {
      setError("Type at least 3 characters to search hotels.");
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    setError("");

    try {
      const response = await fetch("/api/places/hotels/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: searchTerm }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Hotel search failed.");
      }

      setSuggestions(data.suggestions ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Hotel search failed.");
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function selectGoogleHotel(placeId: string) {
    setIsSearching(true);
    setError("");

    try {
      const response = await fetch("/api/places/hotels/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Hotel details lookup failed.");
      }

      applyValues({
        hotelName: data.hotel?.hotelName ?? "",
        googlePlaceId: data.hotel?.googlePlaceId ?? "",
        addressLine1: data.hotel?.addressLine1 ?? "",
        addressLine2: data.hotel?.addressLine2 ?? "",
        city: data.hotel?.city ?? "",
        state: data.hotel?.state ?? "",
        postalCode: data.hotel?.postalCode ?? "",
        country: data.hotel?.country ?? "",
        phone: data.hotel?.phone ?? "",
        websiteUrl: data.hotel?.websiteUrl ?? "",
        googleMapsUrl: data.hotel?.googleMapsUrl ?? "",
      });
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Hotel details lookup failed.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="card stack" style={{ gridColumn: "1 / -1", background: "#f8fbfc" }}>
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
          {helpText}
        </p>
      </div>

      {savedHotelOptions.length > 0 ? (
        <label className="stack-sm">
          <span className="label">Saved Hotel</span>
          <select
            className="select"
            defaultValue=""
            onChange={(event) => {
              const selected = savedHotelOptions.find((option) => option.id === event.target.value);
              if (selected) applyValues(selected.values);
            }}
          >
            <option value="">Choose a saved hotel...</option>
            {savedHotelOptions.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="stack-sm" style={{ flex: "1 1 280px" }}>
          <span className="label">Hotel Name</span>
          <input
            className="input"
            name={names.hotelName}
            value={values.hotelName}
            onChange={(event) => {
              updateValues({ hotelName: event.target.value });
              setQuery(event.target.value);
            }}
            placeholder="Search by hotel name"
          />
        </label>
        <button
          className="btn btn-outline"
          type="button"
          onClick={searchGoogleHotels}
          disabled={isSearching}
        >
          {isSearching ? "Searching..." : "Search Google"}
        </button>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 700 }}>
          {error}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="stack-sm">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              className="btn btn-outline"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => selectGoogleHotel(suggestion.placeId)}
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      ) : null}

      <input type="hidden" name={names.googlePlaceId} value={values.googlePlaceId} />
      <input type="hidden" name={names.googleMapsUrl} value={values.googleMapsUrl} />

      <div className="grid grid-2">
        <label className="stack-sm">
          <span className="label">Address Line 1</span>
          <input
            className="input"
            name={names.addressLine1}
            value={values.addressLine1}
            onChange={(event) => updateValues({ addressLine1: event.target.value })}
            autoComplete="address-line1"
          />
        </label>
        <label className="stack-sm">
          <span className="label">Address Line 2</span>
          <input
            className="input"
            name={names.addressLine2}
            value={values.addressLine2}
            onChange={(event) => updateValues({ addressLine2: event.target.value })}
            autoComplete="address-line2"
          />
        </label>
        <label className="stack-sm">
          <span className="label">City</span>
          <input
            className="input"
            name={names.city}
            value={values.city}
            onChange={(event) => updateValues({ city: event.target.value })}
            autoComplete="address-level2"
          />
        </label>
        <label className="stack-sm">
          <span className="label">State / Region</span>
          <input
            className="input"
            name={names.state}
            value={values.state}
            onChange={(event) => updateValues({ state: event.target.value })}
            autoComplete="address-level1"
          />
        </label>
        <label className="stack-sm">
          <span className="label">Postal Code</span>
          <input
            className="input"
            name={names.postalCode}
            value={values.postalCode}
            onChange={(event) => updateValues({ postalCode: event.target.value })}
            autoComplete="postal-code"
          />
        </label>
        <label className="stack-sm">
          <span className="label">Country</span>
          <input
            className="input"
            name={names.country}
            value={values.country}
            onChange={(event) => updateValues({ country: event.target.value })}
            autoComplete="country-name"
          />
        </label>
        {showContactFields ? (
          <>
            <label className="stack-sm">
              <span className="label">Hotel Phone</span>
              <input
                className="input"
                name={names.phone}
                value={values.phone}
                onChange={(event) => updateValues({ phone: event.target.value })}
                autoComplete="tel"
              />
            </label>
            <label className="stack-sm">
              <span className="label">Website</span>
              <input
                className="input"
                name={names.websiteUrl}
                value={values.websiteUrl}
                onChange={(event) => updateValues({ websiteUrl: event.target.value })}
                placeholder="https://"
                autoComplete="url"
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
