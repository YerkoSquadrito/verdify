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
import { buildView } from "@/lib/db/portfolio";
import { renderLenderPacket } from "@/lib/vault/lender-packet";
import { getDemoNow, getDemoToday } from "@/lib/demo/clock-server";

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

/**
 * Settle the outstanding fine (dummy payment — no real rail). MONEY axis only:
 * records a 'fine_paid' event that freezes the §98.0411(c) balance. The building
 * stays non-compliant until documentation is submitted — paying the notice does
 * NOT cure the underlying violation.
 */
export async function payFineAction(buildingId: string) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", buildingId)
    .single();
  if (!b) return { error: "Building not found." };

  const { data: evRows } = await supabase
    .from("compliance_events")
    .select("*")
    .eq("building_id", buildingId);
  const events = (evRows ?? []) as ComplianceEvent[];
  // Settle at the simulated clock day so the frozen balance matches what the
  // presenter sees on screen.
  const asOf = await getDemoNow();
  const view = buildView(b as Building, events, asOf);

  if (!view.violationDate) return { error: "No fine to settle." };
  if (view.fine.settled) return { error: "Fine already settled." };

  const amount = view.fine.balance;
  const { error: rowErr } = await supabase.from("compliance_events").insert({
    org_id: ctx.activeOrg.id,
    building_id: buildingId,
    event_type: "fine_paid",
    event_date: await getDemoToday(),
    metadata: { amount, stage: view.fine.stage },
  });
  if (rowErr) return { error: rowErr.message };

  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "fine.paid",
    targetType: "building",
    targetId: buildingId,
    metadata: { amount },
  });

  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath("/dashboard");
  return { ok: true, amount };
}

/**
 * Submit compliance documentation (dummy filing — no real LADBS/EPA call).
 * COMPLIANCE axis: files the document into the vault AND records the matching
 * compliance event, which cures an open violation and clears the deadline. An
 * unpaid fine keeps accruing on the money axis until separately settled.
 */
export async function submitComplianceDocAction(formData: FormData) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const buildingId = String(formData.get("buildingId"));
  const deadlineType = String(formData.get("deadlineType"));
  const file = formData.get("file") as File | null;
  if (deadlineType !== "benchmark" && deadlineType !== "arcx") {
    return { error: "Choose what you're submitting." };
  }
  if (!file || file.size === 0) return { error: "Attach the document to submit." };

  const { data: building } = await supabase
    .from("buildings")
    .select("id, org_id")
    .eq("id", buildingId)
    .single();
  if (!building) return { error: "Building not found." };

  const docType: DocumentType =
    deadlineType === "benchmark" ? "benchmark_submission" : "arcx_report";
  const eventType =
    deadlineType === "benchmark" ? "benchmark_submitted" : "arcx_completed";

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${ctx.activeOrg.id}/${buildingId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(VAULT)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: upErr.message };

  const { error: docErr } = await supabase.from("documents").insert({
    org_id: ctx.activeOrg.id,
    building_id: buildingId,
    doc_type: docType,
    storage_path: path,
    filename: file.name,
    size_bytes: file.size,
    uploaded_by: ctx.userId,
  });
  if (docErr) return { error: docErr.message };

  const { error: evErr } = await supabase.from("compliance_events").insert({
    org_id: ctx.activeOrg.id,
    building_id: buildingId,
    event_type: eventType,
    event_date: await getDemoToday(),
    metadata: { filename: file.name, storage_path: path },
  });
  if (evErr) return { error: evErr.message };

  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "compliance.submitted",
    targetType: "building",
    targetId: buildingId,
    metadata: { deadlineType, filename: file.name },
  });

  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath("/dashboard");
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

  const asOf = await getDemoNow();
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
