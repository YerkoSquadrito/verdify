"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { logAudit } from "@/lib/db/audit";
import {
  deriveComplianceSchedule,
  computeFineExposure,
  upcomingDeadlines,
} from "@/lib/compliance";
import type { Building, ComplianceEvent, DocumentType } from "@/lib/db/types";
import { renderLenderPacket } from "@/lib/vault/lender-packet";

const VAULT = "vault";

/** Upload a document into the vault for a building. */
export async function uploadDocumentAction(formData: FormData) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const buildingId = String(formData.get("buildingId"));
  const docType = (String(formData.get("docType")) || "other") as DocumentType;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Choose a file to upload." };

  // Confirm the building is in the active org (RLS also enforces this).
  const { data: building } = await supabase
    .from("buildings")
    .select("id, org_id")
    .eq("id", buildingId)
    .single();
  if (!building) return { error: "Building not found." };

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${ctx.activeOrg.id}/${buildingId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(VAULT)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: upErr.message };

  const { error: rowErr } = await supabase.from("documents").insert({
    org_id: ctx.activeOrg.id,
    building_id: buildingId,
    doc_type: docType,
    storage_path: path,
    filename: file.name,
    size_bytes: file.size,
    uploaded_by: ctx.userId,
  });
  if (rowErr) return { error: rowErr.message };

  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "document.uploaded",
    targetType: "building",
    targetId: buildingId,
    metadata: { docType, filename: file.name },
  });

  revalidatePath(`/buildings/${buildingId}`);
  return { ok: true };
}

/** Short-lived signed URL for downloading a vault object (Storage RLS gated). */
export async function getSignedUrlAction(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(VAULT)
    .createSignedUrl(path, 60);
  if (error || !data) return { error: error?.message ?? "Could not sign URL" };
  return { url: data.signedUrl };
}

/**
 * Generate a lender-ready compliance packet on demand from the building's
 * derived schedule + event history, and store it in the vault. "Generated on
 * demand, never reconstructed from email threads."
 */
export async function generateLenderPacketAction(buildingId: string) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [{ data: b }, { data: evRows }, { data: docRows }] = await Promise.all([
    supabase.from("buildings").select("*").eq("id", buildingId).single(),
    supabase.from("compliance_events").select("*").eq("building_id", buildingId),
    supabase.from("documents").select("*").eq("building_id", buildingId),
  ]);
  if (!b) return { error: "Building not found." };
  const building = b as Building;
  const events = (evRows ?? []) as ComplianceEvent[];

  const asOf = new Date();
  const schedule = deriveComplianceSchedule(
    building.bin,
    building.sqft,
    building.ownership,
    asOf,
  );
  const deadlines = upcomingDeadlines(schedule, asOf);
  const lastViolation = events
    .filter((e) => e.event_type === "violation_issued")
    .sort((a, b) => b.event_date.localeCompare(a.event_date))[0];
  const fine = lastViolation
    ? computeFineExposure(new Date(`${lastViolation.event_date}T12:00:00Z`), asOf)
    : null;

  const html = renderLenderPacket({
    building,
    schedule,
    deadlines,
    events,
    fine,
    documentCount: docRows?.length ?? 0,
    generatedBy: ctx.fullName,
    orgName: ctx.activeOrg.name,
    asOf,
  });

  const path = `${ctx.activeOrg.id}/${buildingId}/${crypto.randomUUID()}-lender-compliance-packet.html`;
  const { error: upErr } = await supabase.storage
    .from(VAULT)
    .upload(path, Buffer.from(html, "utf8"), { contentType: "text/html" });
  if (upErr) return { error: upErr.message };

  await supabase.from("documents").insert({
    org_id: ctx.activeOrg.id,
    building_id: buildingId,
    doc_type: "lender_packet",
    storage_path: path,
    filename: "Lender compliance packet.html",
    size_bytes: html.length,
    uploaded_by: ctx.userId,
  });

  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "lender_packet.generated",
    targetType: "building",
    targetId: buildingId,
  });

  revalidatePath(`/buildings/${buildingId}`);
  return { ok: true };
}
