import { daysBetween } from "./dates";
import { ALERT_THRESHOLDS_DAYS } from "./rules";
import type { ComplianceSchedule, UpcomingDeadline } from "./types";

/**
 * Which alert threshold (90/30/7) a deadline currently sits inside, i.e. the
 * smallest threshold whose window the deadline has entered. Returns null when
 * the deadline is further out than the widest (90-day) threshold.
 */
export function thresholdCrossed(daysUntil: number): 90 | 30 | 7 | null {
  if (daysUntil < 0) return null;
  // Ascending thresholds; the tightest crossed window wins.
  const sorted = [...ALERT_THRESHOLDS_DAYS].sort((a, b) => a - b);
  for (const t of sorted) {
    if (daysUntil <= t) return t as 90 | 30 | 7;
  }
  return null;
}

/**
 * The upcoming benchmarking + A/RCx deadlines for a building, sorted by
 * urgency. Used by the Deadline Engine screen and the alert-generation worker.
 */
export function upcomingDeadlines(
  schedule: ComplianceSchedule,
  asOf: Date = new Date(),
): UpcomingDeadline[] {
  const list: UpcomingDeadline[] = [
    {
      type: "benchmark",
      dueDate: schedule.nextBenchmarkDeadline,
      daysUntil: daysBetween(asOf, schedule.nextBenchmarkDeadline),
      thresholdCrossed: null,
    },
    {
      type: "arcx",
      dueDate: schedule.nextArcxDueDate,
      daysUntil: daysBetween(asOf, schedule.nextArcxDueDate),
      thresholdCrossed: null,
    },
  ];
  for (const d of list) d.thresholdCrossed = thresholdCrossed(d.daysUntil);
  return list.sort((a, b) => a.daysUntil - b.daysUntil);
}
