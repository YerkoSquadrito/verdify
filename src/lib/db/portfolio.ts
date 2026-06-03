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

  // The most recent violation notice. Its date drives the fine counter and,
  // unless cured, the building's "in violation" status.
  const violations = events
    .filter((e) => e.event_type === "violation_issued")
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const violationDate = violations[0] ? parseDate(violations[0].event_date) : null;

  // Two INDEPENDENT resolution axes (LA EBEWE / LAMC enforcement model):
  //
  //   • Compliance (cure) axis — a benchmarking/A/RCx submission dated on or
  //     after the violation cures the non-compliance and clears "violation"
  //     status. It does NOT waive an unpaid fine.
  //   • Money axis — a 'fine_paid' event dated on or after the violation
  //     settles the §98.0411(c) balance. It does NOT restore compliance.
  //
  // Full clearance requires both; either can happen first, in any order.
  const violationCured =
    violationDate != null &&
    events.some(
      (e) =>
        (e.event_type === "benchmark_submitted" ||
          e.event_type === "arcx_completed") &&
        parseDate(e.event_date).getTime() >= violationDate.getTime(),
    );
  const openViolation = violationDate != null && !violationCured;

  const finePayment =
    violationDate != null
      ? events
          .filter(
            (e) =>
              e.event_type === "fine_paid" &&
              parseDate(e.event_date).getTime() >= violationDate.getTime(),
          )
          .sort((a, b) => a.event_date.localeCompare(b.event_date))[0]
      : undefined;

  let effectiveFine: FineExposure;
  if (violationDate == null) {
    const zero = computeFineExposure(asOf, asOf);
    effectiveFine = { ...zero, balance: 0, stage: "none", nextEscalation: null };
  } else if (finePayment) {
    // Freeze the exposure at the balance owed on the payment date, then mark it
    // settled: a paid fine is no longer money at risk (balance 0), so it drops
    // out of the portfolio's total fine exposure while still displaying what
    // was settled.
    const settledExposure = computeFineExposure(
      violationDate,
      parseDate(finePayment.event_date),
    );
    effectiveFine = {
      ...settledExposure,
      asOf,
      balance: 0,
      nextEscalation: null,
      settled: true,
      settledAmount: settledExposure.balance,
    };
  } else {
    effectiveFine = computeFineExposure(violationDate, asOf);
  }

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

  // Status follows the COMPLIANCE axis only. A settled-but-uncured violation
  // still reads "violation"; a cured-but-unpaid one reads compliant/approaching
  // while its fine keeps accruing on the money axis.
  let status: BuildingStatus = "compliant";
  if (openViolation) status = "violation";
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
