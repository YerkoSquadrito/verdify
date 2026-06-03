/**
 * The Verdify demo dataset — single source of truth, imported by BOTH the seed
 * script (`pnpm seed`) and the in-app Reset Demo button. Defining it once means
 * the CLI seed and the live reset can never drift apart.
 *
 * `applyDemoScenario` is idempotent: it find-or-creates the demo tenancy (users,
 * orgs, memberships — never duplicated) and then fully rebuilds the per-org
 * building data to a fixed baseline, so a presenter gets the exact same starting
 * state every reset, whether the DB was empty or mid-demo.
 *
 * Critically, it keeps the two consultants' client orgs DISJOINT (Pegasus 40
 * buildings / Hillmann 20), so the white-label RLS isolation guarantee stays an
 * executable acceptance test (`pnpm verify:rls`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_PASSWORD = "verdify-demo";

const MS_PER_DAY = 86_400_000;
const VAULT = "vault";

type Role = "building_owner" | "property_manager" | "energy_consultant";
type OrgType = "owner" | "property_mgmt" | "consultant";
type EventType = "benchmark_submitted" | "arcx_completed" | "violation_issued";

interface BuildingRow {
  bin: string;
  name: string;
  address: string;
  sqft: number;
  ownership: "private" | "city";
  data_source: "manual";
}

/** A building plus the compliance events to seed for it, dated relative to the
 *  reset moment so "offset 0" is always the demo baseline. */
export interface BuildingFixture {
  building: BuildingRow;
  events: { event_type: EventType; daysAgo: number }[];
}

// ── Demo users ────────────────────────────────────────────────────────────────
const DEMO_USERS = [
  { email: "manager@sunsetpm.test", fullName: "Dana Reyes" },
  { email: "consultant@pegasus.test", fullName: "Alex Kim" },
  { email: "consultant@hillmann.test", fullName: "Jordan Pierce" },
  { email: "owner@independent.test", fullName: "Sam Whitfield" },
] as const;

// ── Curated primary portfolio (Sunset PM) ─────────────────────────────────────
// Hand-designed so a presenter can hit every feature on script. BIN last digits
// are deliberate (they key the A/RCx cycle, LAMC §91.9708 Table 9708.2), and the
// violation ages place each fine at a distinct §98.0411(c) escalation stage.
export function sunsetBuildings(): BuildingFixture[] {
  return [
    {
      // Fresh fine — pay-fine demo at the clean $202 base balance.
      building: row("100002000010", "612 Figueroa Tower", "612 S Figueroa St", 48000, "private"),
      events: [{ event_type: "violation_issued", daysAgo: 5 }],
    },
    {
      // Late charge just triggered — the $202 → $707 jump (day 30).
      building: row("100002000021", "888 Wilshire Plaza", "888 Wilshire Blvd", 61000, "private"),
      events: [{ event_type: "violation_issued", daysAgo: 35 }],
    },
    {
      // Long-overdue — interest compounding past the half-year mark (~$760+).
      building: row("100002000032", "433 Grand Exchange", "433 S Grand Ave", 88000, "private"),
      events: [{ event_type: "violation_issued", daysAgo: 200 }],
    },
    {
      // Benchmarked this cycle — compliant tile.
      building: row("100002000043", "215 Olive Court", "215 S Olive St", 34000, "private"),
      events: [{ event_type: "benchmark_submitted", daysAgo: 20 }],
    },
    {
      // Fully compliant — benchmark + A/RCx both satisfied.
      building: row("100002000054", "350 Hope Center", "350 S Hope St", 52000, "private"),
      events: [
        { event_type: "benchmark_submitted", daysAgo: 25 },
        { event_type: "arcx_completed", daysAgo: 120 },
      ],
    },
    // Clean buildings awaiting the next cycle — they flip to "approaching" and
    // light up the Deadline Engine as the slider advances toward the deadlines.
    // Spread last digits 5–9 so their A/RCx dates fall in different years.
    { building: row("100002000065", "700 Spring Lofts", "700 Spring St", 26500, "private"), events: [] },
    { building: row("100002000076", "1010 Hill Commons", "1010 S Hill St", 24000, "private"), events: [] },
    { building: row("100002000087", "240 Main Square", "240 Main St", 21500, "private"), events: [] },
    { building: row("100002000098", "55 Broadway Arcade", "55 Broadway", 33000, "private"), events: [] },
    { building: row("100002000109", "1400 Flower Residences", "1400 Flower St", 28500, "private"), events: [] },
  ];
}

