import { ListChecks, CheckCircle2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PayFineButton } from "@/components/portfolio/PayFineButton";
import { formatDate } from "@/lib/utils";
import type { BuildingView } from "@/lib/db/portfolio";

interface Step {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  action?: React.ReactNode;
}

const DEADLINE_NOUN: Record<string, string> = {
  benchmark: "benchmarking",
  arcx: "A/RCx",
};

/**
 * The explicit "what do I do now" checklist at the top of the building page. It
 * renders for the two states that need action — "violation" (resolve) and
 * "approaching" (stay ahead of a deadline) — and derives each step's completion
 * from real compliance data, never a manual toggle, so a crossed-off step always
 * reflects an actual recorded action. The compliant case is handled separately by
 * ComplianceConfirmation.
 *
 * Violation surfaces the two INDEPENDENT axes modeled in buildView:
 *   • Pay the fine (money axis)        → done when view.fine.settled. Shown only
 *     for an explicit, payable LADBS notice (view.violationIssued).
 *   • Submit documentation (cure axis) → curing the violation flips status away
 *     from "violation", so it is always the outstanding step while shown.
 *
 * Approaching surfaces each deadline inside the alert window: submitting the
 * matching document satisfies that axis and clears the warning (buildView
 * advances the deadline a full cycle), so these steps behave like the cure step —
 * completing one makes it disappear rather than cross off in place.
 */
export function ResolutionSteps({
  buildingId,
  view,
}: {
  buildingId: string;
  view: BuildingView;
}) {
  const violation = view.status === "violation";
  const approaching = view.status === "approaching";
  if (!violation && !approaching) return null;

  // Shared action — both the cure step and approaching steps point at the vault.
  const vaultLink = (
    <a
      href="#document-vault"
      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <Upload className="h-4 w-4" />
      Go to Document vault
    </a>
  );

  const steps: Step[] = [];

  if (violation) {
    if (view.violationIssued) {
      const payDone = view.fine.settled === true;
      steps.push({
        key: "pay",
        title: "Pay the violation fine",
        detail:
          "Settles the LAMC §98.0411(c) penalty balance. Paying alone does not cure the violation.",
        done: payDone,
        action: payDone ? undefined : <PayFineButton buildingId={buildingId} />,
      });
    }
    steps.push({
      key: "cure",
      title: "Submit benchmarking or A/RCx documentation",
      detail:
        "Files the required record in the Document vault and clears the open violation.",
      done: false,
      action: vaultLink,
    });
  } else {
    // Approaching — one step per deadline currently inside the 90/30/7-day window.
    for (const d of view.deadlines) {
      if (d.thresholdCrossed === null) continue;
      const noun = DEADLINE_NOUN[d.type] ?? d.type;
      const days = d.daysUntil;
      steps.push({
        key: d.type,
        title: `Submit ${noun} documentation`,
        detail: `Due ${formatDate(d.dueDate)} · ${days} day${days === 1 ? "" : "s"} left. Filing it now keeps this building compliant.`,
        done: false,
        action: vaultLink,
      });
    }
  }

  const completed = steps.filter((s) => s.done).length;

  // Literal class strings (not interpolated tokens) so Tailwind keeps them.
  const tone = violation
    ? {
        border: "border-status-danger/30",
        icon: "text-status-danger",
        marker: "border-status-danger text-status-danger",
      }
    : {
        border: "border-status-warn/30",
        icon: "text-status-warn",
        marker: "border-status-warn text-status-warn",
      };
  const title = violation ? "Steps to resolve" : "Steps to stay compliant";
  const subtitle = violation
    ? "Complete every step to clear this building's violation."
    : "Submit ahead of the deadline to keep this building compliant.";

  return (
    <Card className={tone.border}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className={`h-4 w-4 ${tone.icon}`} />
            <h2 className="font-semibold">{title}</h2>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {completed} of {steps.length} done
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-3 rounded-md bg-muted/50 p-4">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-ok" />
              ) : (
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums ${tone.marker}`}
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    s.done
                      ? "text-sm font-medium text-muted-foreground line-through"
                      : "text-sm font-medium text-foreground"
                  }
                >
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                {!s.done && s.action}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
