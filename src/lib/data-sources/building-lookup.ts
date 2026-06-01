import { socrataProvider } from "./socrata";
import type { BuildingLookupResult } from "./types";

export type { BuildingLookupResult } from "./types";

/**
 * Look up a building by LADBS Building ID, degrading gracefully to manual entry.
 *
 * Tries the LA Open Data (Socrata) provider first; if it returns null for any
 * reason — network failure, schema drift, or simply no match — we return a
 * manual result that signals the UI to present an editable, prefill-free form.
 * The manual path has zero external dependencies and CANNOT fail. This is the
 * "manual upload fallback must always work" guarantee from CLAUDE.md made
 * concrete: automation is a convenience layered on top of a path that always
 * works, never a single point of failure.
 */
export async function lookupBuilding(
  bin: string,
): Promise<BuildingLookupResult> {
  const cleaned = bin.replace(/\D/g, "");

  const fromSocrata = await socrataProvider.lookup(cleaned);
  if (fromSocrata) return fromSocrata;

  return {
    found: false,
    source: "manual",
    bin: cleaned || bin,
    degraded: true,
  };
}
