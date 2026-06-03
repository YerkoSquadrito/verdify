import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeFineExposure,
  deriveComplianceSchedule,
  upcomingDeadlines,
  nextBenchmarkDeadline,
  nextArcxDueDate,
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
  /**
   * True only when the violation is an explicit, issued LADBS notice (payable on
   * the money axis). False when the "violation" is derived from a deadline that
   * lapsed unmet during the demo — that is cured by submitting documentation, not
   * by paying a notice that was never issued.
   */
  violationIssued: boolean;
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
  baseline: Date = asOf,
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

  // Resolve each deadline axis against the cycle currently in force, keyed to the
  // `baseline` (real "now" at demo offset 0) so a deadline is only treated as
  // MISSED when it lapses inside the simulated window [baseline, asOf]. With the
  // default baseline === asOf that window is empty, so non-demo callers never
  // INFER a violation from merely-absent records — only an explicit
  // `violation_issued` event creates a fine (LAMC §91.9712). Demo callers pass an
  // earlier baseline to let the time-travel slider drive lapses.
  const bench = resolveDeadlineAxis(
    nextBenchmarkDeadline(baseline),
    1,
    events.some(
      (e) =>
        e.event_type === "benchmark_submitted" &&
        parseDate(e.event_date).getTime() >
          addDays(nextBenchmarkDeadline(baseline), -365).getTime(),
    ),
    asOf,
  );
  const arcx = resolveDeadlineAxis(
    nextArcxDueDate(building.bin, baseline),
    ARCX_CYCLE_YEARS,
    events.some(
      (e) =>
        e.event_type === "arcx_completed" &&
        parseDate(e.event_date).getTime() >
          addDays(nextArcxDueDate(building.bin, baseline), -365 * ARCX_CYCLE_YEARS).getTime(),
    ),
    asOf,
  );
  const effectiveSchedule: ComplianceSchedule = {
    ...schedule,
    nextBenchmarkDeadline: bench.effectiveDate,
    nextArcxDueDate: arcx.effectiveDate,
  };

  const deadlines = upcomingDeadlines(effectiveSchedule, asOf);
  const nextDeadline = deadlines[0];

  // The earliest deadline that lapsed unmet during the simulated window. Its date
  // is the §91.9712 base-notice anchor for the derived fine — i.e. exposure
  // begins the day the ordinance deadline passed.
  const missedAnchor = [bench.missedDate, arcx.missedDate]
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  // Status follows the COMPLIANCE axis. An explicit open violation dominates (an
  // authoritative LADBS notice). Otherwise a deadline that lapsed unmet reads
  // "violation" with a fine accruing from the missed date; a cured-but-unpaid
  // explicit violation reads compliant/approaching while its fine keeps accruing.
  let status: BuildingStatus = "compliant";
  let resolvedViolationDate = violationDate;
  let resolvedFine = effectiveFine;
  if (openViolation) {
    status = "violation";
  } else if (missedAnchor) {
    status = "violation";
    resolvedViolationDate = missedAnchor;
    resolvedFine = computeFineExposure(missedAnchor, asOf);
  } else if (deadlines.some((d) => d.thresholdCrossed !== null)) {
    status = "approaching";
  }

  return {
    building,
    schedule: effectiveSchedule,
    violationDate: resolvedViolationDate,
    fine: resolvedFine,
    status,
    violationIssued: openViolation,
    deadlines,
    nextDeadline,
    events,
  };
}

interface AxisResolution {
  /** Deadline to display — the now-overdue date when missed, else the upcoming one. */
  effectiveDate: Date;
  /** Non-null when the deadline lapsed unmet during the simulated window. */
  missedDate: Date | null;
}

/**
 * Resolve one deadline axis (benchmark or A/RCx) to the cycle in force.
 *  • satisfied this cycle → advance one cycle so a met deadline doesn't read
 *    "approaching" forever;
 *  • unmet and already past `asOf` → MISSED: keep the lapsed date (shown overdue);
 *  • otherwise → the upcoming deadline.
 */
function resolveDeadlineAxis(
  dueDate: Date,
  cycleYears: number,
  satisfied: boolean,
  asOf: Date,
): AxisResolution {
  if (satisfied) {
    return {
      effectiveDate: civilDate(
        dueDate.getUTCFullYear() + cycleYears,
        dueDate.getUTCMonth() + 1,
        dueDate.getUTCDate(),
      ),
      missedDate: null,
    };
  }
  if (asOf.getTime() >= dueDate.getTime()) {
    return { effectiveDate: dueDate, missedDate: dueDate };
  }
  return { effectiveDate: dueDate, missedDate: null };
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
  baseline: Date = asOf,
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
    buildView(b, eventsByBuilding.get(b.id) ?? [], asOf, baseline),
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
