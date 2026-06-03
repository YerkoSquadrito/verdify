"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, RotateCcw, Play } from "lucide-react";
import { resetDemoAction, setDemoOffsetAction } from "@/app/(app)/actions";
import { DEMO_HORIZON_DAYS } from "@/lib/demo/clock";
import { Button } from "@/components/ui/button";

const MS_PER_DAY = 86_400_000;

/** Days from now until the next June 1 (the annual benchmark deadline). */
function daysUntilNextJune1(): number {
  const now = Date.now();
  const y = new Date(now).getUTCFullYear();
  let target = Date.UTC(y, 5, 1); // month 5 = June
  if (target <= now) target = Date.UTC(y + 1, 5, 1);
  return Math.round((target - now) / MS_PER_DAY);
}

function clamp(n: number) {
  return Math.max(0, Math.min(DEMO_HORIZON_DAYS, Math.round(n)));
}

function simulatedDateLabel(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * MS_PER_DAY);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Presenter-only demo controls: a forward-only time-travel slider and a
 * one-click dataset reset. Rendered in the app shell only when demo mode is on.
 */
export function DemoControls({ initialOffsetDays }: { initialOffsetDays: number }) {
  const router = useRouter();
  const [offset, setOffset] = useState(clamp(initialOffsetDays));
  const [pending, startTransition] = useTransition();
  const [resetting, startReset] = useTransition();

  // Persist the offset (server action) then re-render server components.
  function commit(days: number) {
    const c = clamp(days);
    setOffset(c);
    startTransition(async () => {
      await setDemoOffsetAction(c);
      router.refresh();
    });
  }

  function reset() {
    if (
      !confirm(
        "Reset the demo to its starting state? This clears every building, document, and fine you've added across all demo orgs.",
      )
    )
      return;
    startReset(async () => {
      await resetDemoAction();
      setOffset(0);
      router.refresh();
    });
  }

  const presets: { label: string; days: number }[] = [
    { label: "+30d", days: 30 },
    { label: "+90d", days: 90 },
    { label: "Jun 1", days: Math.max(0, daysUntilNextJune1() - 10) },
    { label: "+1yr", days: 365 },
  ];

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Play className="h-3.5 w-3.5" />
        Demo mode
      </div>

      {/* Time-travel slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {offset === 0 ? "Today" : `+${offset}d`}
          </span>
          <span className="tabular-nums font-medium text-foreground">
            {simulatedDateLabel(offset)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={DEMO_HORIZON_DAYS}
          step={1}
          value={offset}
          aria-label="Simulated days from today"
          disabled={pending || resetting}
          onChange={(e) => setOffset(clamp(Number(e.target.value)))}
          onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
          className="mt-2 w-full cursor-pointer accent-primary"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={pending || resetting}
              onClick={() => commit(p.days)}
              className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
          {offset !== 0 && (
            <button
              type="button"
              disabled={pending || resetting}
              onClick={() => commit(0)}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Reset */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={reset}
        disabled={resetting || pending}
        className="mt-3 w-full"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {resetting ? "Resetting…" : "Reset demo"}
      </Button>
    </div>
  );
}
