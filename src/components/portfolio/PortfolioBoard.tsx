"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import type { BuildingView, BuildingStatus } from "@/lib/db/portfolio";
import { PortfolioSummary } from "./PortfolioSummary";
import { BuildingTile } from "./BuildingTile";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<BuildingStatus, string> = {
  violation: "in violation",
  approaching: "with a deadline approaching",
  compliant: "compliant",
};

/**
 * Client shell for the portfolio dashboard. Owns the status filter so a click on
 * a summary card (e.g. "In violation") narrows the tile grid below to just those
 * buildings. Pure UI state — no compliance logic lives here.
 */
export function PortfolioBoard({
  buildings,
  counts,
  violationDatesISO,
  offsetMs = 0,
}: {
  buildings: BuildingView[];
  counts: Record<BuildingStatus, number>;
  violationDatesISO: string[];
  offsetMs?: number;
}) {
  const [selected, setSelected] = useState<BuildingStatus | null>(null);

  const toggle = (status: BuildingStatus) =>
    setSelected((prev) => (prev === status ? null : status));

  const visible = selected
    ? buildings.filter((b) => b.status === selected)
    : buildings;

  return (
    <div className="space-y-6">
      <PortfolioSummary
        violationDatesISO={violationDatesISO}
        counts={counts}
        buildingCount={buildings.length}
        selected={selected}
        onSelect={toggle}
        offsetMs={offsetMs}
      />

      {buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No buildings yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Onboard a building with its LADBS Building ID — Verdify derives the
            entire compliance schedule automatically.
          </p>
          <Link href="/buildings/new" className="mt-5">
            <Button>
              <Plus className="h-4 w-4" />
              Add your first building
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {selected && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {visible.length} building
                {visible.length === 1 ? "" : "s"} {STATUS_LABEL[selected]}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="font-medium text-primary hover:underline"
              >
                Clear filter
              </button>
            </p>
          )}

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
              No buildings {STATUS_LABEL[selected!]}.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((view) => (
                <BuildingTile key={view.building.id} view={view} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
