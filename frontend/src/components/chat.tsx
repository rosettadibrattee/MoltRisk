import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage, Player } from "../api/types";

interface ChatProps {
  messages: ChatMessage[];
  players: Player[];
  onSend: (payload: { channel: "public" | "dm"; message: string; to_player?: string }) => Promise<void>;
}

export function ChatPanel({ messages, players, onSend }: ChatProps) {
  const [channel, setChannel] = useState<"public" | "dm">("public");
  const [target, setTarget] = useState<string>(players[0]?.id ?? "");
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const playerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const player of players) names[player.id] = player.name;
    return names;
  }, [players]);

  const filtered = useMemo(() => {
    if (channel === "public") {
      return messages.filter((m) => m.channel === "public" || m.channel === "system");
    }
    return messages.filter((m) => m.channel === "dm");
  }, [channel, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    await onSend({ channel, message, to_player: channel === "dm" ? target : undefined });
    setText("");
  };

  return (
    <section className="panel chat-panel">
      <span className="panel-title">Chat</span>
      <div className="chat-tabs">
        <button
          className={`tab-btn ${channel === "public" ? "active" : ""}`}
          onClick={() => setChannel("public")}
        >
          Public
        </button>
        <button
          className={`tab-btn ${channel === "dm" ? "active" : ""}`}
          onClick={() => setChannel("dm")}
        >
          DM
        </button>
        {channel === "dm" && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ width: "auto", flex: 1, marginLeft: "0.25rem" }}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="chat-stream">
        {filtered.slice(-100).map((msg) => (
          <div key={msg.id} className="chat-msg">
            <span className="chat-from">{playerNames[msg.from_player] ?? msg.from_player}</span>
            <span className="chat-text">
              {msg.to_player ? `→ ${playerNames[msg.to_player] ?? msg.to_player}: ` : ""}
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send message…"
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
