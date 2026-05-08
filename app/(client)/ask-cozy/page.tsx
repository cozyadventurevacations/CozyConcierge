"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterQuestions = [
  "What should I double-check 30 days before travel?",
  "What should I pack in my carry-on?",
  "What questions should I ask before final payment?",
  "How should I prepare for traveling with a group?",
];

function AskCozyContent() {
  const searchParams = useSearchParams();
  const questionFromDashboard = searchParams.get("question") ?? "";
  const hasAutoSubmitted = useRef(false);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Ask Cozy. I can help with general travel questions, trip prep, packing reminders, and what to ask your advisor. For account-specific details, payment links, documents, or private trip information, please use Concierge Messages.",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          <strong>Important:</strong> Ask Cozy cannot see your private trip details,
          payment records, passport uploads, traveler numbers, or documents yet. For
          anything specific to your booking, use Concierge Messages.
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
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
        <h2 style={{ margin: 0 }}>
          Conversation {isSubmitting ? "— Asking Cozy..." : ""}
        </h2>

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