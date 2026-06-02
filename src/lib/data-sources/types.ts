import type { Ownership } from "@/lib/compliance";

export interface BuildingLookupResult {
  found: boolean;
  source: "socrata" | "manual";
  bin: string;
  name?: string;
  address?: string;
  sqft?: number;
  ownership?: Ownership;
  /** Raw provider payload, persisted to buildings.source_raw for audit. */
  raw?: unknown;
  /** True when an automated source failed/timed out and we fell back. */
  degraded?: boolean;
  /** Optional extra context surfaced from open data (EUI, ENERGY STAR, status). */
  meta?: {
    propertyType?: string;
    complianceStatus?: string;
    energyStarScore?: number;
    siteEui?: number;
    programYear?: string;
    /** Map coordinates for the locate animation (demo fixtures only). */
    lat?: number;
    lng?: number;
    /** Whether the building sits inside Verdify's serviceable area (City of LA / LADWP). */
    serviceable?: boolean;
    /** Neighborhood or city the building sits in (e.g. "Downtown LA", "Santa Monica"). */
    jurisdiction?: string;
    /** Electric/water utility serving the building (e.g. "LADWP", "Glendale Water & Power"). */
    utility?: string;
  };
}

export interface BuildingLookupProvider {
  name: "socrata";
  lookup(bin: string): Promise<BuildingLookupResult | null>;
}
