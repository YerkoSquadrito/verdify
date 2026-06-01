import { COVERAGE_SQFT_CITY, COVERAGE_SQFT_PRIVATE } from "./rules";
import type { Ownership } from "./types";

/**
 * Whether a building falls under EBEWE coverage.
 *
 * EBEWE Ordinance scope: privately owned buildings ≥ 20,000 sq ft and
 * city-owned buildings ≥ 7,500 sq ft. Isolating the threshold here means a
 * future ordinance change is a one-line edit with its citation intact.
 *
 * NOTE (build-time flag): A/RCx applicability may apply to a size subset; the
 * coverage floor used here is the 20,000 sq ft benchmarking threshold. Confirm
 * against LAMC §91.9706 before treating coverage and A/RCx-applicability as
 * identical.
 */
export function isCovered(sqft: number, ownership: Ownership): boolean {
  const threshold =
    ownership === "city" ? COVERAGE_SQFT_CITY : COVERAGE_SQFT_PRIVATE;
  return sqft >= threshold;
}
