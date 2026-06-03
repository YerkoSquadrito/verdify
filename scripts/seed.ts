/**
 * Seed demo data for the Verdify prototype. Run after `pnpm db:reset`:
 *   pnpm seed
 *
 * Thin wrapper over the shared scenario in src/lib/demo/scenario.ts — the SAME
 * code the in-app "Reset Demo" button runs, so the CLI seed and the live reset
 * can never drift. Creates four role surfaces and two consultants whose client
 * orgs are disjoint, so the white-label RLS isolation guarantee is an executable
 * acceptance test: signed in as Pegasus, you can never see Hillmann.
 *
 * Uses the service-role client (bypasses RLS) and is idempotent.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { applyDemoScenario, DEMO_PASSWORD } from "../src/lib/demo/scenario";

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

async function main() {
  console.log("Seeding Verdify demo data…");
  await applyDemoScenario(admin);
  console.log("✓ Seed complete.");
  console.log("  Property manager : manager@sunsetpm.test (Sunset PM, 10 curated buildings)");
  console.log("  Pegasus consult. : consultant@pegasus.test (3 client orgs, 40 buildings)");
  console.log("  Hillmann consult.: consultant@hillmann.test (2 client orgs, 20 buildings)");
  console.log("  Building owner   : owner@independent.test");
  console.log(`  Password         : ${DEMO_PASSWORD}`);
}

main().catch((e: unknown) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
