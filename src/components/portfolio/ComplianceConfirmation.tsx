import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { BuildingView } from "@/lib/db/portfolio";

/**
 * Positive counterpart to ResolutionSteps: confirms there is nothing to do right
 * now. Shown only at full "compliant" status — an "approaching" deadline still
 * needs eventual action, so the schedule countdown speaks for that case instead.
 * The 90/30/7-day promise mirrors the Deadline Engine's alert thresholds.
 */
export function ComplianceConfirmation({ view }: { view: BuildingView }) {
  if (view.status !== "compliant") return null;

  return (
    <Card className="border-status-ok/30 bg-status-ok-bg">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-ok" />
          <div>
            <h2 className="font-semibold text-status-ok">You&apos;re all caught up</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This building is compliant — nothing needs your attention right now.
              We&apos;ll alert you 90, 30, and 7 days before the next deadline.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
