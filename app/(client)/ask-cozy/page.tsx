"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string | null;
};

type SavedThread = {
  id: string;
  trip_id: string | null;
  title: string;
  status: string;
  retention_until: string | null;
  created_at: string | null;
  updated_at: string | null;
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

const starterQuestionGroups = [
  {
    title: "Trip Prep",
    questions: [
      "What should I double-check 30 days before travel?",
      "What should I do the week before departure?",
    ],
  },
  {
    title: "Packing",
    questions: [
      "What should I pack in my carry-on?",
      "What should I keep out of checked luggage?",
    ],
  },
  {
    title: "Travel Circle",
    questions: [
      "How should I prepare for traveling with a group?",
      "What should everyone in my travel group know before departure?",
    ],
  },
  {
    title: "Advisor Questions",
    questions: [
      "What questions should I ask before final payment?",
      "What should I confirm with my advisor before travel?",
    ],
  },
];

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I am Ask Cozy. I can help with general travel questions, trip prep, packing reminders, and what to ask your advisor. Select a trip when you want me to use safe high-level context like destination and travel dates.",
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

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTripOptionLabel(trip: SafeTripOption) {
  const dates =
    trip.departure_date || trip.return_date
      ? ` (${formatDateLabel(trip.departure_date)} â†’ ${formatDateLabel(
          trip.return_date,
        )})`
      : "";

  const sharedLabel = trip.access_type === "shared" ? " â€¢ Shared" : "";

  return `${trip.label}${trip.destinations ? ` â€” ${trip.destinations}` : ""}${dates}${sharedLabel}`;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionFromDashboard = searchParams.get("question") ?? "";
  const tripIdFromTripPage = searchParams.get("tripId") ?? "";

  const hasAutoSubmitted = useRef(false);
  const hasPreselectedTrip = useRef(false);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [availableTrips, setAvailableTrips] = useState<SafeTripOption[]>([]);
  const [savedThreads, setSavedThreads] = useState<SavedThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThreadRetentionUntil, setActiveThreadRetentionUntil] =
    useState<string | null>(null);
  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const [conversationStartedAt, setConversationStartedAt] = useState(
    getConversationTimestamp(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingThreadDetail, setIsLoadingThreadDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function scrollToConversationEnd() {
    window.setTimeout(() => {
      conversationEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);
  }

  function resetConversation() {
    setMessages([welcomeMessage]);
    setQuestion("");
    setErrorMessage(null);
    setActiveThreadId(null);
    setActiveThreadRetentionUntil(null);
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

  async function loadThreads() {
    setIsLoadingThreads(true);
    setThreadLoadError(null);

    try {
      const response = await fetch("/api/ask-cozy/threads", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load Ask Cozy conversations.");
      }

      setSavedThreads(data.threads ?? []);
    } catch (error) {
      setThreadLoadError(
        error instanceof Error
          ? error.message
          : "Could not load Ask Cozy conversations.",
      );
    } finally {
      setIsLoadingThreads(false);
    }
  }

  async function loadThread(threadId: string) {
    setIsLoadingThreadDetail(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/ask-cozy/threads/${threadId}`, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load this conversation.");
      }

      setActiveThreadId(data.thread.id);
      setSelectedTripId(data.thread.trip_id ?? "");
      setActiveThreadRetentionUntil(data.thread.retention_until ?? null);
      setConversationStartedAt(formatDateTimeLabel(data.thread.created_at));

      const loadedMessages = (data.messages ?? []).map(
        (message: {
          id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string | null;
        }) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          created_at: message.created_at,
        }),
      );

      setMessages(loadedMessages.length > 0 ? loadedMessages : [welcomeMessage]);
      scrollToConversationEnd();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load this conversation.",
      );
    } finally {
      setIsLoadingThreadDetail(false);
    }
  }

  async function deleteConversation(threadId?: string | null) {
    const targetThreadId = threadId ?? activeThreadId;

    if (!targetThreadId) {
      resetConversation();
      return;
    }

    setErrorMessage(null);

    try {
      const response = await fetch(`/api/ask-cozy/threads/${targetThreadId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete this conversation.");
      }

      if (targetThreadId === activeThreadId) {
        resetConversation();
      }

      await loadThreads();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete this conversation.",
      );
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
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Ask Cozy could not answer that.");
      }

      setActiveThreadId(data.threadId ?? activeThreadId);
      setActiveThreadRetentionUntil(data.retentionUntil ?? null);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: data.answer ?? "Iâ€™m sorry, I could not answer that.",
        },
      ]);

      await loadThreads();
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
    void loadThreads();
  }, []);

  useEffect(() => {
    const cleanTripId = tripIdFromTripPage.trim();

    if (!cleanTripId || hasPreselectedTrip.current || isLoadingTrips) {
      return;
    }

    const tripIsAvailable = availableTrips.some((trip) => trip.id === cleanTripId);

    if (tripIsAvailable) {
      hasPreselectedTrip.current = true;
      setSelectedTripId(cleanTripId);
      router.replace("/ask-cozy", {
        scroll: false,
      });
    }
  }, [availableTrips, isLoadingTrips, router, tripIdFromTripPage]);

  useEffect(() => {
    const cleanQuestion = questionFromDashboard.trim();

    if (!cleanQuestion || hasAutoSubmitted.current) {
      return;
    }

    hasAutoSubmitted.current = true;
    setQuestion(cleanQuestion);

    void askCozy(cleanQuestion).finally(() => {
      router.replace("/ask-cozy", {
        scroll: false,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionFromDashboard]);

  useEffect(() => {
    if (messages.length > 1 || isSubmitting) {
      scrollToConversationEnd();
    }
  }, [messages, isSubmitting]);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ maxWidth: 760 }}>
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

            <h2 style={{ margin: "4px 0 0" }}>Ask Cozy</h2>

            <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>
              Ask general travel questions, prepare for your trip, get packing
              reminders, or figure out what to ask your advisor next.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={resetConversation}
            disabled={isSubmitting}
          >
            New Conversation
          </button>
        </div>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 330px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <aside className="stack" style={{ minWidth: 0 }}>
          <div className="card stack">
            <div><h2 style={{ margin: 0 }}>Saved Conversations</h2><p style={{ margin: "5px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>Pick up where you left off, or start fresh any time.</p></div>

            {isLoadingThreads ? (
              <p style={{ margin: 0, color: "#667085" }}>
                Loading conversations...
              </p>
            ) : threadLoadError ? (
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
                {threadLoadError}
              </div>
            ) : savedThreads.length === 0 ? (
              <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                No saved conversations yet. Ask Cozy will keep helpful conversations here for later.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  maxHeight: 360,
                  overflowY: "auto",
                  paddingRight: 2,
                }}
              >
                {savedThreads.map((thread) => (
                  <div
                    key={thread.id}
                    style={{
                      padding: "12px",
                      borderRadius: 12,
                      border:
                        thread.id === activeThreadId
                          ? "2px solid var(--accent-dark)"
                          : "1px solid #e6f0f2",
                      background:
                        thread.id === activeThreadId ? "#f7fbfc" : "#ffffff",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 900, lineHeight: 1.35 }}>
                      {thread.title}
                    </p>

                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "#667085",
                        fontSize: 13,
                      }}
                    >
                      Updated {formatDateTimeLabel(thread.updated_at)}
                    </p>

                    {thread.retention_until ? (
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#667085",
                          fontSize: 13,
                        }}
                      >
                        Kept until {formatDateLabel(thread.retention_until)}
                      </p>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => loadThread(thread.id)}
                        disabled={isLoadingThreadDetail || isSubmitting}
                        style={{ padding: "7px 10px", fontSize: 13 }}
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => deleteConversation(thread.id)}
                        disabled={isLoadingThreadDetail || isSubmitting}
                        style={{
                          padding: "7px 10px",
                          fontSize: 13,
                          background: "#ffffff",
                          color: "#b42318",
                          border: "1px solid #fecaca",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          <div className="card stack">
            <div>
              <h2 style={{ margin: 0 }}>Starter Questions</h2>
              <p style={{ margin: "5px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                Choose a prompt or type your own question.
              </p>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {starterQuestionGroups.map((group) => (
                <div key={group.title} style={{ display: "grid", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 900 }}>
                    {group.title}
                  </p>
                  {group.questions.map((starterQuestion) => (
                    <button
                      key={starterQuestion}
                      type="button"
                      onClick={() => askCozy(starterQuestion)}
                      disabled={isSubmitting}
                      style={{
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e6f0f2",
                        background: "#ffffff",
                        color: "var(--accent-dark)",
                        fontWeight: 800,
                        textAlign: "left",
                        lineHeight: 1.35,
                      }}
                    >
                      {starterQuestion}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="stack" style={{ minWidth: 0 }}>
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
                <h2 style={{ margin: 0 }}>Ask a Question</h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#667085",
                    lineHeight: 1.5,
                  }}
                >
                  {activeThreadId
                    ? "Continue this saved conversation."
                    : "Start a new Ask Cozy conversation. Add a trip context first if your question is about a specific upcoming trip."}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => deleteConversation()}
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

            <div
              className="stack"
              style={{
                padding: "14px",
                borderRadius: 14,
                background: "#f7fbfc",
                border: "1px solid #e6f0f2",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Question Context</h3>
                <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13, lineHeight: 1.5 }}>
                  Choose a trip when your question is specific to upcoming travel, or leave it general for broader travel help.
                </p>
              </div>

              <label className="stack-sm">
                <span className="label">Trip or General Question</span>
                <select
                  className="select"
                  value={selectedTripId}
                  onChange={(event) => setSelectedTripId(event.target.value)}
                  disabled={isLoadingTrips || Boolean(activeThreadId)}
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

              {activeThreadId ? (
                <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>
                  Trip context is locked once a conversation is created. Start a new conversation to choose a different trip.
                </p>
              ) : null}

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
                    background: "#ffffff",
                    border: "1px solid #e6f0f2",
                    color: "#667085",
                    lineHeight: 1.6,
                  }}
                >
                  <strong>{selectedTrip.label}</strong>
                  <br />
                  {selectedTrip.destinations ?? "Destination not provided"}
                  <br />
                  {formatDateLabel(selectedTrip.departure_date)} to{" "}
                  {formatDateLabel(selectedTrip.return_date)}
                </div>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="stack">
              <label className="stack-sm">
                <span className="label">Your Question</span>
                <textarea
                  className="textarea"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  placeholder="Ask about packing, trip prep, destination basics, documents, or what to ask Jeremy next."
                />
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
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
                  Conversation {isSubmitting ? "â€” Asking Cozy..." : ""}
                </h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#667085",
                    lineHeight: 1.5,
                  }}
                >
                  Started {conversationStartedAt}
                </p>

                {activeThreadRetentionUntil ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#667085",
                      lineHeight: 1.5,
                    }}
                  >
                    Retained until {formatDateLabel(activeThreadRetentionUntil)}
                  </p>
                ) : null}
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
              Ask Cozy conversations are saved so you can come back to them later.
              Trip-related conversations are retained until 31 days after the trip
              return date when a return date is available.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id ?? `${message.role}-${index}`}
                    style={{
                      justifySelf: isUser ? "end" : "start",
                      maxWidth: "86%",
                      padding: "12px",
                      borderRadius: 14,
                      border: "1px solid #e6f0f2",
                      background: isUser ? "#eaf6fb" : "#ffffff",
                      boxShadow: "0 8px 20px rgba(18, 63, 91, 0.04)",
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
                    maxWidth: "86%",
                    padding: "12px",
                    borderRadius: 14,
                    border: "1px solid #e6f0f2",
                    background: "#ffffff",
                    color: "#667085",
                  }}
                >
                  Ask Cozy is thinking through that...
                </div>
              ) : null}

              <div ref={conversationEndRef} />
            </div>
          </div>
        </main>
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


