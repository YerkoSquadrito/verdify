import Link from "next/link";
import { Bell, Mail, MessageSquare, Monitor } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPortfolio } from "@/lib/db/portfolio";
import { getDemoNow, getDemoOffsetMs } from "@/lib/demo/clock-server";
import { ALERT_THRESHOLDS_DAYS } from "@/lib/compliance";
import type { AlertRow } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Countdown } from "@/components/shared/Countdown";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEADLINE_LABEL: Record<string, string> = {
  benchmark: "Annual benchmarking",
  arcx: "A/RCx audit & retro-commissioning",
};

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DeadlinesPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const asOf = await getDemoNow();
  const offsetMs = await getDemoOffsetMs();
  // Real "now" at demo offset 0 — see getPortfolio/buildView baseline rationale.
  const baseline = new Date(asOf.getTime() - offsetMs);
  const [portfolio, { data: alertRows }] = await Promise.all([
    getPortfolio(supabase, ctx.activeOrg.id, asOf, baseline),
    supabase
      .from("alerts")
      .select("*")
      .eq("org_id", ctx.activeOrg.id)
      .eq("channel", "in_app"),
  ]);

  const alerts = (alertRows ?? []) as AlertRow[];
  const firedKey = (
    buildingId: string,
    type: string,
    due: string,
    threshold: number,
  ) => `${buildingId}:${type}:${due}:${threshold}`;
  const fired = new Set(
    alerts.map((a) =>
      firedKey(a.building_id, a.deadline_type, a.deadline_date, a.threshold_days),
    ),
  );

  // Flatten every building's deadlines into one urgency-sorted list.
  const rows = portfolio.buildings
    .flatMap((view) =>
      view.deadlines.map((d) => ({
        view,
        deadline: d,
      })),
    )
    .sort((a, b) => a.deadline.daysUntil - b.deadline.daysUntil);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Deadline engine"
        description="Every benchmarking and A/RCx deadline across the portfolio, sorted by urgency. Multi-channel alerts fire at 90, 30, and 7 days. Deadlines are computed deterministically — they cannot drift."
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No buildings yet. Add a building to populate the deadline engine.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Building</th>
                <th className="px-4 py-3 font-medium">Requirement</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Countdown</th>
                <th className="px-4 py-3 font-medium">Alert cascade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ view, deadline }) => (
                <tr key={`${view.building.id}-${deadline.type}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/buildings/${view.building.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {view.building.name ?? `BIN ${view.building.bin}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {DEADLINE_LABEL[deadline.type]}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDate(deadline.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Countdown
                      dueDateISO={deadline.dueDate.toISOString()}
                      offsetMs={offsetMs}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {ALERT_THRESHOLDS_DAYS.map((t) => {
                        const hasFired = fired.has(
                          firedKey(
                            view.building.id,
                            deadline.type,
                            dateKey(deadline.dueDate),
                            t,
                          ),
                        );
                        const reached = deadline.daysUntil <= t;
                        return (
                          <span
                            key={t}
                            title={
                              hasFired
                                ? `${t}-day alert sent`
                                : reached
                                  ? `${t}-day window reached (run the worker to send)`
                                  : `${t}-day alert pending`
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              hasFired
                                ? "bg-status-danger-bg text-status-danger"
                                : reached
                                  ? "bg-status-warn-bg text-status-warn"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Bell className="h-3 w-3" />
                            {t}d
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5" /> In-app (live)
        </span>
        <span className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Email (simulated in prototype)
        </span>
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> SMS (simulated in prototype)
        </span>
      </div>
    </div>
  );
}
