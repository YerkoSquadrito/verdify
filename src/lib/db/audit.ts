import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an immutable audit-log entry. Audit-readiness by default — every
 * meaningful action (onboard, upload, simulate, generate alert) lands here so
 * lender diligence packets are generated, never reconstructed.
 */
export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  await supabase.from("audit_log").insert({
    org_id: entry.orgId,
    actor_id: entry.actorId ?? null,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
  });
}
