import { cn } from "@/lib/utils";
import type { BuildingStatus } from "@/lib/db/portfolio";

export const STATUS_META: Record<
  BuildingStatus,
  { label: string; dot: string; chip: string }
> = {
  compliant: {
    label: "Compliant",
    dot: "bg-status-ok",
    chip: "bg-status-ok-bg text-status-ok",
  },
  approaching: {
    label: "Deadline approaching",
    dot: "bg-status-warn",
    chip: "bg-status-warn-bg text-status-warn",
  },
  violation: {
    label: "In violation",
    dot: "bg-status-danger",
    chip: "bg-status-danger-bg text-status-danger",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: BuildingStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
