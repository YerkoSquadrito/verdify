"use client";

import { useEffect, useState } from "react";
import { computeFineExposure } from "@/lib/compliance";
import { cn, formatUsd } from "@/lib/utils";

const MS_PER_DAY = 86_400_000;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function countdownParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/**
 * Live fine-exposure counter. The dollar figure is the EXACT ordinance balance
 * (a step function) computed client-side from the same pure rules module the
 * server uses — never a fabricated number. The visible "live" motion is a
 * second-by-second countdown to the next statutory escalation, with the amount
 * that balance will jump to. Honest and alive.
 */
export function FineExposureCounter({
  violationDateISO,
  size = "md",
}: {
  violationDateISO: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const active = Boolean(violationDateISO);
  const now = useNow(active);

  if (!violationDateISO) {
    return (
      <span
        className={cn(
          "tabular-nums font-semibold text-status-ok",
          size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-2xl",
        )}
      >
        {formatUsd(0)}
      </span>
    );
  }

  const violationDate = new Date(violationDateISO);
  const asOf = new Date(now);
  const exposure = computeFineExposure(violationDate, asOf);

  // Absolute moment of the next escalation, for a smooth seconds countdown.
  let countdown: ReturnType<typeof countdownParts> | null = null;
  let nextLabel = "";
  let nextAmount = 0;
  if (exposure.nextEscalation) {
    const escalationDayCount =
      exposure.daysElapsed + exposure.nextEscalation.inDays;
    const escalationTs = violationDate.getTime() + escalationDayCount * MS_PER_DAY;
    countdown = countdownParts(escalationTs - asOf.getTime());
    nextLabel = exposure.nextEscalation.label;
    nextAmount = exposure.nextEscalation.toBalance;
  }

  const amountClass = cn(
    "tabular-nums font-semibold text-status-danger",
    size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl",
  );

  return (
    <div>
      <span className={amountClass}>{formatUsd(exposure.balance, { cents: true })}</span>
      {countdown && (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          Escalates to {formatUsd(nextAmount, { cents: true })} in{" "}
          <span className="font-medium text-foreground">
            {countdown.d}d {String(countdown.h).padStart(2, "0")}:
            {String(countdown.m).padStart(2, "0")}:
            {String(countdown.s).padStart(2, "0")}
          </span>
        </p>
      )}
      {nextLabel && (
        <p className="text-[11px] text-muted-foreground">{nextLabel}</p>
      )}
    </div>
  );
}
