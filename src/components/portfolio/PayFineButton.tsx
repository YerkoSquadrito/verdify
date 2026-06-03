"use client";

import { useState, useTransition } from "react";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { payFineAction } from "@/app/(app)/buildings/[buildingId]/actions";
import { Button } from "@/components/ui/button";

/**
 * Settles the outstanding fine (dummy payment). Money axis only — the caller
 * still shows the building as non-compliant until documentation is submitted,
 * because paying the §91.9712 notice does not cure the underlying violation.
 */
export function PayFineButton({ buildingId }: { buildingId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pay() {
    setError(null);
    start(async () => {
      const res = await payFineAction(buildingId);
      if (res?.error) setError(res.error);
      // On success the page revalidates and re-renders in the settled state.
    });
  }

  return (
    <div className="mt-4">
      <Button type="button" onClick={pay} disabled={busy} className="w-full">
        <CreditCard className="h-4 w-4" />
        {busy ? "Settling…" : "Pay fine"}
      </Button>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-status-warn" />
        Settles the penalty only. The building stays in violation until you
        submit the required documentation.
      </p>
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
    </div>
  );
}
