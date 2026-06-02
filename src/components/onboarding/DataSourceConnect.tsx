"use client";

import { CheckCircle2, Loader2, Database, Zap, Gauge } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated "connecting to live datasources" panel for the onboarding screen.
 * Purely presentational: it visualizes a sequence the parent drives via
 * `connectedSteps` (how many sources have finished). Source N is "connected"
 * when connectedSteps > N, "connecting" when it's the next one and `running`,
 * else "pending". This sells the live LADBS/LADWP/EPA integration — the data it
 * implies is supplied separately by the demo fixtures, never by a model.
 */

interface Source {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

// The three core external integrations named on the Verdify homepage.
const SOURCES: Source[] = [
  {
    key: "ladbs",
    label: "LADBS ATLAS",
    detail: "Building identity, address & gross floor area",
    icon: Database,
  },
  {
    key: "ladwp",
    label: "LADWP",
    detail: "Utility consumption & meter data",
    icon: Zap,
  },
  {
    key: "epa",
    label: "EPA ENERGY STAR Portfolio Manager",
    detail: "Benchmarking score & site EUI",
    icon: Gauge,
  },
];

export const DATASOURCE_COUNT = SOURCES.length;

type RowState = "pending" | "connecting" | "connected";

export function DataSourceConnect({
  connectedSteps,
  running,
}: {
  connectedSteps: number;
  running: boolean;
}) {
  const allConnected = connectedSteps >= SOURCES.length;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {allConnected ? "Connected to live datasources" : "Connecting to live datasources…"}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.min(connectedSteps, SOURCES.length)}/{SOURCES.length}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {SOURCES.map((src, i) => {
          const state: RowState =
            connectedSteps > i
              ? "connected"
              : running && connectedSteps === i
                ? "connecting"
                : "pending";
          return <SourceRow key={src.key} source={src} state={state} />;
        })}
      </ul>
    </div>
  );
}

function SourceRow({ source, state }: { source: Source; state: RowState }) {
  const Icon = source.icon;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors",
        state === "connected"
          ? "border-status-ok/30"
          : state === "connecting"
            ? "border-status-warn/40"
            : "border-border",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          state === "connected"
            ? "bg-status-ok-bg text-status-ok"
            : state === "connecting"
              ? "bg-status-warn-bg text-status-warn"
              : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium transition-colors",
            state === "pending" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {source.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">{source.detail}</p>
      </div>

      <span className="shrink-0">
        {state === "connected" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-ok-bg px-2 py-0.5 text-xs font-medium text-status-ok">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        ) : state === "connecting" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-warn-bg px-2 py-0.5 text-xs font-medium text-status-warn">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Connecting
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Pending
          </span>
        )}
      </span>
    </li>
  );
}
