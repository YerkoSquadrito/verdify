import Link from "next/link";
import { Plus } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPortfolio } from "@/lib/db/portfolio";
import { getDemoNow, getDemoOffsetMs } from "@/lib/demo/clock-server";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortfolioBoard } from "@/components/portfolio/PortfolioBoard";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const asOf = await getDemoNow();
  const offsetMs = await getDemoOffsetMs();
  // Real "now" at demo offset 0 — deadlines lapsing inside [baseline, asOf] (the
  // simulated window) read as missed; outside the demo, baseline === asOf.
  const baseline = new Date(asOf.getTime() - offsetMs);
  const portfolio = await getPortfolio(supabase, ctx.activeOrg.id, asOf, baseline);

  const violationDatesISO = portfolio.buildings
    .filter((b) => b.violationDate)
    .map((b) => b.violationDate!.toISOString());

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Portfolio"
        description={`${ctx.activeOrg.name} — real-time EBEWE compliance across every covered building.`}
        action={
          <Link href="/buildings/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add building
            </Button>
          </Link>
        }
      />

      <PortfolioBoard
        buildings={portfolio.buildings}
        counts={portfolio.counts}
        violationDatesISO={violationDatesISO}
        offsetMs={offsetMs}
      />
    </div>
  );
}
