"use client";

import { useState, useTransition } from "react";

type AiRewriteTextareaProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
};

export function AiRewriteTextarea({
  label,
  name,
  defaultValue,
  placeholder,
  rows,
}: AiRewriteTextareaProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function rewriteText() {
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/rewrite-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, text: value }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Rewrite failed.");
        }

        setValue(String(payload.rewritten ?? ""));
        setMessage("Rewritten. Review before saving.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Rewrite failed.");
      }
    });
  }

  return (
    <label>
      <span
        className="label"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <span>{label}</span>
        <button
          type="button"
          className="btn btn-outline"
          onClick={rewriteText}
          disabled={isPending || value.trim().length === 0}
          style={{ fontSize: 12, padding: "5px 10px" }}
        >
          {isPending ? "Rewriting..." : "Rewrite"}
        </button>
      </span>
      <textarea
        className="textarea"
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
      {message ? (
        <span style={{ display: "block", marginTop: 5, color: "#667085", fontSize: 12 }}>
          {message}
        </span>
      ) : null}
    </label>
  );
}
