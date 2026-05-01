"use client";

import { useState } from "react";

type SensitiveFieldProps = {
  value: string | number | null | undefined;
  emptyLabel?: string;
};

export function SensitiveField({
  value,
  emptyLabel = "Not provided",
}: SensitiveFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (value === null || value === undefined || value === "") {
    return <>{emptyLabel}</>;
  }

  const displayValue = String(value);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: isVisible ? "inherit" : "monospace",
          letterSpacing: isVisible ? "normal" : "0.08em",
        }}
      >
        {isVisible ? displayValue : "••••••••••"}
      </span>

      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? "Hide sensitive value" : "Show sensitive value"}
        style={{
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          borderRadius: 999,
          padding: "3px 8px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          color: "#334155",
          lineHeight: 1.2,
        }}
      >
        {isVisible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
