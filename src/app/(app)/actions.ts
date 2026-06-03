"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_ORG_COOKIE, getSessionContext } from "@/lib/auth/session";
import { logAudit } from "@/lib/db/audit";
import { applyDemoScenario } from "@/lib/demo/scenario";
import {
  DEMO_OFFSET_COOKIE,
  clampOffsetDays,
  isDemoMode,
} from "@/lib/demo/clock";

/** Switch the active organization (consultant flipping between client orgs). */
export async function setActiveOrg(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── Demo controls ─────────────────────────────────────────────────────────────
// Both actions hard-refuse unless NEXT_PUBLIC_DEMO_MODE is on, so a production
// deploy can never trigger the destructive reset even if the route is hit
// directly. The flag is also checked client-side to hide the UI.

const DEMO_REVALIDATE = ["/dashboard", "/deadlines", "/simulator"];

/**
 * Restore the demo dataset to its fixed baseline (all demo orgs) and reset the
 * demo clock to "today". Lets a presenter rerun the same scenario on demand.
 */
export async function resetDemoAction() {
  if (!isDemoMode()) return { error: "Demo mode is disabled." };
  const ctx = await getSessionContext();

  const admin = createAdminClient();
  await applyDemoScenario(admin);

  // Clock back to the baseline.
  const cookieStore = await cookies();
  cookieStore.set(DEMO_OFFSET_COOKIE, "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Record the reset (the scenario just cleared this org's audit_log).
  await logAudit(admin, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "demo.reset",
    metadata: { at: new Date().toISOString() },
  });

  for (const p of DEMO_REVALIDATE) revalidatePath(p);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move the simulated demo clock to `days` after the baseline (forward-only). */
export async function setDemoOffsetAction(days: number) {
  if (!isDemoMode()) return { error: "Demo mode is disabled." };
  const clamped = clampOffsetDays(days);
  const cookieStore = await cookies();
  cookieStore.set(DEMO_OFFSET_COOKIE, String(clamped), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  for (const p of DEMO_REVALIDATE) revalidatePath(p);
  revalidatePath("/", "layout");
  return { ok: true, days: clamped };
}
