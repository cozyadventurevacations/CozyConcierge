"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SafeTripOption = {
  id: string;
  label: string;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  access_type: "primary" | "shared";
};

const starterQuestions = [
  "What should I double-check 30 days before travel?",
  "What should I pack in my carry-on?",
  "What questions should I ask before final payment?",
  "How should I prepare for traveling with a group?",
];

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I’m Ask Cozy. I can help with general travel questions, trip prep, packing reminders, and what to ask your advisor. You can also select a trip so I can use safe high-level context like destination and travel dates.",
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTripOptionLabel(trip: SafeTripOption) {
  const dates =
    trip.departure_date || trip.return_date
      ? ` (${formatDateLabel(trip.departure_date)} → ${formatDateLabel(
          trip.return_date,
        )})`
      : "";

  const sharedLabel = trip.access_type === "shared" ? " • Shared" : "";

  return `${trip.label}${trip.destinations ? ` — ${trip.destinations}` : ""}${dates}${sharedLabel}`;
}

function getConversationTimestamp() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AskCozyContent() {
  const searchParams = useSearchParams();
  const questionFromDashboard = searchParams.get("question") ?? "";
  const hasAutoSubmitted = useRef(false);

  const [question, setQuestion] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [availableTrips, setAvailableTrips] = useState<SafeTripOption[]>([]);
  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [conversationStartedAt, setConversationStartedAt] = useState(
    getConversationTimestamp(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetConversation() {
    setMessages([welcomeMessage]);
    setQuestion("");
    setErrorMessage(null);
    setConversationStartedAt(getConversationTimestamp());
  }

  async function loadTrips() {
    setIsLoadingTrips(true);
    setTripLoadError(null);

    try {
      const response = await fetch("/api/ask-cozy/trips", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load trips.");
      }

      setAvailableTrips(data.trips ?? []);
    } catch (error) {
      setTripLoadError(
        error instanceof Error ? error.message : "Could not load trips.",
      );
    } finally {
      setIsLoadingTrips(false);
    }
  }

  async function askCozy(nextQuestion?: string) {
    const messageToSend = String(nextQuestion ?? question).trim();

    if (!messageToSend) {
      setErrorMessage("Please enter a question.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setQuestion("");

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        role: "user",
        content: messageToSend,
      },
    ]);

    try {
      const response = await fetch("/api/ask-cozy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageToSend,
          tripId: selectedTripId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Ask Cozy could not answer that.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: data.answer ?? "I’m sorry, I could not answer that.",
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ask Cozy had trouble answering that.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    void loadTrips();
  }, []);

  useEffect(() => {
    const cleanQuestion = questionFromDashboard.trim();

    if (!cleanQuestion || hasAutoSubmitted.current) {
      return;
    }

    hasAutoSubmitted.current = true;
    setQuestion(cleanQuestion);
    void askCozy(cleanQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionFromDashboard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await askCozy();
  }

  const selectedTrip = selectedTripId
    ? availableTrips.find((trip) => trip.id === selectedTripId) ?? null
    : null;

  const hasConversationMessages = messages.length > 1;

  return (
    <PageShell
      title="Ask Cozy"
      subtitle="Your Cozy Concierge AI helper for general travel questions and trip preparation."
    >
      <div
        className="card stack"
        style={{
          border: "1px solid #e6f0f2",
          background: "linear-gradient(135deg, #f7fbfc 0%, #ffffff 72%)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: 800,
          }}
        >
          Cozy Concierge AI
        </p>

        <h2 style={{ margin: 0 }}>How can I help?</h2>

        <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
          Ask general travel questions, get packing reminders, prepare for your trip,
          or figure out what to ask your advisor next.
        </p>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          <strong>Important:</strong> Ask Cozy can use safe high-level trip context
          if you choose a trip, but it cannot see payment records, passport uploads,
          traveler numbers, private documents, or confirmation numbers.
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Trip Context</h2>

          <label className="stack-sm">
            <span className="label">Optional Trip</span>
            <select
              className="select"
              value={selectedTripId}
              onChange={(event) => setSelectedTripId(event.target.value)}
              disabled={isLoadingTrips}
            >
              <option value="">
                {isLoadingTrips ? "Loading trips..." : "General travel question"}
              </option>

              {availableTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {getTripOptionLabel(trip)}
                </option>
              ))}
            </select>
          </label>

          {tripLoadError ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                color: "#be123c",
                lineHeight: 1.6,
              }}
            >
              {tripLoadError}
            </div>
          ) : null}

          {selectedTrip ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                color: "#667085",
                lineHeight: 1.6,
              }}
            >
              <strong>{selectedTrip.label}</strong>
              <br />
              {selectedTrip.destinations ?? "Destination not provided"}
              <br />
              {formatDateLabel(selectedTrip.departure_date)} →{" "}
              {formatDateLabel(selectedTrip.return_date)}
            </div>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
                color: "#667085",
                lineHeight: 1.6,
              }}
            >
              Choose a trip for more helpful answers, or leave this as a general travel question.
            </div>
          )}

          <h2 style={{ margin: 0 }}>Starter Questions</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {starterQuestions.map((starterQuestion) => (
              <button
                key={starterQuestion}
                type="button"
                className="btn btn-primary"
                onClick={() => askCozy(starterQuestion)}
                disabled={isSubmitting}
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  whiteSpace: "normal",
                }}
              >
                {starterQuestion}
              </button>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Ask a Question</h2>

          <form onSubmit={handleSubmit} className="stack">
            <label className="stack-sm">
              <span className="label">Your Question</span>
              <textarea
                className="textarea"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={5}
                placeholder="Example: What should I pack in my carry-on for a cruise?"
              />
            </label>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Asking Cozy..." : "Ask Cozy"}
            </button>
          </form>

          {errorMessage ? (
            <div
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                color: "#be123c",
                lineHeight: 1.6,
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Conversation {isSubmitting ? "— Asking Cozy..." : ""}
            </h2>

            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.5 }}>
              Started {conversationStartedAt}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={resetConversation}
              disabled={isSubmitting}
            >
              New Conversation
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={resetConversation}
              disabled={isSubmitting || !hasConversationMessages}
              style={{
                background: "#ffffff",
                color: "#b42318",
                border: "1px solid #fecaca",
              }}
            >
              Delete Conversation
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "12px",
            borderRadius: 12,
            background: "#f7fbfc",
            border: "1px solid #e6f0f2",
            color: "#667085",
            lineHeight: 1.6,
          }}
        >
          Conversations are not saved permanently yet. Starting a new conversation
          or deleting this one clears the current chat from this page.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {messages.map((message, index) => {
            const isUser = message.role === "user";

            return (
              <div
                key={`${message.role}-${index}`}
                style={{
                  justifySelf: isUser ? "end" : "start",
                  maxWidth: "82%",
                  padding: "12px",
                  borderRadius: 14,
                  border: "1px solid #e6f0f2",
                  background: isUser ? "#f0f7f8" : "#ffffff",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: 900,
                    color: "var(--accent-dark)",
                  }}
                >
                  {isUser ? "You" : "Ask Cozy"}
                </p>

                <p
                  style={{
                    margin: "6px 0 0",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {message.content}
                </p>
              </div>
            );
          })}

          {isSubmitting ? (
            <div
              style={{
                justifySelf: "start",
                maxWidth: "82%",
                padding: "12px",
                borderRadius: 14,
                border: "1px solid #e6f0f2",
                background: "#ffffff",
                color: "#667085",
              }}
            >
              Ask Cozy is thinking...
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function AskCozyFallback() {
  return (
    <PageShell
      title="Ask Cozy"
      subtitle="Loading your Cozy Concierge AI helper."
    >
      <div className="card">
        <p style={{ margin: 0, color: "#667085" }}>Loading Ask Cozy...</p>
      </div>
    </PageShell>
  );
}

export default function AskCozyPage() {
  return (
    <Suspense fallback={<AskCozyFallback />}>
      <AskCozyContent />
    </Suspense>
  );
}