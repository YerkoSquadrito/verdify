import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, CalendarClock, FolderLock, History } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildView } from "@/lib/db/portfolio";
import type { Building, ComplianceEvent, DocumentRow } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Countdown } from "@/components/shared/Countdown";
import { FineExposureCounter } from "@/components/portfolio/FineExposureCounter";
import { VaultSection } from "@/components/vault/VaultSection";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEADLINE_LABEL: Record<string, string> = {
  benchmark: "Annual benchmarking",
  arcx: "A/RCx audit",
};
const EVENT_LABEL: Record<string, string> = {
  benchmark_submitted: "Benchmarking submitted",
  arcx_completed: "A/RCx completed",
  violation_issued: "Violation notice issued",
};

export default async function BuildingDetailPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const { buildingId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", buildingId)
    .single();
  if (!b) notFound();
  const building = b as Building;

  const [{ data: evRows }, { data: docRows }] = await Promise.all([
    supabase
      .from("compliance_events")
      .select("*")
      .eq("building_id", buildingId)
      .order("event_date", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false }),
  ]);
  const events = (evRows ?? []) as ComplianceEvent[];
  const documents = (docRows ?? []) as DocumentRow[];
  const view = buildView(building, events);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Portfolio
      </Link>

      <PageHeader
        title={building.name ?? `BIN ${building.bin}`}
        description={`${ctx.activeOrg.name} · LADBS Building ID ${building.bin}`}
        action={<StatusBadge status={view.status} />}
      />

      {building.address && (
        <p className="-mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {building.address}
        </p>
      )}

      {/* Schedule + fine */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Compliance schedule</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Derived deterministically from the BIN and ordinance rules.
            </p>
            <div className="mt-4 space-y-3">
              {view.deadlines.map((d) => (
                <div
                  key={d.type}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{DEADLINE_LABEL[d.type]}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(d.dueDate)}
                      {d.type === "arcx" &&
                        ` · cycle keyed to BIN digit ${view.schedule.arcxDigit}`}
                    </p>
                  </div>
                  <Countdown dueDateISO={d.dueDate.toISOString()} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold">Fine exposure</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              LAMC §91.9712 / §98.0411(c)
            </p>
            <div className="mt-4">
              <FineExposureCounter
                violationDateISO={
                  view.violationDate ? view.violationDate.toISOString() : null
                }
                size="lg"
              />
            </div>
            <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Gross floor area</dt>
                <dd className="tabular-nums">{building.sqft.toLocaleString()} ft²</dd>
              </div>
              <div className="flex justify-between">
                <dt>EBEWE coverage</dt>
                <dd>{view.schedule.covered ? "Covered" : "Below threshold"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Data source</dt>
                <dd className="capitalize">{building.data_source}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Compliance history</h2>
          </div>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No recorded events yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0"
                >
                  <span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {e.event_date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Vault */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FolderLock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Document vault</h2>
        </div>
        <VaultSection buildingId={building.id} documents={documents} />
      </div>
    </div>
  );
}
