// Small, pure date helpers for the compliance engine.
//
// Deadlines are civil calendar dates (June 1, December 1). To avoid timezone /
// DST off-by-one bugs we anchor every ordinance date at 12:00 UTC, so the
// calendar day is unambiguous across all US timezones, and we measure spans in
// whole calendar days. This keeps the engine deterministic regardless of where
// the server or browser runs.

const MS_PER_DAY = 86_400_000;

/** Construct an ordinance calendar date (month is 1-based) anchored at noon UTC. */
export function civilDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/** Normalize any Date to its civil calendar day (noon UTC of the same Y/M/D). */
export function toCivilDay(d: Date): Date {
  return civilDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole calendar days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (toCivilDay(to).getTime() - toCivilDay(from).getTime()) / MS_PER_DAY,
  );
}

/** Add whole days to a civil date. */
export function addDays(d: Date, days: number): Date {
  return new Date(toCivilDay(d).getTime() + days * MS_PER_DAY);
}
