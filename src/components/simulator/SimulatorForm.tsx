"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeFineExposure,
  expectedFineSchedule,
} from "@/lib/compliance";
import { logSimulationAction } from "@/app/(app)/simulator/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";

const MS_PER_DAY = 86_400_000;

const SAMPLE_DAYS = [
  0, 10, 20, 29, 30, 45, 59, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365,
];

const STAGE_LABEL: Record<string, string> = {
  none: "No violation",
  base: "Base notice (LAMC 91.9712)",
  late: "Late charge applied (LAMC 98.0411(c))",
  interest: "Compounding interest (LAMC 98.0411(c))",
};

export interface SimBuilding {
  id: string;
  name: string;
}

export function SimulatorForm({ buildings }: { buildings: SimBuilding[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [buildingId, setBuildingId] = useState<string>("");
  const [violationDate, setViolationDate] = useState<string>(today);
  const [elapsed, setElapsed] = useState<number>(30);
  const [logged, setLogged] = useState(false);

  const vDate = useMemo(() => new Date(`${violationDate}T12:00:00Z`), [violationDate]);

  const curve = useMemo(
    () =>
      SAMPLE_DAYS.map((day) => {
        const asOf = new Date(vDate.getTime() + day * MS_PER_DAY);
        return { day, balance: computeFineExposure(vDate, asOf).balance };
      }),
    [vDate],
  );

  const atElapsed = useMemo(
    () => computeFineExposure(vDate, new Date(vDate.getTime() + elapsed * MS_PER_DAY)),
    [vDate, elapsed],
  );

  const table = expectedFineSchedule();
  const milestone = table.find((r) => r.day === nearestMilestone(elapsed));

  async function run() {
    await logSimulationAction({
      buildingId: buildingId || null,
      violationDate,
      daysElapsed: elapsed,
      projectedBalance: atElapsed.balance,
    });
    setLogged(true);
    setTimeout(() => setLogged(false), 2500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <Card className="h-fit">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="sim-building">Scenario building (optional)</Label>
            <Select
              id="sim-building"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            >
              <option value="">Hypothetical building</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sim-date">Violation notice issued</Label>
            <Input
              id="sim-date"
              type="date"
              value={violationDate}
              onChange={(e) => setViolationDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sim-elapsed">Days unpaid</Label>
              <span className="text-sm font-medium tabular-nums">{elapsed}d</span>
            </div>
            <input
              id="sim-elapsed"
              type="range"
              min={0}
              max={365}
              value={elapsed}
              onChange={(e) => setElapsed(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>

          <div className="rounded-md bg-status-danger-bg/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-status-danger">
              Projected exposure at {elapsed} days
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-status-danger">
              {formatUsd(atElapsed.balance, { cents: true })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {STAGE_LABEL[atElapsed.stage]}
            </p>
          </div>

          <Button type="button" onClick={run} className="w-full">
            {logged ? "Logged to audit trail ✓" : "Run & log scenario"}
          </Button>
        </CardContent>
      </Card>

      {/* Curve + table */}
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">
              Escalation over one year — LAMC 98.0411(c)
            </h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve} margin={{ left: 8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-danger)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--status-danger)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d) => `${d}d`}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[0, 820]}
                    tickFormatter={(v) => `$${v}`}
                    stroke="var(--muted-foreground)"
                    width={48}
                  />
                  <Tooltip
                    formatter={(v) => [formatUsd(Number(v), { cents: true }), "Balance"]}
                    labelFormatter={(d) => `Day ${d}`}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="balance"
                    stroke="var(--status-danger)"
                    strokeWidth={2}
                    fill="url(#fine)"
                  />
                  <ReferenceDot
                    x={nearestSample(elapsed)}
                    y={atElapsed.balance}
                    r={5}
                    fill="var(--status-danger)"
                    stroke="white"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">Statutory escalation schedule (Table A3)</h3>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Day</th>
                  <th className="pb-2 font-medium">Balance</th>
                  <th className="pb-2 font-medium">Trigger</th>
                  <th className="pb-2 font-medium">Citation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {table.map((r) => (
                  <tr
                    key={r.day}
                    className={milestone?.day === r.day ? "bg-status-danger-bg/40" : ""}
                  >
                    <td className="py-2 tabular-nums">Day {r.day}</td>
                    <td className="py-2 font-medium tabular-nums">
                      {formatUsd(r.balance, { cents: true })}
                    </td>
                    <td className="py-2 text-muted-foreground">{r.trigger}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {r.citation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function nearestSample(elapsed: number) {
  return SAMPLE_DAYS.reduce((p, c) =>
    Math.abs(c - elapsed) < Math.abs(p - elapsed) ? c : p,
  );
}
function nearestMilestone(elapsed: number) {
  const ms = [0, 30, 60, 90, 120, 180, 270, 365];
  return ms.reduce((p, c) => (c <= elapsed ? c : p), 0);
}
