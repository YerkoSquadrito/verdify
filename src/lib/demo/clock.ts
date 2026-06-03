/**
 * Demo clock — shared constants and pure helpers, safe to import from BOTH
 * client and server. The cookie-backed "simulated now" helpers (which depend on
 * next/headers) live in clock-server.ts so this module never pulls server-only
 * APIs into a client bundle.
 *
 * The compliance engine is pure and time-injectable: every rule takes an
 * `asOf: Date`. Time only "moves" because the pages call those rules with a
 * different `asOf`. The demo clock is a forward-only day offset (stored in a
 * cookie) that a presenter can fast-forward to watch deadlines and fines evolve.
 *
 * Gated behind NEXT_PUBLIC_DEMO_MODE: when off, the offset is ignored and
 * everything degrades to the real wall clock, so production is never affected.
 */

export const DEMO_OFFSET_COOKIE = "verdify_demo_offset_days";

/** 18 months — long enough to cross a June 1 benchmark deadline and watch a
 *  fine compound past the day-365 mark. */
export const DEMO_HORIZON_DAYS = 548;

export const MS_PER_DAY = 86_400_000;

/** Whether the in-app demo controls (slider + reset) are enabled. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Clamp an offset to the valid demo range. Forward-only: never before today. */
export function clampOffsetDays(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const i = Math.round(n);
  if (i < 0) return 0;
  if (i > DEMO_HORIZON_DAYS) return DEMO_HORIZON_DAYS;
  return i;
}
