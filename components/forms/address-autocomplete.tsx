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

type AddressFieldNames = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type AddressAutocompleteProps = {
  addressLine1Default?: string | null;
  addressLine2Default?: string | null;
  cityDefault?: string | null;
  stateDefault?: string | null;
  postalCodeDefault?: string | null;
  fieldNames?: AddressFieldNames;
  addressLine1Label?: string;
  helperText?: string;
  required?: boolean;
};

export function AddressAutocomplete({
  addressLine1Default,
  addressLine2Default,
  cityDefault,
  stateDefault,
  postalCodeDefault,
  fieldNames,
  addressLine1Label = "Address Line 1",
  helperText = "Start typing your address, then choose the best match from the list.",
  required = false,
}: AddressAutocompleteProps) {
  const names = {
    addressLine1: fieldNames?.addressLine1 ?? "address_line_1",
    addressLine2: fieldNames?.addressLine2 ?? "address_line_2",
    city: fieldNames?.city ?? "city",
    state: fieldNames?.state ?? "state",
    postalCode: fieldNames?.postalCode ?? "postal_code",
  };

  const [addressLine1, setAddressLine1] = useState(addressLine1Default ?? "");
  const [addressLine2, setAddressLine2] = useState(addressLine2Default ?? "");
  const [city, setCity] = useState(cityDefault ?? "");
  const [state, setState] = useState(stateDefault ?? "");
  const [postalCode, setPostalCode] = useState(postalCodeDefault ?? "");

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const [isSuggestionBoxOpen, setIsSuggestionBoxOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionBoxOpen(false);
        setSuggestions([]);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const input = addressLine1.trim();

    if (!hasUserTyped || hasSelectedSuggestion) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (input.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setIsSuggestionBoxOpen(false);
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
          setIsSuggestionBoxOpen(false);
          setStatusMessage(
            data.error ??
              "Address suggestions could not be loaded. You can still enter your address manually.",
          );
          return;
        }

        const nextSuggestions = (data.suggestions ?? []) as Suggestion[];

        setSuggestions(nextSuggestions);
        setIsSuggestionBoxOpen(nextSuggestions.length > 0);
        setStatusMessage(null);
      } catch {
        setSuggestions([]);
        setIsSuggestionBoxOpen(false);
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
  }, [addressLine1, hasUserTyped, hasSelectedSuggestion]);

  async function handleSelectSuggestion(suggestion: Suggestion) {
    setHasSelectedSuggestion(true);
    setHasUserTyped(false);
    setAddressLine1(suggestion.text);
    setSuggestions([]);
    setIsSuggestionBoxOpen(false);

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
          data.error ?? "Address details could not be loaded. Please review the address manually.",
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
      setIsSuggestionBoxOpen(false);
      setIsSearching(false);
      setStatusMessage("Address details filled in. Please review them before saving.");
    } catch {
      setSuggestions([]);
      setIsSuggestionBoxOpen(false);
      setIsSearching(false);
      setStatusMessage("Address details could not be loaded. Please review the address manually.");
    }
  }

  function handleAddressLine1Change(value: string) {
    setHasUserTyped(true);
    setHasSelectedSuggestion(false);
    setAddressLine1(value);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setIsSuggestionBoxOpen(false);
    }
  }

  function handleAddressLine1Focus() {
    if (suggestions.length > 0 && hasUserTyped && !hasSelectedSuggestion) {
      setIsSuggestionBoxOpen(true);
    }
  }

  function handleAddressLine1KeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsSuggestionBoxOpen(false);
      setSuggestions([]);
    }
  }

  return (
    <div ref={wrapperRef} className="stack">
      <div className="stack-sm" style={{ position: "relative" }}>
        <label className="label" htmlFor={names.addressLine1}>
          {addressLine1Label}
        </label>

        <input
          id={names.addressLine1}
          className="input"
          name={names.addressLine1}
          value={addressLine1}
          onChange={(event) => handleAddressLine1Change(event.target.value)}
          onFocus={handleAddressLine1Focus}
          onKeyDown={handleAddressLine1KeyDown}
          placeholder="Start typing your street address"
          autoComplete="address-line1"
          required={required}
        />

        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
          {helperText}
        </p>

        {isSuggestionBoxOpen && suggestions.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 50,
              border: "1px solid #d9e6ea",
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
              overflow: "hidden",
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
          name={names.addressLine2}
          value={addressLine2}
          onChange={(event) => setAddressLine2(event.target.value)}
          placeholder="Apartment, suite, unit, etc."
          autoComplete="address-line2"
        />
        <span style={{ color: "#64748b", fontSize: 13 }}>
          Apartment/unit details may not auto-fill. Please add them manually.
        </span>
      </label>

      <div className="grid grid-3">
        <label className="stack-sm">
          <span className="label">City</span>
          <input
            className="input"
            name={names.city}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
            required={required}
          />
        </label>

        <label className="stack-sm">
          <span className="label">State</span>
          <input
            className="input"
            name={names.state}
            value={state}
            onChange={(event) => setState(event.target.value)}
            autoComplete="address-level1"
            required={required}
          />
        </label>

        <label className="stack-sm">
          <span className="label">Postal Code</span>
          <input
            className="input"
            name={names.postalCode}
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            autoComplete="postal-code"
            required={required}
          />
        </label>
      </div>

      {isSearching ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Searching for address matches...
        </p>
      ) : null}

      {statusMessage ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
