"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { BuildingMapProps } from "./BuildingMap";

/**
 * Client-only loader for the Leaflet map. Leaflet reads `window` at import time,
 * so the map must never render during SSR — hence `dynamic(..., { ssr: false })`
 * with a sized skeleton fallback to avoid layout shift.
 */
const BuildingMap = dynamic(() => import("./BuildingMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-lg border border-border bg-muted" />
  ),
});

export function BuildingMapLazy(props: BuildingMapProps) {
  return <BuildingMap {...props} className={cn(props.className)} />;
}