function row(
  bin: string,
  name: string,
  street: string,
  sqft: number,
  ownership: "private" | "city",
): BuildingRow {
  return {
    bin,
    name,
    address: `${street}, Los Angeles, CA`,
    sqft,
    ownership,
    data_source: "manual",
  };
}

// ── Generated portfolios (consultant + owner orgs) ────────────────────────────
const STREETS = [
  "S Figueroa St", "Wilshire Blvd", "S Grand Ave", "W 7th St", "Spring St",
  "S Olive St", "Sunset Blvd", "S Hope St", "Flower St", "Main St",
  "Broadway", "S Hill St", "Alameda St", "Santa Monica Blvd", "Vermont Ave",
];
const NAMES = [
  "Tower", "Lofts", "Plaza", "Center", "Court", "Exchange", "Building",
  "Commons", "Residences", "Square", "Arcade", "Gardens",
];
const VIOLATION_AGES = [75, 20, 45, 210, 120]; // varied fine stages

/**
 * Deterministic building generator (lifted from the original seed) for the
 * consultant and owner orgs. Index-derived, no randomness — so the seeded counts
 * stay exact and `pnpm verify:rls` (Pegasus 40 / Hillmann 20) stays green.
 */
export function generateBuildings(orgSeed: number, count: number): BuildingFixture[] {
  const sqfts = [21500, 34000, 52000, 28500, 47000, 61000, 24000, 88000, 33000, 26500];
  let violationCursor = orgSeed;
  return Array.from({ length: count }, (_, i): BuildingFixture => {
    const lastDigit = i % 10;
    const bin = String(100_000_000_000 + orgSeed * 100_000 + i * 10 + lastDigit);
    const street = STREETS[(orgSeed + i) % STREETS.length];
    const num = 200 + ((orgSeed * 7 + i * 13) % 1800);
    const building = row(
      bin,
      `${num} ${street.split(" ")[1] ?? street} ${NAMES[i % NAMES.length]}`,
      `${num} ${street}`,
      sqfts[i % sqfts.length],
      i % 9 === 0 ? "city" : "private",
    );
    const events: BuildingFixture["events"] = [];
    if (i % 5 === 0) {
      events.push({
        event_type: "violation_issued",
        daysAgo: VIOLATION_AGES[violationCursor++ % VIOLATION_AGES.length],
      });
    } else if (i % 2 === 1) {
      events.push({ event_type: "benchmark_submitted", daysAgo: 40 });
      if (i % 4 === 1) events.push({ event_type: "arcx_completed", daysAgo: 120 });
    }
    return { building, events };
  });
}

// ── Org definitions ───────────────────────────────────────────────────────────
interface DemoOrgDef {
  key: string;
  name: string;
  type: OrgType;
  subdomain: string | null;
  memberEmail: string;
  role: Role;
  fixtures: () => BuildingFixture[];
}

const DEMO_ORGS: DemoOrgDef[] = [
  {
    key: "sunset",
    name: "Sunset Property Management",
    type: "property_mgmt",
    subdomain: null,
    memberEmail: "manager@sunsetpm.test",
    role: "property_manager",
    fixtures: sunsetBuildings,
  },
  // Pegasus consultant — 3 disjoint client orgs (40 buildings total).
  { key: "figueroa", name: "Figueroa Holdings", type: "property_mgmt", subdomain: "pegasus-figueroa", memberEmail: "consultant@pegasus.test", role: "energy_consultant", fixtures: () => generateBuildings(10, 14) },
  { key: "wilshire", name: "Wilshire Asset Group", type: "property_mgmt", subdomain: "pegasus-wilshire", memberEmail: "consultant@pegasus.test", role: "energy_consultant", fixtures: () => generateBuildings(11, 13) },
  { key: "arts", name: "Arts District Lofts", type: "owner", subdomain: "pegasus-arts", memberEmail: "consultant@pegasus.test", role: "energy_consultant", fixtures: () => generateBuildings(12, 13) },
  // Hillmann consultant — 2 separate client orgs (20 buildings total).
  { key: "harbor", name: "Harbor Industrial LLC", type: "property_mgmt", subdomain: "hillmann-harbor", memberEmail: "consultant@hillmann.test", role: "energy_consultant", fixtures: () => generateBuildings(20, 10) },
  { key: "valley", name: "Valley Office Partners", type: "property_mgmt", subdomain: "hillmann-valley", memberEmail: "consultant@hillmann.test", role: "energy_consultant", fixtures: () => generateBuildings(21, 10) },
  // Single building owner.
  { key: "maple", name: "Maple Street Holdings", type: "owner", subdomain: null, memberEmail: "owner@independent.test", role: "building_owner", fixtures: () => generateBuildings(30, 1) },
];

