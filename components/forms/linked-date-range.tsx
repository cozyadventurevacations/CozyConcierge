"use client";

import { useState } from "react";

type LinkedDateRangeProps = {
  startName: string;
  endName: string;
  startLabel: string;
  endLabel: string;
  startDefaultValue?: string | null;
  endDefaultValue?: string | null;
  required?: boolean;
};

function cleanDate(value: string | null | undefined) {
  return value ?? "";
}

export function LinkedDateRange({
  startName,
  endName,
  startLabel,
  endLabel,
  startDefaultValue,
  endDefaultValue,
  required = false,
}: LinkedDateRangeProps) {
  const initialStartDate = cleanDate(startDefaultValue);
  const initialEndDate = cleanDate(endDefaultValue) || initialStartDate;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [endDateEdited, setEndDateEdited] = useState(Boolean(cleanDate(endDefaultValue)));

  return (
    <>
      <label className="stack-sm">
        <span className="label">{startLabel}</span>
        <input
          className="input"
          type="date"
          name={startName}
          value={startDate}
          onChange={(event) => {
            const nextStartDate = event.target.value;
            setStartDate(nextStartDate);

            if (!endDateEdited || !endDate) {
              setEndDate(nextStartDate);
            }
          }}
          required={required}
        />
      </label>

      <label className="stack-sm">
        <span className="label">{endLabel}</span>
        <input
          className="input"
          type="date"
          name={endName}
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => {
            setEndDateEdited(true);
            setEndDate(event.target.value);
          }}
          required={required}
        />
      </label>
    </>
  );
}
