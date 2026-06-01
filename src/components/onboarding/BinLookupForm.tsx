"use client";

import { useState, useTransition } from "react";
import { Search, CheckCircle2, PencilLine, CalendarClock } from "lucide-react";
import {
  lookupBuildingAction,
  onboardBuildingAction,
} from "@/app/(app)/buildings/new/actions";
import {
  deriveComplianceSchedule,
  type ComplianceSchedule,
} from "@/lib/compliance";
import type { BuildingLookupResult } from "@/lib/data-sources/building-lookup";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type Ownership = "private" | "city";

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
  const [lookup, setLookup] = useState<BuildingLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  async function runLookup() {
    if (!bin.trim()) return;
    setLooking(true);
    setError(null);
    const result = await lookupBuildingAction(bin);
    setLookup(result);
    if (result.found) {
      if (result.address) setAddress(result.address);
      if (result.sqft) setSqft(String(result.sqft));
      if (result.ownership) setOwnership(result.ownership);
      if (!name && result.meta?.propertyType) setName(result.meta.propertyType);
    }
    setLooking(false);
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

  const schedule = previewSchedule(bin, Number(sqft), ownership);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* BIN + lookup */}
          <div className="space-y-1.5">
            <Label htmlFor="bin">LADBS Building ID (BIN)</Label>
            <div className="flex gap-2">
              <Input
                id="bin"
                placeholder="e.g. 476102819647"
                value={bin}
                onChange={(e) => setBin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runLookup();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={runLookup}
                disabled={looking || !bin.trim()}
              >
                <Search className="h-4 w-4" />
                {looking ? "Looking up…" : "Look up"}
              </Button>
            </div>
            {lookup && (
              <p
                className={`flex items-center gap-1.5 text-xs ${lookup.found ? "text-status-ok" : "text-status-warn"}`}
              >
                {lookup.found ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Matched in LA Open Data (EBEWE dataset). Review and edit
                    before saving.
                  </>
                ) : (
                  <>
                    <PencilLine className="h-3.5 w-3.5" />
                    No automated match — enter the details manually. (Manual
                    entry always works.)
                  </>
                )}
              </p>
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
            <Button type="button" onClick={save} disabled={saving}>
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
