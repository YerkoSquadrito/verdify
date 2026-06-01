import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimulatorForm, type SimBuilding } from "@/components/simulator/SimulatorForm";
import type { Building } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("id, name, bin")
    .eq("org_id", ctx.activeOrg.id)
    .order("created_at", { ascending: true });

  const buildings: SimBuilding[] = ((data ?? []) as Pick<Building, "id" | "name" | "bin">[]).map(
    (b) => ({ id: b.id, name: b.name ?? `BIN ${b.bin}` }),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Alert simulator"
        description="Model the financial consequence of a missed deadline, including the full LAMC 98.0411(c) escalation. Every projection uses the same deterministic fine math as the live dashboard."
      />
      <SimulatorForm buildings={buildings} />
    </div>
  );
}
