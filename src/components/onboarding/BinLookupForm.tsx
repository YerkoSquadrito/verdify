"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Search,
  CheckCircle2,
  CalendarClock,
  MapPin,
  Loader2,
  Ban,
} from "lucide-react";
import { onboardBuildingAction } from "@/app/(app)/buildings/new/actions";
import {
  deriveComplianceSchedule,
  type ComplianceSchedule,
} from "@/lib/compliance";
import type { BuildingLookupResult } from "@/lib/data-sources/building-lookup";
import {
  searchDemoBuildings,
  resolveDemoLookup,
  serviceabilityMessage,
  type DemoBuilding,
} from "@/lib/data-sources/demo-buildings";
import {
  DataSourceConnect,
  DATASOURCE_COUNT,
} from "@/components/onboarding/DataSourceConnect";
import { BuildingMapLazy } from "@/components/map/BuildingMapLazy";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type Ownership = "private" | "city";
// idle → locating (map finds the building) → then either out-of-area (blocked,
// explained) or connecting (LADBS/LADWP/EPA cascade) → done.
type ConnectPhase = "idle" | "locating" | "out-of-area" | "connecting" | "done";

// Each datasource takes this long to "connect" — three steps ≈ 3.3s total,
// slow enough that the live-integration animation is hard to miss.
const STEP_MS = 1100;
// How long the map spends locating the building before we branch on serviceability.
const LOCATE_MS = 1400;

function previewSchedule(
  bin: string,
  sqft: number,
  ownership: Ownership,
): ComplianceSchedule | null {
  if (!/\d/.test(bin) || !sqft) return null;
  try {
    return deriveComplianceSchedule(bin, sqft, ownership);
  } catch {
    return null;
  }
}

