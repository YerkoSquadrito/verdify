// Shared types for the deterministic compliance engine.
// This module is PURE — no I/O, no Supabase, no Next, no LLM.

export type Ownership = "private" | "city";

export type DeadlineType = "benchmark" | "arcx";

export type FineStage = "none" | "base" | "late" | "interest";

export interface ComplianceSchedule {
  bin: string;
  sqft: number;
  ownership: Ownership;
  /** Whether the building falls under EBEWE coverage thresholds. */
  covered: boolean;
  /** Last digit of the LADBS Building ID — drives the A/RCx cycle. */
  arcxDigit: number;
  /** Next annual benchmarking deadline (June 1). */
  nextBenchmarkDeadline: Date;
  /** Next Audit & Retro-Commissioning report due date (December 1). */
  nextArcxDueDate: Date;
  /** The next three A/RCx due dates, for portfolio forecasting. */
  upcomingArcxDueDates: Date[];
}

export interface FineEscalation {
  /** Days after the next balance increase, and what the balance becomes. */
  inDays: number;
  toBalance: number;
  label: string;
}

export interface FineExposure {
  /** Current exact dollar exposure per the ordinance (a step function). */
  balance: number;
  daysElapsed: number;
  stage: FineStage;
  asOf: Date;
  /** The next escalation event, or null once fully escalated context is irrelevant. */
  nextEscalation: FineEscalation | null;
}

export interface FineScheduleRow {
  day: number;
  balance: number;
  trigger: string;
  citation: string;
}

export interface UpcomingDeadline {
  type: DeadlineType;
  dueDate: Date;
  daysUntil: number;
  /** Which alert threshold (90/30/7) has been crossed, if any. */
  thresholdCrossed: 90 | 30 | 7 | null;
}
