import { ShieldCheck, LogOut } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import { NavLinks } from "@/components/shell/NavLinks";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Verdify</span>
        </div>

        <div className="px-3">
          <OrgSwitcher
            memberships={ctx.memberships}
            activeOrgId={ctx.activeOrg.id}
          />
        </div>

        <div className="mt-4 flex-1 px-3">
          <NavLinks />
        </div>

        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{ctx.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{ctx.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
