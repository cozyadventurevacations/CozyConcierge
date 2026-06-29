"use client";

import { useState, useRef } from "react";
import type { ReactNode } from "react";

type ClientSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_hint: string | null;
};

type InviteCompanionFormProps = {
  threadId: string;
  tripId: string;
  action: (formData: FormData) => Promise<void>;
  children?: ReactNode;
};

export function InviteCompanionForm({ threadId, tripId, action, children }: InviteCompanionFormProps) {
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function searchClients(query: string) {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.clients ?? []);
        setShowSuggestions(true);
      }
    } catch {
      // silently fail — user can still type manually
    } finally {
      setLoading(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedClientId("");
    setSelectedClientName("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value), 300);
  }

  function selectSuggestion(client: ClientSuggestion) {
    const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
    setQuery(fullName || "Selected client");
    setSelectedClientId(client.id);
    setSelectedClientName(fullName || "Selected client");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function getDisplayName(client: ClientSuggestion) {
    const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
    return fullName || "Registered client";
  }

  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="invite_client_account_id" value={selectedClientId} />

      <div className="grid grid-2">
        <label className="stack-sm">
          <span className="label">Search Registered Client</span>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              required
              placeholder="Type their name or email"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
            />
            {loading && (
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94a3b8" }}>
                Searching...
              </span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: "#ffffff", border: "1px solid #e6f0f2", borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginTop: 4, overflow: "hidden",
              }}>
                {suggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectSuggestion(client)}
                    style={{
                      width: "100%", padding: "10px 14px", textAlign: "left",
                      background: "none", border: "none", borderBottom: "1px solid #f0f5f8",
                      cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fbfc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ fontWeight: 700, color: "var(--accent-dark)", fontSize: 14 }}>
                      {getDisplayName(client)}
                    </span>
                    {client.email_hint ? (
                      <span style={{ fontSize: 12, color: "#667085" }}>{client.email_hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <div className="stack-sm">
          <span className="label">Selected Client</span>
          <div className="input" style={{ background: selectedClientId ? "#f0fdf4" : "#fff7ed", color: selectedClientId ? "#166534" : "#9a3412" }}>
            {selectedClientId ? selectedClientName : "Choose a registered client from the search results"}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#667085", lineHeight: 1.5 }}>
        For privacy, Travel Circle companions must already have a Cozy Concierge client account.
      </p>

      {children}

      <div>
        <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }} disabled={!selectedClientId}>
          Add Registered Client
        </button>
      </div>
    </form>
  );
}
