"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchRevision, setSearchRevision] = useState(0);
  const searchControllerRef = useRef<AbortController | null>(null);
  const detailsControllerRef = useRef<AbortController | null>(null);

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
    return () => {
      searchControllerRef.current?.abort();
      detailsControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionBoxOpen(false);
        searchControllerRef.current?.abort();
        setIsSearching(false);
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

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
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
      if (controller.signal.aborted) return;
      setIsSearching(true);

      try {
        const response = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input }),
          signal: controller.signal,
        });

        const data = await response.json();
        if (controller.signal.aborted) return;

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

        setActiveIndex(-1);
        setSuggestions(nextSuggestions);
        setIsSuggestionBoxOpen(nextSuggestions.length > 0);
        setStatusMessage(null);
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setIsSuggestionBoxOpen(false);
        setStatusMessage(
          "Address suggestions could not be loaded. You can still enter your address manually.",
        );
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [addressLine1, hasUserTyped, hasSelectedSuggestion, searchRevision]);

  async function handleSelectSuggestion(suggestion: Suggestion) {
    searchControllerRef.current?.abort();
    detailsControllerRef.current?.abort();
    const controller = new AbortController();
    detailsControllerRef.current = controller;
    setHasSelectedSuggestion(true);
    setHasUserTyped(false);
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
        signal: controller.signal,
      });

      const data = await response.json();
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setStatusMessage(
          data.error ?? "Address details could not be loaded. Please review the address manually.",
        );
        return;
      }

      const address = data.address as AddressDetails;

      // Replace every field so a partial result cannot retain the previous address.
      setAddressLine1(address.addressLine1 ?? "");
      setCity(address.city ?? "");
      setState(address.state ?? "");
      setPostalCode(address.postalCode ?? "");

      setSuggestions([]);
      setIsSuggestionBoxOpen(false);
      setIsSearching(false);
      setStatusMessage("Address details filled in. Please review them before saving.");
    } catch {
      if (controller.signal.aborted) return;
      setSuggestions([]);
      setIsSuggestionBoxOpen(false);
      setIsSearching(false);
      setStatusMessage("Address details could not be loaded. Please review the address manually.");
    }
  }

  function handleAddressLine1Change(value: string) {
    searchControllerRef.current?.abort();
    detailsControllerRef.current?.abort();
    setSuggestions([]);
    setActiveIndex(-1);
    setIsSuggestionBoxOpen(false);
    setStatusMessage(null);
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
    if (!hasUserTyped || hasSelectedSuggestion) return;

    if (suggestions.length > 0) {
      setIsSuggestionBoxOpen(true);
    } else if (addressLine1.trim().length >= 3 && searchControllerRef.current?.signal.aborted) {
      setSearchRevision((revision) => revision + 1);
    }
  }

  function handleAddressLine1KeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      searchControllerRef.current?.abort();
      setIsSearching(false);
      setIsSuggestionBoxOpen(false);
    } else if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsSuggestionBoxOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsSuggestionBoxOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && isSuggestionBoxOpen && activeIndex >= 0) {
      event.preventDefault();
      void handleSelectSuggestion(suggestions[activeIndex]);
    }
  }

  function handleManualDetailChange() {
    detailsControllerRef.current?.abort();
    setStatusMessage(null);
  }

  return (
    <div
      ref={wrapperRef}
      className="stack"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          searchControllerRef.current?.abort();
          setIsSearching(false);
          setIsSuggestionBoxOpen(false);
        }
      }}
    >
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
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isSuggestionBoxOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isSuggestionBoxOpen && activeIndex >= 0 ? listboxId + "-" + activeIndex : undefined
          }
          required={required}
        />

        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
          {helperText}
        </p>

        {isSuggestionBoxOpen && suggestions.length > 0 ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Address suggestions"
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
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId}
                type="button"
                id={listboxId + "-" + index}
                role="option"
                aria-selected={activeIndex === index}
                tabIndex={-1}
                onClick={() => void handleSelectSuggestion(suggestion)}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  border: 0,
                  background: activeIndex === index ? "#eef6f8" : "#ffffff",
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
          onChange={(event) => {
            handleManualDetailChange();
            setAddressLine2(event.target.value);
          }}
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
            onChange={(event) => {
              handleManualDetailChange();
              setCity(event.target.value);
            }}
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
            onChange={(event) => {
              handleManualDetailChange();
              setState(event.target.value);
            }}
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
            onChange={(event) => {
              handleManualDetailChange();
              setPostalCode(event.target.value);
            }}
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
        <p role="status" style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
