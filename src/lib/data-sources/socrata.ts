import type { BuildingLookupProvider, BuildingLookupResult } from "./types";
import type { Ownership } from "@/lib/compliance";

// LA Open Data Portal — EBEWE compliance dataset (Socrata / SODA API).
// Verified dataset resource id; queryable by building_id without auth.
const DATASET = "9yda-i4ya";
const BASE = `https://data.lacity.org/resource/${DATASET}.json`;
const TIMEOUT_MS = 6000;

interface SocrataRow {
  building_id?: string;
  building_address?: string;
  property_gfa_1?: string; // gross floor area (sqft)
  primary_property_1?: string; // primary property type
  compliance?: string;
  energy_star_score?: string;
  site_eui?: string;
  program_year?: string;
}

function parseSqft(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * LA Open Data EBEWE provider. Wrapped in a timeout + try/catch: on ANY failure
 * (network, schema drift, empty result) it returns null so the orchestrator can
 * degrade gracefully to manual entry. It never throws to the caller — that is
 * the contractual continuity guarantee around the fragile open-data dependency.
 */
export const socrataProvider: BuildingLookupProvider = {
  name: "socrata",
  async lookup(bin: string): Promise<BuildingLookupResult | null> {
    const cleaned = bin.replace(/\D/g, "");
    if (!cleaned) return null;

    // Pull the most recent few program years and coalesce per field — the
    // latest row can have null GFA/type while an older one is populated.
    const url = `${BASE}?building_id=${encodeURIComponent(cleaned)}&$order=program_year DESC&$limit=5`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as SocrataRow[];
      if (!rows?.[0]?.building_id) return null;

      const firstOf = (pick: (r: SocrataRow) => string | undefined) => {
        for (const r of rows) {
          const v = pick(r);
          if (v != null && String(v).trim() !== "") return v;
        }
        return undefined;
      };

      const sqft = parseSqft(firstOf((r) => r.property_gfa_1));
      const esScore = firstOf((r) => r.energy_star_score);
      const eui = firstOf((r) => r.site_eui);
      // The EBEWE dataset covers privately/state-owned benchmarked buildings;
      // default ownership to private (the user can override before save).
      const ownership: Ownership = "private";

      return {
        found: true,
        source: "socrata",
        bin: cleaned,
        address: firstOf((r) => r.building_address)?.trim(),
        sqft,
        ownership,
        raw: rows[0],
        meta: {
          propertyType: firstOf((r) => r.primary_property_1),
          complianceStatus: firstOf((r) => r.compliance),
          energyStarScore: esScore ? Number(esScore) : undefined,
          siteEui: eui ? Number(eui) : undefined,
          programYear: firstOf((r) => r.program_year),
        },
      };
    } catch {
      return null; // timeout / network / parse — degrade to manual
    } finally {
      clearTimeout(timer);
    }
  },
};
