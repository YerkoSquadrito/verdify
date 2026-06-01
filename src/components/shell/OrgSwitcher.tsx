"use client";

import { useTransition } from "react";
import { Building2, ChevronsUpDown } from "lucide-react";
import { setActiveOrg } from "@/app/(app)/actions";
import type { MembershipWithOrg } from "@/lib/auth/session";

const ROLE_LABEL: Record<string, string> = {
  building_owner: "Building owner",
  property_manager: "Property manager",
  energy_consultant: "Energy consultant",
};

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: MembershipWithOrg[];
  activeOrgId: string;
}) {
  const [pending, startTransition] = useTransition();
  const active = memberships.find((m) => m.org.id === activeOrgId);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{active?.org.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {active ? ROLE_LABEL[active.role] : ""}
          </p>
        </div>
        {memberships.length > 1 && (
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      {memberships.length > 1 && (
        <select
          aria-label="Switch organization"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={activeOrgId}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(() => {
              setActiveOrg(id);
            });
          }}
        >
          {memberships.map((m) => (
            <option key={m.org.id} value={m.org.id}>
              {m.org.name} — {ROLE_LABEL[m.role]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
