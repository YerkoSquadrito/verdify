"use client";

import { useRef, useState, useTransition } from "react";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { submitComplianceDocAction } from "@/app/(app)/buildings/[buildingId]/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type DeadlineType = "benchmark" | "arcx";

/**
 * Submit compliance documentation (dummy filing). Compliance (cure) axis: files
 * the document into the vault AND records the matching compliance event, which
 * clears an open violation and rolls the deadline forward. An unpaid fine keeps
 * accruing on the money axis until separately settled.
 */
export function SubmitComplianceForm({ buildingId }: { buildingId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [deadlineType, setDeadlineType] = useState<DeadlineType>("benchmark");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function submit() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Attach the document to submit.");
      return;
    }
    const fd = new FormData();
    fd.set("buildingId", buildingId);
    fd.set("deadlineType", deadlineType);
    fd.set("file", file);
    start(async () => {
      const res = await submitComplianceDocAction(fd);
      if (res?.error) setError(res.error);
      else if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Submit compliance documentation</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Files the document to your vault and records the submission — this is
        what resolves the obligation and clears an open violation. Settling a
        fine does not.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            What are you submitting?
          </label>
          <Select
            value={deadlineType}
            onChange={(e) => setDeadlineType(e.target.value as DeadlineType)}
          >
            <option value="benchmark">Annual benchmarking (June 1)</option>
            <option value="arcx">A/RCx audit report (Dec 1)</option>
          </Select>
        </div>
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
        <Button type="button" onClick={submit} disabled={busy}>
          <FileCheck2 className="h-4 w-4" />
          {busy ? "Submitting…" : "Submit"}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-status-danger">{error}</p>}
    </div>
  );
}
