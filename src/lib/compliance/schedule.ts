import { civilDate, toCivilDay } from "./dates";
import {
  ARCX_BASE_YEAR_BY_DIGIT,
  ARCX_CYCLE_YEARS,
  ARCX_DUE_DAY,
  ARCX_DUE_MONTH,
  BENCHMARK_DAY,
  BENCHMARK_MONTH,
} from "./rules";
import { isCovered } from "./coverage";
import type { ComplianceSchedule, Ownership } from "./types";

/**
 * Last digit of a LADBS Building ID. Tolerant of formatting — reads the last
 * numeric character in the string. Throws if the BIN contains no digit, because
 * a building with no parseable ID cannot have a deterministic A/RCx cycle and
 * we must never guess one.
 */
export function lastDigitOfBin(bin: string): number {
  const digits = (bin ?? "").replace(/\D/g, "");
  if (digits.length === 0) {
    throw new Error(`Cannot derive A/RCx cycle: BIN "${bin}" has no digits`);
  }
  return Number(digits[digits.length - 1]);
}

/** Next annual benchmarking deadline (June 1) on or after `asOf`. */
export function nextBenchmarkDeadline(asOf: Date = new Date()): Date {
  const today = toCivilDay(asOf);
  const thisYear = civilDate(
    today.getUTCFullYear(),
    BENCHMARK_MONTH,
    BENCHMARK_DAY,
  );
  if (thisYear.getTime() >= today.getTime()) return thisYear;
  return civilDate(today.getUTCFullYear() + 1, BENCHMARK_MONTH, BENCHMARK_DAY);
}

/**
 * Next A/RCx (Audit & Retro-Commissioning) due date for a building.
 *
 * Pure rule execution per LAMC §91.9708 Table 9708.2: the cycle is anchored by
 * the last digit of the BIN to a base year, due December 1, recurring every 5
 * years. We walk the 5-year cadence forward to the first due date on or after
 * `asOf`. No model, no inference — this cannot hallucinate a wrong deadline.
 */
export function nextArcxDueDate(bin: string, asOf: Date = new Date()): Date {
  const digit = lastDigitOfBin(bin);
  const baseYear = ARCX_BASE_YEAR_BY_DIGIT[digit];
  const today = toCivilDay(asOf);

  let year = baseYear;
  let due = civilDate(year, ARCX_DUE_MONTH, ARCX_DUE_DAY);
  while (due.getTime() < today.getTime()) {
    year += ARCX_CYCLE_YEARS;
    due = civilDate(year, ARCX_DUE_MONTH, ARCX_DUE_DAY);
  }
  return due;
}

/** The next `count` A/RCx due dates, for portfolio forecasting. */
export function upcomingArcxDueDates(
  bin: string,
  asOf: Date = new Date(),
  count = 3,
): Date[] {
  const first = nextArcxDueDate(bin, asOf);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      civilDate(
        first.getUTCFullYear() + i * ARCX_CYCLE_YEARS,
        ARCX_DUE_MONTH,
        ARCX_DUE_DAY,
      ),
    );
  }
  return out;
}

/**
 * Derive a building's complete compliance schedule from its BIN, size, and
 * ownership. This is the function the Building Onboarding screen previews and
 * the Dashboard / Deadline Engine read — entirely deterministic.
 */
export function deriveComplianceSchedule(
  bin: string,
  sqft: number,
  ownership: Ownership,
  asOf: Date = new Date(),
): ComplianceSchedule {
  return {
    bin,
    sqft,
    ownership,
    covered: isCovered(sqft, ownership),
    arcxDigit: lastDigitOfBin(bin),
    nextBenchmarkDeadline: nextBenchmarkDeadline(asOf),
    nextArcxDueDate: nextArcxDueDate(bin, asOf),
    upcomingArcxDueDates: upcomingArcxDueDates(bin, asOf),
  };
}
