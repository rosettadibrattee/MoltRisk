import { useMemo, useState } from "react";

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

  const filtered = useMemo(() => {
    if (channel === "public") {
      return messages.filter((m) => m.channel === "public" || m.channel === "system");
    }
    return messages.filter((m) => m.channel === "dm");
  }, [channel, messages]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) {
      return;
    }
    await onSend({ channel, message, to_player: channel === "dm" ? target : undefined });
    setText("");
  };

  return (
    <section className="panel chat-panel">
      <h3>Chat</h3>
      <div className="chat-toolbar">
        <button className={channel === "public" ? "active" : ""} onClick={() => setChannel("public")}>Public</button>
        <button className={channel === "dm" ? "active" : ""} onClick={() => setChannel("dm")}>DM</button>
        {channel === "dm" && (
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="chat-stream">
        {filtered.slice(-100).map((message) => (
          <p key={message.id}>
            <strong>{message.from_player}</strong>
            {message.to_player ? ` → ${message.to_player}` : ""}: {message.text}
          </p>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Send message" />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
