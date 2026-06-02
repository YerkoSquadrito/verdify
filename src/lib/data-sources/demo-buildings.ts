import type { BuildingLookupResult } from "./types";
import type { Ownership } from "@/lib/compliance";

/**
 * Demo fixtures powering the Building Onboarding screen's animated "live
 * datasource" experience. This is presentation theater for the prototype: the
 * autocomplete, the map locate animation, and the LADBS/LADWP/EPA connection
 * animation read from here so a demo always succeeds instantly, with no network
 * or timeout risk (only the map tiles hit the network).
 *
 * IMPORTANT — this never crosses the determinism boundary. These records only
 * supply building *facts* (address, GFA, ownership, ENERGY STAR context) and
 * presentation metadata (coordinates, serviceable-area status). The compliance
 * schedule on the right of the form is still computed purely by
 * `deriveComplianceSchedule` from the BIN + sqft the user can see and edit. No
 * deadline or fine value is ever mocked. The real Socrata provider stays intact
 * in `socrata.ts` for production lookups.
 *
 * Serviceability: EBEWE applies only inside the City of Los Angeles, whose
 * boundary is coextensive with LADWP's electric/water service territory.
 * Independent cities are out of scope — either served by a different municipal
 * utility (Glendale Water & Power, Burbank Water & Power, …) or by Southern
 * California Edison and not subject to LA's ordinance at all. That is an
 * *ordinance gap*, not a Verdify failure: those buildings have no EBEWE
 * obligation to track.
 */
export interface DemoBuilding {
  bin: string;
  name: string;
  address: string;
  sqft: number;
  ownership: Ownership;
  propertyType: string;
  energyStarScore: number;
  siteEui: number;
  programYear: string;
  /** Map coordinates for the locate animation. */
  lat: number;
  lng: number;
  /** Inside the City of LA / LADWP territory → EBEWE-covered and serviceable. */
  serviceable: boolean;
  /** Neighborhood (serviceable) or city (not serviceable). */
  jurisdiction: string;
  /** Electric/water utility serving the building. */
  utility: string;
}

// Curated, real-sounding LA buildings — all serviceable (inside City of LA,
// served by LADWP). BIN last digits are spread across the range so selecting
// different rows visibly changes the A/RCx cycle in the preview (the last digit
// drives the cycle per LAMC §91.9708). Includes city-owned and below-threshold
// examples for variety.
const SERVICEABLE_BUILDINGS: DemoBuilding[] = [
  {
    bin: "476102819640",
    name: "Figueroa Tower",
    address: "660 S Figueroa St, Los Angeles, CA 90017",
    sqft: 312000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 78,
    siteEui: 61.4,
    programYear: "2024",
    lat: 34.0505,
    lng: -118.2576,
    serviceable: true,
    jurisdiction: "Downtown LA",
    utility: "LADWP",
  },
  {
    bin: "501338274101",
    name: "Wilshire Grand Lofts",
    address: "1248 Wilshire Blvd, Los Angeles, CA 90017",
    sqft: 88500,
    ownership: "private",
    propertyType: "Multifamily Housing",
    energyStarScore: 64,
    siteEui: 49.2,
    programYear: "2024",
    lat: 34.0556,
    lng: -118.2686,
    serviceable: true,
    jurisdiction: "Westlake",
    utility: "LADWP",
  },
  {
    bin: "443907115522",
    name: "Grand Avenue Exchange",
    address: "333 S Grand Ave, Los Angeles, CA 90071",
    sqft: 524000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 85,
    siteEui: 54.8,
    programYear: "2024",
    lat: 34.0527,
    lng: -118.2522,
    serviceable: true,
    jurisdiction: "Downtown LA",
    utility: "LADWP",
  },
  {
    bin: "612845330973",
    name: "Seventh & Hope Plaza",
    address: "725 S Hope St, Los Angeles, CA 90017",
    sqft: 196500,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 71,
    siteEui: 66.0,
    programYear: "2023",
    lat: 34.0469,
    lng: -118.2587,
    serviceable: true,
    jurisdiction: "Downtown LA",
    utility: "LADWP",
  },
  {
    bin: "298471650384",
    name: "Olive Street Commons",
    address: "612 S Olive St, Los Angeles, CA 90014",
    sqft: 47000,
    ownership: "private",
    propertyType: "Mixed Use Property",
    energyStarScore: 58,
    siteEui: 72.3,
    programYear: "2024",
    lat: 34.0461,
    lng: -118.2521,
    serviceable: true,
    jurisdiction: "Downtown LA",
    utility: "LADWP",
  },
  {
    bin: "357019448265",
    name: "City Hall East Annex",
    address: "200 N Main St, Los Angeles, CA 90012",
    sqft: 134000,
    ownership: "city",
    propertyType: "Office",
    energyStarScore: 69,
    siteEui: 58.1,
    programYear: "2024",
    lat: 34.0539,
    lng: -118.2429,
    serviceable: true,
    jurisdiction: "Downtown LA / Civic Center",
    utility: "LADWP",
  },
  {
    bin: "884520176197",
    name: "Vermont Avenue Center",
    address: "3175 Wilshire Blvd, Los Angeles, CA 90010",
    sqft: 261000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 82,
    siteEui: 51.7,
    programYear: "2024",
    lat: 34.0617,
    lng: -118.2917,
    serviceable: true,
    jurisdiction: "Koreatown",
    utility: "LADWP",
  },
  {
    bin: "190663528048",
    name: "Spring Street Arcade",
    address: "541 S Spring St, Los Angeles, CA 90013",
    sqft: 18200,
    ownership: "private",
    propertyType: "Retail Store",
    energyStarScore: 55,
    siteEui: 80.9,
    programYear: "2023",
    lat: 34.0461,
    lng: -118.2494,
    serviceable: true,
    jurisdiction: "Downtown LA / Historic Core",
    utility: "LADWP",
  },
];

