import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPortfolio } from "@/lib/db/portfolio";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { BuildingTile } from "@/components/portfolio/BuildingTile";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const portfolio = await getPortfolio(supabase, ctx.activeOrg.id);

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

      <PortfolioSummary
        violationDatesISO={violationDatesISO}
        counts={portfolio.counts}
        buildingCount={portfolio.buildings.length}
      />

      {portfolio.buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No buildings yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Onboard a building with its LADBS Building ID — Verdify derives the
            entire compliance schedule automatically.
          </p>
          <Link href="/buildings/new" className="mt-5">
            <Button>
              <Plus className="h-4 w-4" />
              Add your first building
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portfolio.buildings.map((view) => (
            <BuildingTile key={view.building.id} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
