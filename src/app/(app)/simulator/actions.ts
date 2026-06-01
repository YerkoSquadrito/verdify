"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { logAudit } from "@/lib/db/audit";

/** Record a simulator run in the audit log (audit-readiness by default). */
export async function logSimulationAction(input: {
  buildingId?: string | null;
  violationDate: string;
  daysElapsed: number;
  projectedBalance: number;
}) {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "simulator.run",
    targetType: input.buildingId ? "building" : "scenario",
    targetId: input.buildingId ?? null,
    metadata: {
      violationDate: input.violationDate,
      daysElapsed: input.daysElapsed,
      projectedBalance: input.projectedBalance,
    },
  });
}
