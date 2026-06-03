"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const past = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  return {
    past,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live countdown to a due date; turns amber inside 90 days, red inside 30.
 *  `offsetMs` shifts "now" forward for the demo clock (0 = real time). */
export function Countdown({
  dueDateISO,
  className,
  offsetMs = 0,
}: {
  dueDateISO: string;
  className?: string;
  offsetMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const due = new Date(dueDateISO).getTime();
  const p = parts(due - (now + offsetMs));
  const days = p.past ? -p.d : p.d;

  const tone =
    p.past || days <= 0
      ? "text-status-danger"
      : days <= 30
        ? "text-status-danger"
        : days <= 90
          ? "text-status-warn"
          : "text-foreground";

  return (
    <span className={cn("tabular-nums font-medium", tone, className)}>
      {p.past ? "Overdue " : ""}
      {p.d}d {String(p.h).padStart(2, "0")}:{String(p.m).padStart(2, "0")}:
      {String(p.s).padStart(2, "0")}
    </span>
  );
}
