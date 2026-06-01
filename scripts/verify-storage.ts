/* eslint-disable no-console */
// Verify the vault's Storage RLS double-gating: a user can read/write objects
// under their own org's path, and CANNOT touch another org's objects.
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
const PASSWORD = "verdify-demo";

let failures = 0;
const ok = (n: string, p: boolean, d = "") => {
  console.log(`${p ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`);
  if (!p) failures++;
};

async function asUser(email: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

async function main() {
  const pegasus = await asUser("consultant@pegasus.test");
  const hillmann = await asUser("consultant@hillmann.test");

  const { data: pegBuilding } = await pegasus
    .from("buildings")
    .select("id, org_id")
    .limit(1)
    .single();
  const path = `${pegBuilding!.org_id}/${pegBuilding!.id}/smoke-${Date.now()}.txt`;

  const up = await pegasus.storage
    .from("vault")
    .upload(path, Buffer.from("compliance evidence"), { contentType: "text/plain" });
  ok("Owner org can upload to its vault path", !up.error, up.error?.message);

  const dl = await pegasus.storage.from("vault").createSignedUrl(path, 60);
  ok("Owner org can sign its own object", !dl.error && !!dl.data?.signedUrl);

  // Hillmann attempts to read/sign a Pegasus object → must fail.
  const leak = await hillmann.storage.from("vault").createSignedUrl(path, 60);
  ok("Other org CANNOT sign the object", !!leak.error || !leak.data);

  // Hillmann attempts to write into a Pegasus org path → must fail.
  const intrude = await hillmann.storage
    .from("vault")
    .upload(`${pegBuilding!.org_id}/x/intrude.txt`, Buffer.from("x"));
  ok("Other org CANNOT write into the path", !!intrude.error);

  console.log(failures === 0 ? "\nSTORAGE ISOLATION PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("verify-storage failed:", e.message);
  process.exit(1);
});
