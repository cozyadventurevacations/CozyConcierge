"use client";

import { useEffect, useMemo, useState } from "react";

type AirportOption = {
  id: number;
  iataCode: string | null;
  gpsCode: string | null;
  name: string;
  municipality: string | null;
  isoCountry: string | null;
  isoRegion: string | null;
  label: string;
  value: string;
};

export function AirportPicker({
  label,
  name,
  defaultValue,
  helper,
  required = false,
  placeholder = "Search by airport code, city, or airport name",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  helper?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [searchValue, setSearchValue] = useState(defaultValue ?? "");
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const query = useMemo(() => searchValue.trim(), [searchValue]);

  useEffect(() => {
    let isActive = true;

    async function loadAirports() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/airports?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load airports. Status: ${response.status}`);
        }

        const result = await response.json();

        if (isActive) {
          setAirports(result.airports ?? []);
        }
      } catch (error) {
        if (isActive) {
          setAirports([]);
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load airports.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(loadAirports, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  function selectAirport(airport: AirportOption) {
    setSearchValue(airport.label);
    setSelectedValue(airport.value);
    setHasFocus(false);
  }

  function handleChange(value: string) {
    setSearchValue(value);
    setSelectedValue(value);
    setHasFocus(true);
  }

  const shouldShowResults = hasFocus && query.length > 0;

  return (
    <div className="stack-sm">
      <label>
        <span className="label">{label}</span>

        <input
          className="input"
          type="text"
          value={searchValue}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setHasFocus(true)}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
        />
      </label>

      <input type="hidden" name={name} value={selectedValue} />

      {helper ? (
        <span style={{ color: "#667085", lineHeight: 1.45, fontSize: 13 }}>
          {helper}
        </span>
      ) : null}

      {shouldShowResults ? (
        <div
          style={{
            border: "1px solid #e6f0f2",
            borderRadius: 12,
            background: "white",
            overflow: "hidden",
            marginTop: 6,
          }}
        >
          {isLoading ? (
            <div style={{ padding: 12, color: "#667085" }}>
              Searching airports...
            </div>
          ) : errorMessage ? (
            <div style={{ padding: 12, color: "#b42318" }}>
              {errorMessage}
            </div>
          ) : airports.length === 0 ? (
            <div style={{ padding: 12, color: "#667085" }}>
              No airports found. You can still type and save a custom value.
            </div>
          ) : (
            airports.map((airport) => (
              <button
                key={airport.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAirport(airport);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: "white",
                  textAlign: "left",
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <strong>{airport.iataCode ?? airport.gpsCode}</strong>

                <span style={{ display: "block", color: "#334155", lineHeight: 1.4 }}>
                  {airport.name}
                </span>

                <span style={{ display: "block", color: "#667085", fontSize: 13 }}>
                  {[airport.municipality, airport.isoRegion, airport.isoCountry]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
