"use client";

import { useMemo, useState } from "react";

const replyTemplates = [
  {
    label: "Reviewing",
    body: "Thank you for the message. I am reviewing this and will follow up shortly.",
  },
  {
    label: "Trip Update Noted",
    body: "Thanks for the update. I have this noted on your trip file.",
  },
  {
    label: "Document Request",
    body: "Could you please upload the requested document when you have a moment? That will help me keep everything moving.",
  },
  {
    label: "Payment Link",
    body: "Your payment reminder is on my radar. Please let me know if you need the payment link resent.",
  },
  {
    label: "Passport Reminder",
    body: "When you have a moment, please review your passport details and upload a current passport image if you have not already done so.",
  },
  {
    label: "Warm Check-In",
    body: "Just checking in with you. Everything is moving along, and I will keep you posted as soon as I have the next update.",
  },
  {
    label: "Travel Circle Guidance",
    body: "Thanks for looping me in. I will review this Travel Circle conversation and respond with the next best step.",
  },
];

type AdminReplyFormProps = {
  threadId: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function AdminReplyForm({ threadId, action }: AdminReplyFormProps) {
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const characterCount = body.trim().length;

  const selectedBody = useMemo(
    () => replyTemplates.find((template) => template.label === selectedTemplate)?.body ?? "",
    [selectedTemplate],
  );

  function insertTemplate() {
    if (!selectedBody) return;
    setBody((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${selectedBody}` : selectedBody;
    });
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="thread_id" value={threadId} />

      <div
        className="card stack"
        style={{ background: "#f7fbfc", border: "1px solid #e6f0f2", padding: 14 }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 800, color: "var(--accent-dark)" }}>Saved Reply Templates</p>
          <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
            Choose a common reply, insert it into the message box, then personalize before sending.
          </p>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <label className="stack-sm" style={{ flex: "1 1 260px" }}>
            <span className="label">Template</span>
            <select
              className="select"
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
            >
              <option value="">Choose a saved reply</option>
              {replyTemplates.map((template) => (
                <option key={template.label} value={template.label}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn btn-outline"
            onClick={insertTemplate}
            disabled={!selectedBody}
            style={{ minHeight: 44 }}
          >
            Insert Template
          </button>
        </div>

        {selectedBody ? (
          <p style={{ margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
            Preview: {selectedBody}
          </p>
        ) : null}
      </div>

      <label className="stack-sm">
        <span className="label">Reply</span>
        <textarea
          className="textarea"
          name="body"
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Type your reply, or insert a saved template above..."
          required
        />
      </label>

      <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: "#667085", fontSize: 13 }}>
          {characterCount > 0 ? `${characterCount} character${characterCount === 1 ? "" : "s"}` : "No reply drafted yet"}
        </span>
        <button type="submit" className="btn btn-primary" disabled={characterCount === 0}>
          Send Reply
        </button>
      </div>
    </form>
  );
}
