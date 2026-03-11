import { useEffect, useState } from "react";

interface Props { deadlineTs: number | null; }

export function Timer({ deadlineTs }: Props) {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 300);
    return () => clearInterval(id);
  }, []);
  if (!deadlineTs) return <span className="timer">--:--</span>;
  const remaining = Math.max(0, Math.floor(deadlineTs - now));
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  return <span className={`timer ${remaining < 30 ? "urgent" : ""}`}>{mm}:{ss}</span>;
}
