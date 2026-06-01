// ─────────────────────────────────────────────────────────────────────────────
// EBEWE / LAMC ORDINANCE CONSTANTS — encoded verbatim with statutory citations.
//
// These are the moat. They are hard-coded into the application layer (NOT
// customer-configurable) per Verdify's "ordinance-native" architecture. Every
// constant carries the citation to its source statute so the rule is auditable
// and updateable if the Los Angeles Municipal Code changes.
//
// DO NOT paraphrase these into round numbers. DO NOT compute any of them with
// an LLM. This file is pure data; schedule.ts and fines.ts are pure functions
// over it. That is what makes the compliance engine insurable.
// ─────────────────────────────────────────────────────────────────────────────

export const TIMEZONE = "America/Los_Angeles";

// ── Coverage thresholds ──────────────────────────────────────────────────────
// EBEWE Ordinance (LAMC Art. 9, Chapter IX, Div. 97) scope: privately owned
// buildings ≥ 20,000 sq ft and city-owned buildings ≥ 7,500 sq ft are covered.
export const COVERAGE_SQFT_PRIVATE = 20_000;
export const COVERAGE_SQFT_CITY = 7_500;

// ── Annual benchmarking deadline ─────────────────────────────────────────────
// Energy & water benchmarking is due June 1 each year, UNIFORM across all
// covered buildings (LAMC §91.9708.1). It is NOT keyed to the building ID.
export const BENCHMARK_MONTH = 6; // June
export const BENCHMARK_DAY = 1;

// ── A/RCx (Audit & Retro-Commissioning) five-year cycle ──────────────────────
// LAMC §91.9708, Table 9708.2: A/RCx compliance is due once every five years,
// based on the LAST DIGIT of the LADBS Building Identification Number, and is
// due DECEMBER 1 of the assigned year (distinct from the June 1 benchmark date).
//
//   Last digit 0 or 1 → Dec 1, 2021   (then 2026, 2031, …)
//   Last digit 2 or 3 → Dec 1, 2022   (then 2027, 2032, …)
//   Last digit 4 or 5 → Dec 1, 2023   (then 2028, 2033, …)
//   Last digit 6 or 7 → Dec 1, 2024   (then 2029, 2034, …)
//   Last digit 8 or 9 → Dec 1, 2025   (then 2030, 2035, …)
//
// Verified against LAMC §91.9708 (amlegal code library) and the official LADBS
// A/RCx FAQ. The cycle recurs "every five years thereafter."
export const ARCX_CYCLE_YEARS = 5;
export const ARCX_DUE_MONTH = 12; // December
export const ARCX_DUE_DAY = 1;
export const ARCX_BASE_YEAR_BY_DIGIT: Record<number, number> = {
  0: 2021,
  1: 2021,
  2: 2022,
  3: 2022,
  4: 2023,
  5: 2023,
  6: 2024,
  7: 2024,
  8: 2025,
  9: 2025,
};

// ── Fine escalation schedule ─────────────────────────────────────────────────
// LAMC §91.9712 (base non-compliance fee) and §98.0411(c) (late charge +
// interest). Source: Verdify product spec Appendix Table A3 (LADBS confirmed).
//
//   Day 0   → $202   base violation notice                     (§91.9712)
//   Day 30  → $707   = $202 + $505 (250% combined late charge)  (§98.0411(c))
//   Day 60  → interest begins: 1%/month compounding on $707     (§98.0411(c))
//   Day 90  → ~$714   Day 120 → ~$721   Day 180 → ~$736
//   Day 270 → ~$758   Day 365 → ~$780  (≈10 months compounding)
export const FINE_BASE = 202; // §91.9712
export const FINE_LATE_CHARGE = 505; // 250% combined late charge + collection fee
export const FINE_AT_DAY_30 = FINE_BASE + FINE_LATE_CHARGE; // 707, §98.0411(c)
export const FINE_LATE_CHARGE_DAY = 30;
export const FINE_INTEREST_START_DAY = 60;
export const FINE_INTEREST_PERIOD_DAYS = 30; // compounds monthly
export const FINE_MONTHLY_INTEREST = 0.01; // 1%/month (12% APR), on the $707 balance

// ── Alert cascade thresholds ─────────────────────────────────────────────────
// Deadline Engine fires multi-channel alerts at these day-counts before a due
// date (Verdify product spec Section II).
export const ALERT_THRESHOLDS_DAYS = [90, 30, 7] as const;
