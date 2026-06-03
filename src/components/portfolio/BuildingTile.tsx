import Link from "next/link";
import { MapPin } from "lucide-react";
import type { BuildingView } from "@/lib/db/portfolio";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Countdown } from "@/components/shared/Countdown";
import { FineExposureCounter } from "./FineExposureCounter";
import { formatDate } from "@/lib/utils";

const DEADLINE_LABEL: Record<string, string> = {
  benchmark: "Benchmarking (Jun 1)",
  arcx: "A/RCx audit (Dec 1)",
};

export function BuildingTile({ view }: { view: BuildingView }) {
  const { building, schedule, nextDeadline, violationDate } = view;
  return (
    <Link
      href={`/buildings/${building.id}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-primary">
            {building.name ?? `BIN ${building.bin}`}
          </h3>
          {building.address && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {building.address}
            </p>
          )}
        </div>
        <StatusBadge status={view.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">BIN · last digit</dt>
          <dd className="font-medium tabular-nums">
            {building.bin}{" "}
            <span className="text-muted-foreground">· {schedule.arcxDigit}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Gross floor area</dt>
          <dd className="font-medium tabular-nums">
            {building.sqft.toLocaleString()} ft²
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md bg-muted/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {DEADLINE_LABEL[nextDeadline.type]}
          </span>
          <span className="text-muted-foreground">
            {formatDate(nextDeadline.dueDate)}
          </span>
        </div>
        <div className="mt-1">
          <Countdown dueDateISO={nextDeadline.dueDate.toISOString()} className="text-sm" />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Fine exposure</p>
          <FineExposureCounter
            violationDateISO={violationDate ? violationDate.toISOString() : null}
            size="sm"
            settled={view.fine.settled}
            settledAmount={view.fine.settledAmount}
          />
        </div>
      </div>
    </Link>
  );
}
