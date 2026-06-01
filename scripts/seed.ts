/* eslint-disable no-console */
/**
 * Seed demo data for the Verdify prototype. Run after `pnpm db:reset`:
 *   pnpm seed
 *
 * Creates four role surfaces and — critically — TWO consultants whose client
 * orgs are disjoint, so the white-label RLS isolation guarantee is an
 * executable acceptance test: signed in as Pegasus, you can never see Hillmann.
 *
 * Uses the service-role client (bypasses RLS) to write across orgs. Reproducible
 * (index-derived values, no randomness in building data).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Minimal .env.local loader (no dotenv dependency) ─────────────────────────
function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !SERVICE_ROLE) {
  console.error("Missing Supabase env. Did you run `supabase start`?");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "verdify-demo";
const TODAY = Date.now();
const daysAgoISO = (d: number) =>
  new Date(TODAY - d * 86_400_000).toISOString().slice(0, 10);

type Role = "building_owner" | "property_manager" | "energy_consultant";
type OrgType = "owner" | "property_mgmt" | "consultant";

const STREETS = [
  "S Figueroa St", "Wilshire Blvd", "S Grand Ave", "W 7th St", "Spring St",
  "S Olive St", "Sunset Blvd", "S Hope St", "Flower St", "Main St",
  "Broadway", "S Hill St", "Alameda St", "Santa Monica Blvd", "Vermont Ave",
];
const NAMES = [
  "Tower", "Lofts", "Plaza", "Center", "Court", "Exchange", "Building",
  "Commons", "Residences", "Square", "Arcade", "Gardens",
];

async function getOrCreateUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (data?.user) return data.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  // Already exists — find it.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (!found) throw new Error(`Could not resolve user ${email}`);
  return found.id;
}

async function createOrg(
  name: string,
  type: OrgType,
  subdomain: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("organizations")
    .insert({ name, type, subdomain })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function addMember(userId: string, orgId: string, role: Role) {
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userId, org_id: orgId, role });
  if (error) throw error;
}

interface EventSpec {
  type: "benchmark_submitted" | "arcx_completed" | "violation_issued";
  date: string;
}

const VIOLATION_AGES = [75, 20, 45, 210, 120]; // varied fine stages
let violationCursor = 0;

/** Generate `count` buildings for an org with varied statuses + BIN digits. */
async function seedBuildings(orgId: string, orgSeed: number, count: number) {
  const buildingRows = Array.from({ length: count }, (_, i) => {
    const lastDigit = i % 10;
    const bin = String(100_000_000_000 + orgSeed * 100_000 + i * 10 + lastDigit);
    const sqft = [21500, 34000, 52000, 28500, 47000, 61000, 24000, 88000, 33000, 26500][i % 10];
    const ownership = i % 9 === 0 ? "city" : "private";
    const street = STREETS[(orgSeed + i) % STREETS.length];
    const num = 200 + ((orgSeed * 7 + i * 13) % 1800);
    return {
      org_id: orgId,
      bin,
      name: `${num} ${street.split(" ")[1] ?? street} ${NAMES[i % NAMES.length]}`,
      address: `${num} ${street}, Los Angeles, CA`,
      sqft,
      ownership,
      data_source: "manual" as const,
    };
  });

  const { data: inserted, error } = await admin
    .from("buildings")
    .insert(buildingRows)
    .select("id");
  if (error) throw error;

  const events: {
    org_id: string;
    building_id: string;
    event_type: EventSpec["type"];
    event_date: string;
  }[] = [];

  inserted.forEach((b, i) => {
    if (i % 5 === 0) {
      // Violation — drives the live fine counter, cycling through stages.
      const age = VIOLATION_AGES[violationCursor++ % VIOLATION_AGES.length];
      events.push({
        org_id: orgId,
        building_id: b.id,
        event_type: "violation_issued",
        event_date: daysAgoISO(age),
      });
    } else if (i % 2 === 1) {
      // Benchmarked this cycle → compliant (rolls deadline to next June 1).
      events.push({
        org_id: orgId,
        building_id: b.id,
        event_type: "benchmark_submitted",
        event_date: daysAgoISO(40),
      });
      if (i % 4 === 1) {
        events.push({
          org_id: orgId,
          building_id: b.id,
          event_type: "arcx_completed",
          event_date: daysAgoISO(120),
        });
      }
    }
    // remaining buildings: no events → "approaching" (June 1 imminent).
  });

  if (events.length) {
    const { error: evErr } = await admin.from("compliance_events").insert(events);
    if (evErr) throw evErr;
  }
}

async function main() {
  console.log("Seeding Verdify demo data…");

  // ── Users ──────────────────────────────────────────────────────────────────
  const managerId = await getOrCreateUser("manager@sunsetpm.test", "Dana Reyes");
  const pegasusId = await getOrCreateUser("consultant@pegasus.test", "Alex Kim");
  const hillmannId = await getOrCreateUser("consultant@hillmann.test", "Jordan Pierce");
  const ownerId = await getOrCreateUser("owner@independent.test", "Sam Whitfield");

  // ── Property manager: one org, 12 buildings ─────────────────────────────────
  const sunset = await createOrg("Sunset Property Management", "property_mgmt", null);
  await addMember(managerId, sunset, "property_manager");
  await seedBuildings(sunset, 1, 12);

  // ── Pegasus consultant: 3 disjoint client orgs (white-label book) ───────────
  const pegasusClients = [
    await createOrg("Figueroa Holdings", "property_mgmt", "pegasus-figueroa"),
    await createOrg("Wilshire Asset Group", "property_mgmt", "pegasus-wilshire"),
    await createOrg("Arts District Lofts", "owner", "pegasus-arts"),
  ];
  const pegasusCounts = [14, 13, 13];
  for (let i = 0; i < pegasusClients.length; i++) {
    await addMember(pegasusId, pegasusClients[i], "energy_consultant");
    await seedBuildings(pegasusClients[i], 10 + i, pegasusCounts[i]);
  }

  // ── Hillmann consultant: 2 SEPARATE client orgs (isolation counterpart) ─────
  const hillmannClients = [
    await createOrg("Harbor Industrial LLC", "property_mgmt", "hillmann-harbor"),
    await createOrg("Valley Office Partners", "property_mgmt", "hillmann-valley"),
  ];
  for (let i = 0; i < hillmannClients.length; i++) {
    await addMember(hillmannId, hillmannClients[i], "energy_consultant");
    await seedBuildings(hillmannClients[i], 20 + i, 10);
  }

  // ── Single building owner ───────────────────────────────────────────────────
  const owned = await createOrg("Maple Street Holdings", "owner", null);
  await addMember(ownerId, owned, "building_owner");
  await seedBuildings(owned, 30, 1);

  console.log("✓ Seed complete.");
  console.log("  Property manager : manager@sunsetpm.test");
  console.log("  Pegasus consult. : consultant@pegasus.test (3 client orgs, 40 buildings)");
  console.log("  Hillmann consult.: consultant@hillmann.test (2 client orgs, isolation check)");
  console.log("  Building owner   : owner@independent.test");
  console.log(`  Password         : ${PASSWORD}`);
}

main().catch((e: unknown) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
