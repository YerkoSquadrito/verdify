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
}: {
  violationDatesISO: string[];
  counts: Record<BuildingStatus, number>;
  buildingCount: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (violationDatesISO.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [violationDatesISO.length]);

  const asOf = new Date(now);
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

      {CARDS.map((c) => (
        <div key={c.key} className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {c.label}
          </p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${c.tone}`}>
            {counts[c.key]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts[c.key] === 1 ? "building" : "buildings"}
          </p>
        </div>
      ))}
    </div>
  );
}
