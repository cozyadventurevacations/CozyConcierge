"use client";

import { Children, ReactNode, useState } from "react";

type AirConnectionFlightsControlProps = {
  name: string;
  label: string;
  defaultValue: number;
  optionPrefix: string;
  children: ReactNode;
};

export function AirConnectionFlightsControl({
  name,
  label,
  defaultValue,
  optionPrefix,
  children,
}: AirConnectionFlightsControlProps) {
  const [connectionCount, setConnectionCount] = useState(defaultValue);

  return (
    <>
      <label>
        <span className="label">{label}</span>
        <select
          className="select"
          name={name}
          value={String(connectionCount)}
          onChange={(event) => setConnectionCount(Number(event.target.value) || 0)}
        >
          <option value="0">No {optionPrefix} connecting flights</option>
          <option value="1">1 {optionPrefix} connecting flight</option>
          <option value="2">2 {optionPrefix} connecting flights</option>
          <option value="3">3 {optionPrefix} connecting flights</option>
        </select>
      </label>

      {Children.map(children, (child, index) => (
        <fieldset
          disabled={index >= connectionCount}
          style={{
            border: 0,
            display: index < connectionCount ? "block" : "none",
            margin: 0,
            padding: 0,
          }}
        >
          {child}
        </fieldset>
      ))}
    </>
  );
}
