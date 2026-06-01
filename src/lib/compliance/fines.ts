import { daysBetween } from "./dates";
import {
  FINE_AT_DAY_30,
  FINE_BASE,
  FINE_INTEREST_PERIOD_DAYS,
  FINE_INTEREST_START_DAY,
  FINE_LATE_CHARGE_DAY,
  FINE_MONTHLY_INTEREST,
} from "./rules";
import type { FineExposure, FineScheduleRow, FineStage } from "./types";

/** Number of compounded monthly interest periods elapsed at `daysElapsed`. */
function interestMonths(daysElapsed: number): number {
  if (daysElapsed < FINE_INTEREST_START_DAY) return 0;
  return Math.floor(
    (daysElapsed - FINE_INTEREST_START_DAY) / FINE_INTEREST_PERIOD_DAYS,
  );
}

/** Exact ordinance balance at a given number of days from the invoice date. */
function balanceAtDay(daysElapsed: number): { balance: number; stage: FineStage } {
  if (daysElapsed < 0) return { balance: 0, stage: "none" };
  // §91.9712 base notice, flat until the day-30 late charge.
  if (daysElapsed < FINE_LATE_CHARGE_DAY) {
    return { balance: FINE_BASE, stage: "base" };
  }
  // §98.0411(c) 250% combined late charge applied; interest not yet running.
  if (daysElapsed < FINE_INTEREST_START_DAY) {
    return { balance: FINE_AT_DAY_30, stage: "late" };
  }
  // §98.0411(c) 1%/month compounding on the $707 balance from day 60.
  const months = interestMonths(daysElapsed);
  const balance = FINE_AT_DAY_30 * Math.pow(1 + FINE_MONTHLY_INTEREST, months);
  return { balance, stage: "interest" };
}

/**
 * Current fine exposure for a violation notice issued on `violationDate`.
 *
 * Pure rule execution (LAMC §91.9712 + §98.0411(c)). The balance is a STEP
 * function — it changes only at day 30, day 60, and each subsequent month — so
 * the dashboard's live counter shows the exact current exposure plus a
 * countdown to the next escalation, rather than fabricating continuous accrual.
 */
export function computeFineExposure(
  violationDate: Date,
  asOf: Date = new Date(),
): FineExposure {
  const daysElapsed = daysBetween(violationDate, asOf);
  const { balance, stage } = balanceAtDay(daysElapsed);

  let nextEscalation: FineExposure["nextEscalation"] = null;
  if (stage === "base") {
    nextEscalation = {
      inDays: FINE_LATE_CHARGE_DAY - daysElapsed,
      toBalance: FINE_AT_DAY_30,
      label: "250% combined late charge (LAMC 98.0411(c))",
    };
  } else if (stage === "late" || stage === "interest") {
    // Next month boundary on which the balance actually increases.
    const months = interestMonths(daysElapsed);
    const nextMonthDay =
      FINE_INTEREST_START_DAY + (months + 1) * FINE_INTEREST_PERIOD_DAYS;
    const toBalance =
      FINE_AT_DAY_30 * Math.pow(1 + FINE_MONTHLY_INTEREST, months + 1);
    nextEscalation = {
      inDays: nextMonthDay - daysElapsed,
      toBalance: round2(toBalance),
      label: "1%/month compounding interest (LAMC 98.0411(c))",
    };
  }

  return {
    balance: round2(balance),
    daysElapsed,
    stage,
    asOf,
    nextEscalation,
  };
}

/**
 * The canonical escalation schedule (Appendix Table A3), computed from the same
 * rules the live counter uses. Powers the Alert Simulator's curve and table.
 */
export function expectedFineSchedule(): FineScheduleRow[] {
  const days = [0, 30, 60, 90, 120, 180, 270, 365];
  return days.map((day) => {
    const { balance } = balanceAtDay(day);
    return {
      day,
      balance: round2(balance),
      trigger: triggerLabel(day),
      citation: day === 0 ? "LAMC 91.9712" : "LAMC 98.0411(c)",
    };
  });
}

function triggerLabel(day: number): string {
  if (day === 0) return "Base violation notice issued";
  if (day === 30) return "250% combined late charge + collection fee";
  if (day === 60) return "1%/month compounding interest begins";
  return "Compounding interest accrues";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
