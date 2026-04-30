"use client";

import { useEffect, useRef, useState } from "react";

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type PlaceResult = {
  address_components?: AddressComponent[];
  formatted_address?: string;
};

type AutocompleteListener = {
  remove?: () => void;
};

type PlacesAutocomplete = {
  addListener: (
    eventName: "place_changed",
    handler: () => void,
  ) => AutocompleteListener;
  getPlace: () => PlaceResult;
};

type GoogleMapsWindow = Window &
  typeof globalThis & {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: {
              fields?: string[];
              types?: string[];
              componentRestrictions?: { country: string | string[] };
            },
          ) => PlacesAutocomplete;
        };
      };
    };
  };

type AddressAutocompleteProps = {
  addressLine1Default?: string | null;
  addressLine2Default?: string | null;
  cityDefault?: string | null;
  stateDefault?: string | null;
  postalCodeDefault?: string | null;
};

function getComponent(place: PlaceResult, type: string, useShortName = false) {
  const component = place.address_components?.find((item) =>
    item.types.includes(type),
  );

  if (!component) return "";

  return useShortName ? component.short_name : component.long_name;
}

function buildStreetAddress(place: PlaceResult) {
  const streetNumber = getComponent(place, "street_number");
  const route = getComponent(place, "route");

  return [streetNumber, route].filter(Boolean).join(" ").trim();
}

function loadGoogleMapsScript(apiKey: string) {
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-google-maps-places="true"]',
  );

  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      const googleWindow = window as GoogleMapsWindow;

      if (googleWindow.google?.maps?.places?.Autocomplete) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps script failed to load.")),
        { once: true },
      );
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = "true";

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Maps script failed to load."));

    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  addressLine1Default,
  addressLine2Default,
  cityDefault,
  stateDefault,
  postalCodeDefault,
}: AddressAutocompleteProps) {
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<PlacesAutocomplete | null>(null);

  const [addressLine1, setAddressLine1] = useState(addressLine1Default ?? "");
  const [addressLine2, setAddressLine2] = useState(addressLine2Default ?? "");
  const [city, setCity] = useState(cityDefault ?? "");
  const [state, setState] = useState(stateDefault ?? "");
  const [postalCode, setPostalCode] = useState(postalCodeDefault ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let listener: AutocompleteListener | null = null;
    let isMounted = true;

    async function setupAutocomplete() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setStatusMessage(
          "Address autocomplete is not configured yet. You can still enter your address manually.",
        );
        return;
      }

      try {
        await loadGoogleMapsScript(apiKey);

        if (!isMounted || !addressInputRef.current) return;

        const googleWindow = window as GoogleMapsWindow;
        const Autocomplete = googleWindow.google?.maps?.places?.Autocomplete;

        if (!Autocomplete) {
          setStatusMessage(
            "Address autocomplete could not be loaded. You can still enter your address manually.",
          );
          return;
        }

        autocompleteRef.current = new Autocomplete(addressInputRef.current, {
          fields: ["address_components", "formatted_address"],
          types: ["address"],
          componentRestrictions: { country: "us" },
        });

        listener = autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();

          if (!place) return;

          const streetAddress = buildStreetAddress(place);
          const locality =
            getComponent(place, "locality") ||
            getComponent(place, "sublocality") ||
            getComponent(place, "postal_town");
          const administrativeArea = getComponent(
            place,
            "administrative_area_level_1",
            true,
          );
          const postal = getComponent(place, "postal_code");

          if (streetAddress) setAddressLine1(streetAddress);
          if (locality) setCity(locality);
          if (administrativeArea) setState(administrativeArea);
          if (postal) setPostalCode(postal);

          setStatusMessage(
            "Address details filled in. Please review them before saving.",
          );
        });
      } catch {
        if (!isMounted) return;

        setStatusMessage(
          "Address autocomplete could not be loaded. You can still enter your address manually.",
        );
      }
    }

    setupAutocomplete();

    return () => {
      isMounted = false;
      listener?.remove?.();
    };
  }, []);

  return (
    <div className="stack">
      <label className="stack-sm">
        <span className="label">Address Line 1</span>
        <input
          ref={addressInputRef}
          className="input"
          name="address_line_1"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
          placeholder="Start typing your street address"
          autoComplete="address-line1"
        />
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          Start typing your address, then choose the best match from the list.
        </span>
      </label>

      <label className="stack-sm">
        <span className="label">Address Line 2</span>
        <input
          className="input"
          name="address_line_2"
          value={addressLine2}
          onChange={(event) => setAddressLine2(event.target.value)}
          placeholder="Apartment, suite, unit, etc."
          autoComplete="address-line2"
        />
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          Apartment/unit details may not auto-fill. Please add them manually.
        </span>
      </label>

      <div className="grid grid-3">
        <label className="stack-sm">
          <span className="label">City</span>
          <input
            className="input"
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
          />
        </label>

        <label className="stack-sm">
          <span className="label">State</span>
          <input
            className="input"
            name="state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            autoComplete="address-level1"
          />
        </label>

        <label className="stack-sm">
          <span className="label">Postal Code</span>
          <input
            className="input"
            name="postal_code"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            autoComplete="postal-code"
          />
        </label>
      </div>

      {statusMessage ? (
        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
            color: "#667085",
            lineHeight: 1.6,
          }}
        >
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
