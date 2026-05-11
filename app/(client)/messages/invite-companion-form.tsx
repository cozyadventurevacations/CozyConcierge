"use client";

import { useState, useRef } from "react";

type ClientSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type InviteCompanionFormProps = {
  threadId: string;
  tripId: string;
  action: (formData: FormData) => Promise<void>;
};

export function InviteCompanionForm({ threadId, tripId, action }: InviteCompanionFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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

  function handleEmailChange(value: string) {
    setEmail(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value), 300);
  }

  function selectSuggestion(client: ClientSuggestion) {
    setEmail(client.email ?? "");
    const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
    setName(fullName);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function getDisplayName(client: ClientSuggestion) {
    const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
    return fullName || client.email || "Unknown";
  }

  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="trip_id" value={tripId} />

      <div className="grid grid-2">
        {/* Email with autofill */}
        <label className="stack-sm">
          <span className="label">Their Email</span>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              name="invite_email"
              type="email"
              required
              placeholder="traveler@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
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
                    <span style={{ fontSize: 12, color: "#667085" }}>{client.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        {/* Name */}
        <label className="stack-sm">
          <span className="label">Their Name</span>
          <input
            className="input"
            name="invite_name"
            placeholder="e.g. Pat Brown"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#667085", lineHeight: 1.5 }}>
        If they already have a Cozy Concierge account, access connects automatically. Otherwise they will receive an email invitation.
      </p>

      <div>
        <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }}>
          Send Invitation
        </button>
      </div>
    </form>
  );
}