// Curated buildings OUTSIDE Verdify's serviceable area — independent cities that
// are not under LA's EBEWE ordinance. Two buckets: cities on their own municipal
// utility (double-excluded: different ordinance AND different utility) and cities
// served by Southern California Edison (outside LA's ordinance).
const NON_SERVICEABLE_BUILDINGS: DemoBuilding[] = [
  {
    bin: "705914628310",
    name: "Ocean Park Offices",
    address: "1620 Santa Monica Blvd, Santa Monica, CA 90404",
    sqft: 142000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 74,
    siteEui: 55.0,
    programYear: "2024",
    lat: 34.0238,
    lng: -118.4842,
    serviceable: false,
    jurisdiction: "Santa Monica",
    utility: "Southern California Edison",
  },
  {
    bin: "318276540992",
    name: "Rodeo Plaza",
    address: "9540 Wilshire Blvd, Beverly Hills, CA 90212",
    sqft: 208000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 81,
    siteEui: 52.4,
    programYear: "2024",
    lat: 34.0668,
    lng: -118.4012,
    serviceable: false,
    jurisdiction: "Beverly Hills",
    utility: "Southern California Edison",
  },
  {
    bin: "927103845561",
    name: "Hayden Tract Studios",
    address: "8800 Washington Blvd, Culver City, CA 90232",
    sqft: 176000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 77,
    siteEui: 53.9,
    programYear: "2024",
    lat: 34.0258,
    lng: -118.3897,
    serviceable: false,
    jurisdiction: "Culver City",
    utility: "Southern California Edison",
  },
  {
    bin: "640582193374",
    name: "Sunset Media Lofts",
    address: "8255 Sunset Blvd, West Hollywood, CA 90046",
    sqft: 96000,
    ownership: "private",
    propertyType: "Multifamily Housing",
    energyStarScore: 66,
    siteEui: 58.7,
    programYear: "2023",
    lat: 34.0954,
    lng: -118.3691,
    serviceable: false,
    jurisdiction: "West Hollywood",
    utility: "Southern California Edison",
  },
  {
    bin: "583920147706",
    name: "Market Street Center",
    address: "330 N Brand Blvd, Glendale, CA 91203",
    sqft: 231000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 79,
    siteEui: 54.1,
    programYear: "2024",
    lat: 34.1488,
    lng: -118.2554,
    serviceable: false,
    jurisdiction: "Glendale",
    utility: "Glendale Water & Power",
  },
  {
    bin: "264817395528",
    name: "Media District Plaza",
    address: "3500 W Olive Ave, Burbank, CA 91505",
    sqft: 188000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 76,
    siteEui: 56.3,
    programYear: "2024",
    lat: 34.1518,
    lng: -118.3382,
    serviceable: false,
    jurisdiction: "Burbank",
    utility: "Burbank Water & Power",
  },
  {
    bin: "471639208845",
    name: "Colorado Boulevard Exchange",
    address: "300 E Colorado Blvd, Pasadena, CA 91101",
    sqft: 214000,
    ownership: "private",
    propertyType: "Office",
    energyStarScore: 83,
    siteEui: 50.8,
    programYear: "2024",
    lat: 34.1459,
    lng: -118.1399,
    serviceable: false,
    jurisdiction: "Pasadena",
    utility: "Pasadena Water & Power",
  },
];