// ── Tenancy provisioning (idempotent) ─────────────────────────────────────────
async function getOrCreateUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (data?.user) return data.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (!found) throw new Error(`Could not resolve user ${email}`);
  return found.id;
}

async function findOrCreateOrg(
  admin: SupabaseClient,
  def: DemoOrgDef,
): Promise<string> {
  // Subdomain is unique when present; otherwise match on name.
  const query = admin.from("organizations").select("id");
  const { data: existing } = def.subdomain
    ? await query.eq("subdomain", def.subdomain).maybeSingle()
    : await query.eq("name", def.name).is("subdomain", null).maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("organizations")
    .insert({ name: def.name, type: def.type, subdomain: def.subdomain })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensureMembership(
  admin: SupabaseClient,
  userId: string,
  orgId: string,
  role: Role,
) {
  const { data: existing } = await admin
    .from("memberships")
    .select("user_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (existing) return;
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userId, org_id: orgId, role });
  if (error) throw error;
}

interface ResolvedOrg {
  def: DemoOrgDef;
  orgId: string;
}

async function ensureDemoTenancy(admin: SupabaseClient): Promise<ResolvedOrg[]> {
  const userIds = new Map<string, string>();
  for (const u of DEMO_USERS) {
    userIds.set(u.email, await getOrCreateUser(admin, u.email, u.fullName));
  }
  const resolved: ResolvedOrg[] = [];
  for (const def of DEMO_ORGS) {
    const orgId = await findOrCreateOrg(admin, def);
    await ensureMembership(admin, userIds.get(def.memberEmail)!, orgId, def.role);
    resolved.push({ def, orgId });
  }
  return resolved;
}

// ── Storage cleanup ───────────────────────────────────────────────────────────
/** Remove every vault object under an org's prefix ({orgId}/{buildingId}/...). */
async function removeVaultObjects(admin: SupabaseClient, orgId: string) {
  const bucket = admin.storage.from(VAULT);
  const { data: folders } = await bucket.list(orgId, { limit: 1000 });
  if (!folders || folders.length === 0) return;

  const paths: string[] = [];
  for (const folder of folders) {
    const { data: files } = await bucket.list(`${orgId}/${folder.name}`, {
      limit: 1000,
    });
    if (files && files.length) {
      for (const f of files) paths.push(`${orgId}/${folder.name}/${f.name}`);
    } else {
      paths.push(`${orgId}/${folder.name}`);
    }
  }
  if (paths.length) await bucket.remove(paths);
}

// ── Apply ─────────────────────────────────────────────────────────────────────
/**
 * Rebuild the demo dataset to its fixed baseline. Safe to run repeatedly:
 *  1. find-or-create the demo tenancy (users/orgs/memberships)
 *  2. clear each org's vault objects (Storage RLS does not cascade)
 *  3. delete its buildings (cascades events/documents/alerts) + audit_log rows
 *  4. re-insert the curated/generated buildings and their compliance events
 */
export async function applyDemoScenario(admin: SupabaseClient): Promise<void> {
  const tenancy = await ensureDemoTenancy(admin);
  const base = Date.now();
  const dateOf = (daysAgo: number) =>
    new Date(base - daysAgo * MS_PER_DAY).toISOString().slice(0, 10);

  for (const { def, orgId } of tenancy) {
    await removeVaultObjects(admin, orgId);

    // Cascades to compliance_events, documents, and alerts (FK on delete cascade).
    const { error: delErr } = await admin
      .from("buildings")
      .delete()
      .eq("org_id", orgId);
    if (delErr) throw delErr;

    // audit_log FK is `on delete set null`, so it must be cleared explicitly.
    await admin.from("audit_log").delete().eq("org_id", orgId);

    const fixtures = def.fixtures();
    const { data: inserted, error: insErr } = await admin
      .from("buildings")
      .insert(fixtures.map((f) => ({ org_id: orgId, ...f.building })))
      .select("id");
    if (insErr) throw insErr;

    const events = (inserted ?? []).flatMap((b, i) =>
      fixtures[i].events.map((e) => ({
        org_id: orgId,
        building_id: b.id,
        event_type: e.event_type,
        event_date: dateOf(e.daysAgo),
      })),
    );
    if (events.length) {
      const { error: evErr } = await admin
        .from("compliance_events")
        .insert(events);
      if (evErr) throw evErr;
    }
  }
}
