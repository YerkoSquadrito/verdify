import { DEMO_BUILDINGS } from "./demo-buildings";

/**
 * Resolve coordinates for the building-detail map. The buildings table stores no
 * lat/lng (see migration 0003), so we resolve them at render time. Strategy,
 * deterministic and offline (only the map tiles hit the network):
 *
 *   1. Exact match against a curated demo building by BIN, then by address.
 *   2. Otherwise a deterministic point inside Downtown LA, derived from a hash
 *      of the BIN — created buildings are always serviceable (the onboarding
 *      flow blocks out-of-area ones), so a City-of-LA fallback is always correct.
 */

// Downtown LA bounding box for the deterministic fallback (kept tight so the
// pin always lands on real city streets).
const LA_CENTER = { lat: 34.0505, lng: -118.2526 };
const LA_SPREAD = 0.045; // ~5 km in each direction

function cleanBin(bin: string): string {
  return bin.replace(/\D/g, "");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function resolveCoords(
  address: string | null,
  bin: string,
): { lat: number; lng: number } {
  const cleaned = cleanBin(bin);
  const byBin = DEMO_BUILDINGS.find((b) => b.bin === cleaned);
  if (byBin) return { lat: byBin.lat, lng: byBin.lng };

  if (address) {
    const normalized = address.trim().toLowerCase();
    const byAddress = DEMO_BUILDINGS.find(
      (b) => b.address.toLowerCase() === normalized,
    );
    if (byAddress) return { lat: byAddress.lat, lng: byAddress.lng };
  }

  // Deterministic fallback within Downtown LA.
  const h = hash(cleaned || address || "verdify");
  const latOffset = ((h % 1000) / 1000 - 0.5) * 2 * LA_SPREAD;
  const lngOffset = (((h >> 10) % 1000) / 1000 - 0.5) * 2 * LA_SPREAD;
  return { lat: LA_CENTER.lat + latOffset, lng: LA_CENTER.lng + lngOffset };
}
