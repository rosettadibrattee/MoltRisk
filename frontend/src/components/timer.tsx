import { useEffect, useState } from "react";

interface TimerProps {
  deadlineTs: number | null;
}

export function Timer({ deadlineTs }: TimerProps) {
  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() / 1000), 300);
    return () => window.clearInterval(interval);
  }, []);

  if (!deadlineTs) return <span className="timer">—</span>;

  const remaining = Math.max(0, Math.floor(deadlineTs - now));
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const urgent = remaining < 30 && remaining > 0;

  return (
    <span className="timer" style={urgent ? { color: "var(--error)" } : undefined}>
      {mm}:{ss}
    </span>
  );
}