// Full set for the autocomplete — interleave serviceable / non-serviceable so the
// suggestion list itself surfaces both kinds.
export const DEMO_BUILDINGS: DemoBuilding[] = interleave(
  SERVICEABLE_BUILDINGS,
  NON_SERVICEABLE_BUILDINGS,
);

function interleave(a: DemoBuilding[], b: DemoBuilding[]): DemoBuilding[] {
  const out: DemoBuilding[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// Vocabulary for deterministically synthesizing a plausible building when the
// user types a BIN that isn't in the curated set — so the demo never dead-ends.
// One pool per branch keeps the synthesized address consistent with the
// requested serviceability.
const SYNTH_NAMES = [
  "Tower",
  "Lofts",
  "Plaza",
  "Center",
  "Exchange",
  "Commons",
  "Residences",
  "Square",
];
const SYNTH_TYPES = ["Office", "Multifamily Housing", "Mixed Use Property"];

// Serviceable: neighborhoods within the City of LA, all on LADWP.
const SERVICEABLE_AREAS: { neighborhood: string; street: string; lat: number; lng: number }[] = [
  { neighborhood: "Downtown LA", street: "S Figueroa St", lat: 34.0505, lng: -118.2566 },
  { neighborhood: "Westlake", street: "Wilshire Blvd", lat: 34.0578, lng: -118.2773 },
  { neighborhood: "Hollywood", street: "Hollywood Blvd", lat: 34.1016, lng: -118.3267 },
  { neighborhood: "Koreatown", street: "Vermont Ave", lat: 34.0617, lng: -118.2917 },
  { neighborhood: "Van Nuys", street: "Van Nuys Blvd", lat: 34.1866, lng: -118.4487 },
  { neighborhood: "San Pedro", street: "S Pacific Ave", lat: 33.7361, lng: -118.2922 },
  { neighborhood: "Highland Park", street: "N Figueroa St", lat: 34.1119, lng: -118.1922 },
  { neighborhood: "Westchester", street: "S Sepulveda Blvd", lat: 33.9618, lng: -118.3989 },
];

// Not serviceable: independent cities, each on a different utility / outside EBEWE.
const NON_SERVICEABLE_AREAS: { city: string; street: string; zip: string; utility: string; lat: number; lng: number }[] = [
  { city: "Santa Monica", street: "Santa Monica Blvd", zip: "90404", utility: "Southern California Edison", lat: 34.0238, lng: -118.4842 },
  { city: "Beverly Hills", street: "Wilshire Blvd", zip: "90212", utility: "Southern California Edison", lat: 34.0668, lng: -118.4012 },
  { city: "Culver City", street: "Washington Blvd", zip: "90232", utility: "Southern California Edison", lat: 34.0258, lng: -118.3897 },
  { city: "Inglewood", street: "S La Brea Ave", zip: "90301", utility: "Southern California Edison", lat: 33.9617, lng: -118.3531 },
  { city: "Glendale", street: "N Brand Blvd", zip: "91203", utility: "Glendale Water & Power", lat: 34.1488, lng: -118.2554 },
  { city: "Burbank", street: "W Olive Ave", zip: "91505", utility: "Burbank Water & Power", lat: 34.1518, lng: -118.3382 },
  { city: "Pasadena", street: "E Colorado Blvd", zip: "91101", utility: "Pasadena Water & Power", lat: 34.1459, lng: -118.1399 },
  { city: "Long Beach", street: "E Ocean Blvd", zip: "90802", utility: "Southern California Edison", lat: 33.7683, lng: -118.1888 },
];

function cleanBin(bin: string): string {
  return bin.replace(/\D/g, "");
}

// Deterministic positive hash so synthetic data is stable for a given BIN.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Small deterministic coordinate jitter (~±0.01°, a few city blocks) so two
// synthetic buildings in the same area don't stack on the exact same pin.
function jitter(h: number, shift: number): number {
  return (((h >> shift) % 200) - 100) / 10000;
}

/** Suggestions for the autocomplete: match by BIN prefix OR address substring. */
export function searchDemoBuildings(query: string): DemoBuilding[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const digits = cleanBin(query);
  return DEMO_BUILDINGS.filter((b) => {
    const byBin = digits.length > 0 && b.bin.startsWith(digits);
    const byAddress = b.address.toLowerCase().includes(q);
    const byName = b.name.toLowerCase().includes(q);
    return byBin || byAddress || byName;
  }).slice(0, 6);
}

/** Exact cleaned-BIN match against the curated set. */
export function getDemoBuilding(bin: string): DemoBuilding | null {
  const cleaned = cleanBin(bin);
  return DEMO_BUILDINGS.find((b) => b.bin === cleaned) ?? null;
}

/**
 * Deterministic plausible building for any BIN not in the curated set, of the
 * requested serviceability so the strict-toggle demo stays coherent.
 */
export function syntheticBuilding(bin: string, serviceable: boolean): DemoBuilding {
  const cleaned = cleanBin(bin) || bin;
  const h = hash(cleaned);
  const num = 100 + (h % 1900);
  const name = SYNTH_NAMES[(h >> 3) % SYNTH_NAMES.length];
  const type = SYNTH_TYPES[(h >> 5) % SYNTH_TYPES.length];
  const sqft = 22000 + (h % 280) * 1000; // 22k–302k, always covered

  if (serviceable) {
    const area = SERVICEABLE_AREAS[h % SERVICEABLE_AREAS.length];
    return {
      bin: cleaned,
      name: `${num} ${area.street.split(" ").slice(-2).join(" ")} ${name}`,
      address: `${num} ${area.street}, Los Angeles, CA`,
      sqft,
      ownership: "private",
      propertyType: type,
      energyStarScore: 50 + (h % 45),
      siteEui: 45 + (h % 40),
      programYear: "2024",
      lat: area.lat + jitter(h, 2),
      lng: area.lng + jitter(h, 6),
      serviceable: true,
      jurisdiction: area.neighborhood,
      utility: "LADWP",
    };
  }

  const area = NON_SERVICEABLE_AREAS[h % NON_SERVICEABLE_AREAS.length];
  return {
    bin: cleaned,
    name: `${num} ${area.street.split(" ").slice(-2).join(" ")} ${name}`,
    address: `${num} ${area.street}, ${area.city}, CA ${area.zip}`,
    sqft,
    ownership: "private",
    propertyType: type,
    energyStarScore: 50 + (h % 45),
    siteEui: 45 + (h % 40),
    programYear: "2024",
    lat: area.lat + jitter(h, 2),
    lng: area.lng + jitter(h, 6),
    serviceable: false,
    jurisdiction: area.city,
    utility: area.utility,
  };
}

/** Adapt a demo building to the shared lookup-result shape used by the form. */
export function toLookupResult(b: DemoBuilding): BuildingLookupResult {
  return {
    found: true,
    // Demo fills persist as "manual" — the "socrata" enum value is reserved
    // for genuine open-data matches, keeping the audit log honest.
    source: "manual",
    bin: b.bin,
    name: b.name,
    address: b.address,
    sqft: b.sqft,
    ownership: b.ownership,
    raw: b,
    meta: {
      propertyType: b.propertyType,
      energyStarScore: b.energyStarScore,
      siteEui: b.siteEui,
      programYear: b.programYear,
      lat: b.lat,
      lng: b.lng,
      serviceable: b.serviceable,
      jurisdiction: b.jurisdiction,
      utility: b.utility,
    },
  };
}

/**
 * Resolve a BIN to a lookup result of the requested serviceability. A curated
 * exact match is honored only when its serviceability matches what the caller
 * wants (the onboarding form alternates per lookup); otherwise we synthesize a
 * building of the requested kind so the demo always shows the intended branch.
 */
export function resolveDemoLookup(
  bin: string,
  serviceable: boolean,
): BuildingLookupResult {
  const curated = getDemoBuilding(bin);
  if (curated && curated.serviceable === serviceable) {
    return toLookupResult(curated);
  }
  return toLookupResult(syntheticBuilding(bin, serviceable));
}

/**
 * Plain-language explanation of why a building outside the serviceable area
 * can't be added. Names the city and its utility, and frames the gap honestly:
 * these buildings have no EBEWE obligation, so there's nothing for Verdify to
 * track — it's an ordinance gap, not a utility failure.
 */
export function serviceabilityMessage(result: BuildingLookupResult): string {
  const city = result.meta?.jurisdiction ?? "this city";
  const utility = result.meta?.utility ?? "a different utility";
  return (
    `This building is in ${city}, outside the City of Los Angeles. ` +
    `EBEWE applies only to buildings within City of LA limits — the boundary ` +
    `that's coextensive with LADWP's service territory. ${city} is served by ` +
    `${utility} and is not subject to LA's EBEWE ordinance, so there's no ` +
    `EBEWE compliance for Verdify to track here. This is an ordinance gap, not ` +
    `a coverage failure — these buildings simply aren't in scope today.`
  );
}
