import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveComplianceSchedule,
  upcomingDeadlines,
  ALERT_THRESHOLDS_DAYS,
} from "@/lib/compliance";
import type { Building } from "@/lib/db/types";

export const dynamic = "force-dynamic";

/**
 * Scheduled worker: generates 90/30/7-day deadline alerts across ALL orgs.
 * Runs as the service role (bypasses RLS — it is a system actor). Idempotent:
 * the unique constraint on (building, deadline, threshold, channel) means a
 * daily run never produces duplicates. Email/SMS rows are created `pending`
 * (dispatch is simulated in the prototype); in-app rows are `sent` and surface
 * live on the Deadline Engine.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.nextUrl.searchParams.get("secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const asOf = new Date();

  const { data: buildingRows, error } = await supabase.from("buildings").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const buildings = (buildingRows ?? []) as Building[];

  type AlertInsert = {
    org_id: string;
    building_id: string;
    deadline_type: "benchmark" | "arcx";
    deadline_date: string;
    threshold_days: number;
    channel: "in_app" | "email" | "sms";
    status: "sent" | "pending";
  };
  const rows: AlertInsert[] = [];

  for (const b of buildings) {
    const schedule = deriveComplianceSchedule(b.bin, b.sqft, b.ownership, asOf);
    const deadlines = upcomingDeadlines(schedule, asOf);
    for (const d of deadlines) {
      const dueDate = d.dueDate.toISOString().slice(0, 10);
      for (const threshold of ALERT_THRESHOLDS_DAYS) {
        // Fire once the alert window has been entered (0 ≤ daysUntil ≤ threshold).
        if (d.daysUntil < 0 || d.daysUntil > threshold) continue;
        for (const channel of ["in_app", "email", "sms"] as const) {
          rows.push({
            org_id: b.org_id,
            building_id: b.id,
            deadline_type: d.type,
            deadline_date: dueDate,
            threshold_days: threshold,
            channel,
            status: channel === "in_app" ? "sent" : "pending",
          });
        }
      }
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { data, error: upErr } = await supabase
      .from("alerts")
      .upsert(rows, {
        onConflict: "building_id,deadline_type,deadline_date,threshold_days,channel",
        ignoreDuplicates: true,
      })
      .select("id");
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    inserted = data?.length ?? 0;

    await supabase.from("audit_log").insert({
      org_id: null,
      actor_id: null,
      action: "alert.generated",
      target_type: "system",
      metadata: { candidates: rows.length, inserted, asOf: asOf.toISOString() },
    });
  }

  return NextResponse.json({
    ok: true,
    buildings: buildings.length,
    candidates: rows.length,
    inserted,
  });
}
