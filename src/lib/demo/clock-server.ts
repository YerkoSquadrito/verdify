import { cookies } from "next/headers";
import {
  DEMO_OFFSET_COOKIE,
  MS_PER_DAY,
  clampOffsetDays,
  isDemoMode,
} from "./clock";

/**
 * Server-only demo-clock helpers: they read the offset cookie via next/headers,
 * so they must never be imported into a client component. Pure constants and
 * clamping live in ./clock (safe on both sides).
 */

/** The current demo offset in days (0 when demo mode is off). */
export async function getDemoOffsetDays(): Promise<number> {
  if (!isDemoMode()) return 0;
  const store = await cookies();
  const raw = store.get(DEMO_OFFSET_COOKIE)?.value;
  return clampOffsetDays(raw ? Number(raw) : 0);
}

/** Simulated "now" — real now plus the demo offset. Real now when demo off. */
export async function getDemoNow(): Promise<Date> {
  const offset = await getDemoOffsetDays();
  return new Date(Date.now() + offset * MS_PER_DAY);
}

/** The demo offset in milliseconds, to seed the live client-side tickers. */
export async function getDemoOffsetMs(): Promise<number> {
  return (await getDemoOffsetDays()) * MS_PER_DAY;
}

/** Simulated UTC calendar day (YYYY-MM-DD) for stamping events at the clock. */
export async function getDemoToday(): Promise<string> {
  return (await getDemoNow()).toISOString().slice(0, 10);
}