export function BinLookupForm() {
  const [bin, setBin] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sqft, setSqft] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("private");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // Autocomplete + animated datasource-connect state.
  const [focused, setFocused] = useState(false);
  const [connectPhase, setConnectPhase] = useState<ConnectPhase>("idle");
  const [connectedSteps, setConnectedSteps] = useState(0);
  const [lookup, setLookup] = useState<BuildingLookupResult | null>(null);
  // The result currently being located/connected — drives the map and, on the
  // out-of-area branch, the explanation.
  const [pending, setPending] = useState<BuildingLookupResult | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Strict toggle: every lookup flips serviceable ↔ outside-area so a demo always
  // shows both branches back-to-back, regardless of which BIN is entered.
  const lookupCount = useRef(0);

  // Clear any in-flight connection timers on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const suggestions = searchDemoBuildings(bin);
  const busy = connectPhase === "locating" || connectPhase === "connecting";
  const showSuggestions =
    focused &&
    !busy &&
    bin.trim().length >= 2 &&
    suggestions.length > 0;

  function applyResult(result: BuildingLookupResult) {
    setLookup(result);
    if (result.address) setAddress(result.address);
    if (result.sqft) setSqft(String(result.sqft));
    if (result.ownership) setOwnership(result.ownership);
    if (result.name) setName(result.name);
    else if (result.meta?.propertyType) setName(result.meta.propertyType);
  }

  /** Run the LADBS → LADWP → EPA connection cascade, then fill the form. */
  function runConnect(result: BuildingLookupResult) {
    setConnectedSteps(0);
    setConnectPhase("connecting");
    for (let step = 1; step <= DATASOURCE_COUNT; step++) {
      const t = setTimeout(() => {
        setConnectedSteps(step);
        if (step === DATASOURCE_COUNT) {
          applyResult(result);
          setConnectPhase("done");
        }
      }, step * STEP_MS);
      timers.current.push(t);
    }
  }

  /**
   * Locate the building on the map, then branch on serviceability. Demo theater
   * in front of the determinism boundary — the schedule card still recomputes
   * purely from the BIN + sqft set by `applyResult`. Each call flips the strict
   * serviceable/outside toggle so the demo always shows both outcomes.
   */
  function startLookup(targetBin: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    setLookup(null);
    // Clear any prior prefill so an out-of-area result can't be saved.
    setName("");
    setAddress("");
    setSqft("");
    setConnectedSteps(0);

    const wantServiceable = lookupCount.current % 2 === 0;
    lookupCount.current += 1;
    const result = resolveDemoLookup(targetBin, wantServiceable);

    setPending(result);
    setConnectPhase("locating");

    const t = setTimeout(() => {
      if (result.meta?.serviceable) {
        runConnect(result);
      } else {
        setConnectPhase("out-of-area");
      }
    }, LOCATE_MS);
    timers.current.push(t);
  }

  function selectSuggestion(b: DemoBuilding) {
    setBin(b.bin);
    setFocused(false);
    startLookup(b.bin);
  }

  function runLookup() {
    if (!bin.trim() || busy) return;
    setFocused(false);
    startLookup(bin);
  }

  function save() {
    setError(null);
    const sqftNum = Number(sqft);
    if (!bin.trim() || !sqftNum) {
      setError("Building ID and gross floor area are required.");
      return;
    }
    startSave(async () => {
      const res = await onboardBuildingAction({
        bin: bin.trim(),
        name,
        address,
        sqft: sqftNum,
        ownership,
        dataSource: lookup?.source === "socrata" ? "socrata" : "manual",
        sourceRaw: lookup?.raw,
      });
      if (res && "error" in res) setError(res.error);
    });
  }

  const connecting = connectPhase === "connecting";
  const schedule = previewSchedule(bin, Number(sqft), ownership);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* BIN + lookup, with live-datasource autocomplete */}
          <div className="space-y-1.5">
            <Label htmlFor="bin">LADBS Building ID (BIN)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="bin"
                  autoComplete="off"
                  placeholder="e.g. 476102819640"
                  value={bin}
                  disabled={busy}
                  onChange={(e) => {
                    setBin(e.target.value);
                    if (connectPhase === "done" || connectPhase === "out-of-area") {
                      setConnectPhase("idle");
                      setPending(null);
                    }
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runLookup();
                    } else if (e.key === "Escape") {
                      setFocused(false);
                    }
                  }}
                />
                {showSuggestions && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-md">
                    {suggestions.map((b) => (
                      <li key={b.bin}>
                        {/* onMouseDown (not onClick) so selection fires before blur. */}
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(b);
                          }}
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {b.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              BIN {b.bin} · {b.address} ·{" "}
                              {b.sqft.toLocaleString()} ft²
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={runLookup}
                disabled={busy || !bin.trim()}
              >
                <Search className="h-4 w-4" />
                {connectPhase === "locating"
                  ? "Locating…"
                  : connectPhase === "connecting"
                    ? "Connecting…"
                    : "Look up"}
              </Button>
            </div>

            {/* Locate on a real map, then branch on serviceability */}
            {connectPhase !== "idle" && pending && (
              <div className="space-y-3 pt-1">
                <BuildingMapLazy
                  lat={pending.meta?.lat ?? 34.0505}
                  lng={pending.meta?.lng ?? -118.2526}
                  serviceable={pending.meta?.serviceable ?? false}
                  locating={connectPhase === "locating"}
                />

                {connectPhase === "locating" && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Locating {pending.address ?? "building"} — checking it sits
                    inside the City of LA / LADWP service area…
                  </p>
                )}

                {/* Inside the serviceable area: run the live-datasource cascade */}
                {(connectPhase === "connecting" || connectPhase === "done") && (
                  <>
                    <p className="flex items-center gap-1.5 text-xs text-status-ok">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {pending.meta?.jurisdiction
                        ? `${pending.meta.jurisdiction} — within LADWP service territory.`
                        : "Within LADWP service territory."}{" "}
                      EBEWE-covered.
                    </p>
                    <DataSourceConnect
                      connectedSteps={connectedSteps}
                      running={connecting}
                    />
                    {connectPhase === "done" && (
                      <p className="flex items-center gap-1.5 text-xs text-status-ok">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connected to LADBS · LADWP · EPA — fields pre-filled.
                        Review before saving.
                      </p>
                    )}
                  </>
                )}

                {/* Outside the serviceable area: explain why and block the add */}
                {connectPhase === "out-of-area" && (
                  <div className="rounded-lg border border-status-danger/30 bg-status-danger-bg p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-status-danger">
                      <Ban className="h-4 w-4" />
                      Verdify can&apos;t add this building
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/80">
                      {serviceabilityMessage(pending)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editable details — always available, automation just prefills them */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Building name</Label>
            <Input
              id="name"
              placeholder="Optional label"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sqft">Gross floor area (ft²)</Label>
              <Input
                id="sqft"
                type="number"
                inputMode="numeric"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownership">Ownership</Label>
              <Select
                id="ownership"
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as Ownership)}
              >
                <option value="private">Privately owned</option>
                <option value="city">City-owned</option>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-status-danger">{error}</p>}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={save}
              disabled={saving || busy || connectPhase === "out-of-area"}
            >
              {saving ? "Saving…" : "Add to portfolio"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live, derived schedule preview */}
      <Card className="h-fit">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Derived compliance schedule</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Computed deterministically from the BIN and ordinance rules — no
            model, no guessing.
          </p>

          {schedule ? (
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="EBEWE coverage">
                {schedule.covered ? (
                  <span className="font-medium text-status-ok">Covered</span>
                ) : (
                  <span className="font-medium text-muted-foreground">
                    Below threshold
                  </span>
                )}
              </Row>
              <Row label="Annual benchmarking">
                {formatDate(schedule.nextBenchmarkDeadline)}
              </Row>
              <Row label={`A/RCx cycle (digit ${schedule.arcxDigit})`}>
                {formatDate(schedule.nextArcxDueDate)}
              </Row>
              <Row label="Following A/RCx cycles">
                <span className="text-muted-foreground">
                  {schedule.upcomingArcxDueDates
                    .slice(1)
                    .map((d) => d.getUTCFullYear())
                    .join(" · ")}
                </span>
              </Row>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Enter a BIN and floor area to preview the schedule.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
