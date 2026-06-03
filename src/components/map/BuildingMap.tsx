"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

/**
 * Real map (Leaflet + OpenStreetMap, no API key) used to locate a building
 * before — and during — the data-source connection animation, and on the
 * building detail view. The marker is color-coded: green when the building is
 * inside Verdify's serviceable area (City of LA / LADWP), red when it's outside.
 *
 * Loaded only on the client via `BuildingMapLazy` (Leaflet touches `window`).
 */

const COLORS = {
  serviceable: "#16855a", // --primary
  outside: "#c1362c", // --status-danger
} as const;

// Teardrop pin as a divIcon so we fully control color and skip Leaflet's bundled
// marker-image asset path (which breaks under most bundlers). A `pulse` flag adds
// an expanding ring to sell the "locating" moment.
function pinIcon(serviceable: boolean, pulse: boolean): L.DivIcon {
  const color = serviceable ? COLORS.serviceable : COLORS.outside;
  const ring = pulse
    ? `<span class="absolute left-1/2 top-[14px] -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full opacity-60" style="background:${color};animation:verdify-pin-pulse 1.4s ease-out infinite"></span>`
    : "";
  return L.divIcon({
    className: "verdify-pin",
    html: `<div class="relative">
      ${ring}
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="relative drop-shadow">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 26 14 26s14-16.5 14-26C28 6.27 21.73 0 14 0Z" fill="${color}"/>
        <circle cx="14" cy="14" r="5" fill="#ffffff"/>
      </svg>
    </div>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
  });
}

// Drives the locate feel: start zoomed out, then fly to the target. Re-runs when
// the coordinates change (each new lookup).
function Locator({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(zoom - 4, 9), { animate: false });
    const t = setTimeout(() => {
      map.flyTo([lat, lng], zoom, { duration: 1.1 });
    }, 150);
    return () => clearTimeout(t);
  }, [map, lat, lng, zoom]);
  return null;
}

export interface BuildingMapProps {
  lat: number;
  lng: number;
  serviceable: boolean;
  /** Animate a fly-to + pin pulse on mount / coordinate change. */
  locating?: boolean;
  zoom?: number;
  className?: string;
}

export default function BuildingMap({
  lat,
  lng,
  serviceable,
  locating = false,
  zoom = 15,
  className,
}: BuildingMapProps) {
  return (
    <div
      className={cn(
        "h-72 w-full overflow-hidden rounded-lg border border-border",
        className,
      )}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        // Re-mount when the marker color flips so the icon updates cleanly.
        key={`${serviceable}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pinIcon(serviceable, locating)} />
        <Locator lat={lat} lng={lng} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
