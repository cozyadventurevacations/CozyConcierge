"use client";

import { useState } from "react";

export function ComponentDocumentUploadSubmitButton({
  formId,
  componentLabel,
}: {
  formId: string;
  componentLabel: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <button
      type="submit"
      className="btn btn-outline"
      form={formId}
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      onClick={() => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (form && !form.reportValidity()) return;
        window.setTimeout(() => setIsSubmitting(true), 0);
      }}
      style={{
        alignSelf: "flex-start",
        opacity: isSubmitting ? 0.72 : 1,
        cursor: isSubmitting ? "wait" : "pointer",
      }}
    >
      {isSubmitting
        ? `Uploading and extracting ${componentLabel}...`
        : `Upload & Extract to ${componentLabel}`}
    </button>
  );
}
