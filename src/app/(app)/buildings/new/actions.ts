"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { logAudit } from "@/lib/db/audit";
import { lookupBuilding, type BuildingLookupResult } from "@/lib/data-sources/building-lookup";

/** Server-side building lookup (LA Open Data → manual fallback). */
export async function lookupBuildingAction(
  bin: string,
): Promise<BuildingLookupResult> {
  return lookupBuilding(bin);
}

const OnboardSchema = z.object({
  bin: z.string().trim().min(1, "Building ID is required"),
  name: z.string().trim().optional(),
  address: z.string().trim().optional(),
  sqft: z.coerce.number().int().positive("Square footage must be positive"),
  ownership: z.enum(["private", "city"]),
  dataSource: z.enum(["socrata", "manual"]).default("manual"),
  sourceRaw: z.any().optional(),
});

export type OnboardInput = z.input<typeof OnboardSchema>;

export async function onboardBuildingAction(
  input: OnboardInput,
): Promise<{ error: string } | never> {
  const parsed = OnboardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("buildings")
    .insert({
      org_id: ctx.activeOrg.id,
      bin: data.bin,
      name: data.name || null,
      address: data.address || null,
      sqft: data.sqft,
      ownership: data.ownership,
      data_source: data.dataSource,
      source_raw: data.sourceRaw ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This building (BIN) is already in your portfolio." };
    }
    return { error: error.message };
  }

  await logAudit(supabase, {
    orgId: ctx.activeOrg.id,
    actorId: ctx.userId,
    action: "building.created",
    targetType: "building",
    targetId: inserted.id,
    metadata: { bin: data.bin, dataSource: data.dataSource },
  });

  redirect(`/buildings/${inserted.id}`);
}
