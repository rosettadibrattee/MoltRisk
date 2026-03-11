import { useMemo, useState, useRef, useEffect } from "react";
import type { ChatMessage, Player } from "../api/types";

interface Props {
  messages: ChatMessage[];
  players: Player[];
  onSend: (p: { channel: "public" | "dm"; message: string; to_player?: string }) => Promise<void>;
}

export function ChatPanel({ messages, players, onSend }: Props) {
  const [channel, setChannel] = useState<"public" | "dm">("public");
  const [target, setTarget] = useState(players[0]?.id ?? "");
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    players.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [players]);

  const filtered = useMemo(() => {
    if (channel === "public") return messages.filter((m) => m.channel !== "dm");
    return messages.filter((m) => m.channel === "dm");
  }, [channel, messages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filtered]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    await onSend({ channel, message: msg, to_player: channel === "dm" ? target : undefined });
    setText("");
  };

  return (
    <div>
      <h3>Chat</h3>
      <div className="chat-tabs">
        <button className={channel === "public" ? "active" : ""} onClick={() => setChannel("public")}>Public</button>
        <button className={channel === "dm" ? "active" : ""} onClick={() => setChannel("dm")}>DM</button>
        {channel === "dm" && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ fontSize: "0.78rem", marginLeft: "0.3rem" }}>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div className="chat-stream">
        {filtered.slice(-80).map((m) => (
          <div key={m.id} className="chat-msg">
            <span className="sender" style={{ color: players.find((p) => p.id === m.from_player)?.color ?? "var(--text)" }}>
              {nameMap[m.from_player] ?? m.from_player}
            </span>
            {m.to_player && <span className="arrow"> → {nameMap[m.to_player] ?? m.to_player}</span>}
            {": "}{m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-input-row" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
