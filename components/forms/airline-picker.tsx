"use client";

import { useEffect, useMemo, useState } from "react";

type AirlineOption = {
  id: number;
  name: string;
  alias: string | null;
  iataCode: string | null;
  icaoCode: string | null;
  callsign: string | null;
  country: string | null;
  active: string | null;
  label: string;
  value: string;
};

export function AirlinePicker({
  label,
  name,
  defaultValue,
  helper,
  placeholder = "Search by airline code or airline name",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  helper?: string;
  placeholder?: string;
}) {
  const [searchValue, setSearchValue] = useState(defaultValue ?? "");
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const [airlines, setAirlines] = useState<AirlineOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const query = useMemo(() => searchValue.trim(), [searchValue]);

  useEffect(() => {
    let isActive = true;

    async function loadAirlines() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/airlines?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load airlines. Status: ${response.status}`);
        }

        const result = await response.json();

        if (isActive) {
          setAirlines(result.airlines ?? []);
        }
      } catch (error) {
        if (isActive) {
          setAirlines([]);
          setErrorMessage(error instanceof Error ? error.message : "Unable to load airlines.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(loadAirlines, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  function selectAirline(airline: AirlineOption) {
    setSearchValue(airline.label);
    setSelectedValue(airline.value);
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
              Searching airlines...
            </div>
          ) : errorMessage ? (
            <div style={{ padding: 12, color: "#b42318" }}>
              {errorMessage}
            </div>
          ) : airlines.length === 0 ? (
            <div style={{ padding: 12, color: "#667085" }}>
              No airlines found. You can still type and save a custom value.
            </div>
          ) : (
            airlines.map((airline) => (
              <button
                key={airline.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAirline(airline);
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
                <strong>{airline.iataCode ?? airline.icaoCode}</strong>
                <span style={{ display: "block", color: "#334155", lineHeight: 1.4 }}>
                  {airline.name}
                </span>
                <span style={{ display: "block", color: "#667085", fontSize: 13 }}>
                  {[airline.icaoCode, airline.callsign, airline.country]
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