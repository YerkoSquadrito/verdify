/* eslint-disable no-console */
// Executable acceptance test for the white-label isolation guarantee.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "verdify-demo";

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

async function asUser(email: string) {
  const c = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

async function main() {
  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ground truth from the service role.
  const { data: allOrgs } = await admin.from("organizations").select("id, name");
  const hillmannOrgs = (allOrgs ?? []).filter((o) =>
    ["Harbor Industrial LLC", "Valley Office Partners"].includes(o.name),
  );
  const pegasusOrgs = (allOrgs ?? []).filter((o) =>
    ["Figueroa Holdings", "Wilshire Asset Group", "Arts District Lofts"].includes(o.name),
  );

  // ── Pegasus consultant ──
  const pegasus = await asUser("consultant@pegasus.test");
  const { data: pegOrgs } = await pegasus.from("organizations").select("id, name");
  const pegOrgIds = new Set((pegOrgs ?? []).map((o) => o.id));
  check("Pegasus sees exactly its 3 client orgs", pegOrgs?.length === 3, `saw ${pegOrgs?.length}`);
  check(
    "Pegasus sees NO Hillmann org",
    hillmannOrgs.every((h) => !pegOrgIds.has(h.id)),
  );

  const { data: pegBuildings } = await pegasus.from("buildings").select("id");
  check("Pegasus sees its 40 buildings", pegBuildings?.length === 40, `saw ${pegBuildings?.length}`);

  // Targeted attempt to read a Hillmann org row by id → must be empty.
  const hid = hillmannOrgs[0]?.id;
  const { data: leak } = await pegasus.from("organizations").select("id").eq("id", hid);
  check("Pegasus cannot fetch a Hillmann org by id", (leak?.length ?? 0) === 0);

  // Attempt to read Hillmann buildings → empty.
  const { data: hBuildings } = await admin
    .from("buildings")
    .select("id, org_id")
    .eq("org_id", hid)
    .limit(1);
  const hBuildingId = hBuildings?.[0]?.id;
  const { data: leak2 } = await pegasus.from("buildings").select("id").eq("id", hBuildingId);
  check("Pegasus cannot fetch a Hillmann building by id", (leak2?.length ?? 0) === 0);

  // ── Hillmann consultant ──
  const hillmann = await asUser("consultant@hillmann.test");
  const { data: hOrgs } = await hillmann.from("organizations").select("id");
  const hOrgIds = new Set((hOrgs ?? []).map((o) => o.id));
  check("Hillmann sees exactly its 2 client orgs", hOrgs?.length === 2, `saw ${hOrgs?.length}`);
  check(
    "Hillmann sees NO Pegasus org",
    pegasusOrgs.every((p) => !hOrgIds.has(p.id)),
  );

  // Disjointness.
  const overlap = [...pegOrgIds].filter((id) => hOrgIds.has(id));
  check("Consultant org sets are disjoint", overlap.length === 0);

  // ── Single owner sees only their 1 building ──
  const owner = await asUser("owner@independent.test");
  const { data: ownerBuildings } = await owner.from("buildings").select("id");
  check("Owner sees exactly 1 building", ownerBuildings?.length === 1, `saw ${ownerBuildings?.length}`);

  // ── Property manager sees the curated Sunset portfolio ──
  const pm = await asUser("manager@sunsetpm.test");
  const { data: pmBuildings } = await pm.from("buildings").select("id");
  check("Property manager sees 10 buildings", pmBuildings?.length === 10, `saw ${pmBuildings?.length}`);

  console.log(failures === 0 ? "\nALL ISOLATION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-rls failed:", e.message);
  process.exit(1);
});
