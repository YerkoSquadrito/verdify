import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeFineExposure,
  deriveComplianceSchedule,
  upcomingDeadlines,
  civilDate,
  addDays,
  ARCX_CYCLE_YEARS,
  type ComplianceSchedule,
  type FineExposure,
  type UpcomingDeadline,
} from "@/lib/compliance";
import type { Building, ComplianceEvent } from "./types";

export type BuildingStatus = "compliant" | "approaching" | "violation";

export interface BuildingView {
  building: Building;
  schedule: ComplianceSchedule;
  violationDate: Date | null;
  fine: FineExposure;
  status: BuildingStatus;
  deadlines: UpcomingDeadline[];
  nextDeadline: UpcomingDeadline;
  events: ComplianceEvent[];
}

export interface PortfolioView {
  buildings: BuildingView[];
  totalFineExposure: number;
  counts: Record<BuildingStatus, number>;
}

/** Parse an ordinance date string (YYYY-MM-DD) at noon UTC for stable math. */
function parseDate(d: string): Date {
  return new Date(`${d}T12:00:00.000Z`);
}

export function buildView(
  building: Building,
  events: ComplianceEvent[],
  asOf: Date = new Date(),
): BuildingView {
  const schedule = deriveComplianceSchedule(
    building.bin,
    building.sqft,
    building.ownership,
    asOf,
  );

  const violations = events
    .filter((e) => e.event_type === "violation_issued")
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const violationDate = violations[0] ? parseDate(violations[0].event_date) : null;

  const fine = computeFineExposure(violationDate ?? asOf, asOf);
  const effectiveFine: FineExposure = violationDate
    ? fine
    : { ...fine, balance: 0, stage: "none", nextEscalation: null };

  // Roll a deadline forward when the current cycle has already been satisfied,
  // so a building that benchmarked this year reads as compliant rather than
  // perpetually "approaching" its upcoming-but-met deadline.
  const benchmarkSatisfied = events.some(
    (e) =>
      e.event_type === "benchmark_submitted" &&
      parseDate(e.event_date).getTime() >
        addDays(schedule.nextBenchmarkDeadline, -365).getTime(),
  );
  const arcxSatisfied = events.some(
    (e) =>
      e.event_type === "arcx_completed" &&
      parseDate(e.event_date).getTime() >
        addDays(schedule.nextArcxDueDate, -365 * ARCX_CYCLE_YEARS).getTime(),
  );
  const effectiveSchedule: ComplianceSchedule = {
    ...schedule,
    nextBenchmarkDeadline: benchmarkSatisfied
      ? civilDate(schedule.nextBenchmarkDeadline.getUTCFullYear() + 1, 6, 1)
      : schedule.nextBenchmarkDeadline,
    nextArcxDueDate: arcxSatisfied
      ? civilDate(
          schedule.nextArcxDueDate.getUTCFullYear() + ARCX_CYCLE_YEARS,
          12,
          1,
        )
      : schedule.nextArcxDueDate,
  };

  const deadlines = upcomingDeadlines(effectiveSchedule, asOf);
  const nextDeadline = deadlines[0];

  let status: BuildingStatus = "compliant";
  if (violationDate) status = "violation";
  else if (deadlines.some((d) => d.thresholdCrossed !== null))
    status = "approaching";

  return {
    building,
    schedule: effectiveSchedule,
    violationDate,
    fine: effectiveFine,
    status,
    deadlines,
    nextDeadline,
    events,
  };
}

/**
 * Load the portfolio for one organization. The query is narrowed to `orgId`;
 * RLS independently guarantees the caller can only ever reach orgs they belong
 * to, so a consultant authenticated for one org can never pull another's rows.
 */
export async function getPortfolio(
  supabase: SupabaseClient,
  orgId: string,
  asOf: Date = new Date(),
): Promise<PortfolioView> {
  const [{ data: buildingRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("buildings")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase.from("compliance_events").select("*").eq("org_id", orgId),
  ]);

  const buildings = (buildingRows ?? []) as Building[];
  const events = (eventRows ?? []) as ComplianceEvent[];
  const eventsByBuilding = new Map<string, ComplianceEvent[]>();
  for (const e of events) {
    const arr = eventsByBuilding.get(e.building_id) ?? [];
    arr.push(e);
    eventsByBuilding.set(e.building_id, arr);
  }

  const views = buildings.map((b) =>
    buildView(b, eventsByBuilding.get(b.id) ?? [], asOf),
  );

  const counts: Record<BuildingStatus, number> = {
    compliant: 0,
    approaching: 0,
    violation: 0,
  };
  let totalFineExposure = 0;
  for (const v of views) {
    counts[v.status] += 1;
    totalFineExposure += v.fine.balance;
  }

  return { buildings: views, totalFineExposure, counts };
}
