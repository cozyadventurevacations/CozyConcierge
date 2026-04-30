"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  placeId: string;
  text: string;
};

type AddressDetails = {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  formattedAddress: string;
};

type AddressAutocompleteProps = {
  addressLine1Default?: string | null;
  addressLine2Default?: string | null;
  cityDefault?: string | null;
  stateDefault?: string | null;
  postalCodeDefault?: string | null;
};

export function AddressAutocomplete({
  addressLine1Default,
  addressLine2Default,
  cityDefault,
  stateDefault,
  postalCodeDefault,
}: AddressAutocompleteProps) {
  const [addressLine1, setAddressLine1] = useState(addressLine1Default ?? "");
  const [addressLine2, setAddressLine2] = useState(addressLine2Default ?? "");
  const [city, setCity] = useState(cityDefault ?? "");
  const [state, setState] = useState(stateDefault ?? "");
  const [postalCode, setPostalCode] = useState(postalCodeDefault ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const input = addressLine1.trim();

    if (hasSelectedSuggestion) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (input.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input }),
        });

        const data = await response.json();

        if (!response.ok) {
          setSuggestions([]);
          setStatusMessage(
            data.error ??
              "Address suggestions could not be loaded. You can still enter your address manually.",
          );
          return;
        }

        setSuggestions(data.suggestions ?? []);
        setStatusMessage(null);
      } catch {
        setSuggestions([]);
        setStatusMessage(
          "Address suggestions could not be loaded. You can still enter your address manually.",
        );
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [addressLine1, hasSelectedSuggestion]);

  async function handleSelectSuggestion(suggestion: Suggestion) {
    setHasSelectedSuggestion(true);
    setAddressLine1(suggestion.text);
    setSuggestions([]);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsSearching(false);
    setStatusMessage("Loading address details...");

    try {
      const response = await fetch("/api/places/details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(
          data.error ??
            "Address details could not be loaded. Please review the address manually.",
        );
        return;
      }

      const address = data.address as AddressDetails;

      if (address.addressLine1) {
        setAddressLine1(address.addressLine1);
      }

      if (address.city) {
        setCity(address.city);
      }

      if (address.state) {
        setState(address.state);
      }

      if (address.postalCode) {
        setPostalCode(address.postalCode);
      }

      setSuggestions([]);
      setIsSearching(false);
      setStatusMessage(
        "Address details filled in. Please review them before saving.",
      );
    } catch {
      setSuggestions([]);
      setIsSearching(false);
      setStatusMessage(
        "Address details could not be loaded. Please review the address manually.",
      );
    }
  }

  function handleAddressLine1Change(value: string) {
    setHasSelectedSuggestion(false);
    setAddressLine1(value);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
    }
  }

  return (
    <div className="stack">
      <div style={{ position: "relative" }}>
        <label className="stack-sm">
          <span className="label">Address Line 1</span>
          <input
            className="input"
            name="address_line_1"
            value={addressLine1}
            onChange={(event) => handleAddressLine1Change(event.target.value)}
            onBlur={() => {
              setTimeout(() => {
                setSuggestions([]);
              }, 150);
            }}
            placeholder="Start typing your street address"
            autoComplete="address-line1"
          />
          <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
            Start typing your address, then choose the best match from the list.
          </span>
        </label>

        {suggestions.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 20,
              background: "#ffffff",
              border: "1px solid #d0d5dd",
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(16, 24, 40, 0.12)",
              overflow: "hidden",
              marginTop: 6,
            }}
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelectSuggestion(suggestion);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  border: 0,
                  background: "#ffffff",
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--text)",
                  borderBottom: "1px solid #eef2f5",
                }}
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        ) : null}
      </div>

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

      {isSearching ? (
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
          Searching for address matches...
        </div>
      ) : null}

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