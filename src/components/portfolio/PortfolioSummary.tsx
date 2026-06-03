"use client";

import { useEffect, useState } from "react";
import { computeFineExposure } from "@/lib/compliance";
import { formatUsd } from "@/lib/utils";
import type { BuildingStatus } from "@/lib/db/portfolio";

const CARDS: { key: BuildingStatus; label: string; tone: string }[] = [
  { key: "violation", label: "In violation", tone: "text-status-danger" },
  { key: "approaching", label: "Deadline approaching", tone: "text-status-warn" },
  { key: "compliant", label: "Compliant", tone: "text-status-ok" },
];

/**
 * Portfolio-level live exposure: the sum of every building's exact ordinance
 * fine balance, recomputed each second. Scales unchanged from 1 to hundreds of
 * buildings — it just sums more violation dates.
 */
export function PortfolioSummary({
  violationDatesISO,
  counts,
  buildingCount,
  selected,
  onSelect,
  offsetMs = 0,
}: {
  violationDatesISO: string[];
  counts: Record<BuildingStatus, number>;
  buildingCount: number;
  selected: BuildingStatus | null;
  onSelect: (status: BuildingStatus) => void;
  /** Demo-clock shift forward in ms (0 = real time). */
  offsetMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (violationDatesISO.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [violationDatesISO.length]);

  const asOf = new Date(now + offsetMs);
  const total = violationDatesISO.reduce(
    (sum, iso) => sum + computeFineExposure(new Date(iso), asOf).balance,
    0,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-status-danger/30 bg-status-danger-bg/40 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-status-danger">
          Live fine exposure
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-status-danger">
          {formatUsd(total, { cents: true })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Across {buildingCount} building{buildingCount === 1 ? "" : "s"} ·
          LAMC 98.0411(c)
        </p>
      </div>

      {CARDS.map((c) => {
        const active = selected === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            aria-pressed={active}
            className={`cursor-pointer rounded-lg border bg-card p-5 text-left transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? "border-primary ring-2 ring-primary" : "border-border"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${c.tone}`}>
              {counts[c.key]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {active
                ? "Filtering · click to clear"
                : counts[c.key] === 1
                  ? "building"
                  : "buildings"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
