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
  placeholder = "Search by airport code, city, or airport name",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  helper?: string;
  placeholder?: string;
}) {
  const [searchValue, setSearchValue] = useState(defaultValue ?? "");
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const query = useMemo(() => searchValue.trim(), [searchValue]);

  useEffect(() => {
    let isActive = true;

    async function loadAirports() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/airports?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
          throw new Error("Unable to load airports.");
        }

        const result = await response.json();

        if (isActive) {
          setAirports(result.airports ?? []);
        }
      } catch {
        if (isActive) {
          setAirports([]);
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
    setIsOpen(false);
  }

  function handleChange(value: string) {
    setSearchValue(value);
    setSelectedValue(value);
    setIsOpen(true);
  }

  return (
    <div className="stack-sm" style={{ position: "relative" }}>
      <label>
        <span className="label">{label}</span>

        <input
          className="input"
          type="text"
          value={searchValue}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
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

      {isOpen ? (
        <>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10,
              background: "transparent",
              border: "none",
              cursor: "default",
            }}
            aria-label="Close airport results"
          />

          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 20,
              marginTop: 6,
              border: "1px solid #e6f0f2",
              borderRadius: 12,
              background: "white",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
              overflow: "hidden",
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {isLoading ? (
              <div style={{ padding: 12, color: "#667085" }}>
                Searching airports...
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
                  onClick={() => selectAirport(airport)}
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
                      .join(", ")}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}