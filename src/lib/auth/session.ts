import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Organization } from "@/lib/db/types";

export const ACTIVE_ORG_COOKIE = "verdify_active_org";

export interface MembershipWithOrg {
  role: MemberRole;
  org: Organization;
}

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string;
  memberships: MembershipWithOrg[];
  activeOrg: Organization;
  activeRole: MemberRole;
}

/**
 * Resolve the full session context: the user, their org memberships (RLS-scoped
 * to themselves), and the active organization. Active org comes from a cookie
 * (the org switcher) and falls back to the first membership. In production the
 * consultant white-label subdomain would select the org; for the local
 * prototype the cookie stands in. Redirects to /login if unauthenticated.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberRows } = await supabase
    .from("memberships")
    .select("role, organizations(*)")
    .order("created_at", { ascending: true });

  const memberships: MembershipWithOrg[] = (memberRows ?? [])
    .map((m) => ({
      role: m.role as MemberRole,
      org: (m.organizations as unknown) as Organization,
    }))
    .filter((m) => m.org);

  if (memberships.length === 0) {
    // Authenticated but not provisioned into any org yet.
    redirect("/login?error=no_org");
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.org.id === preferred) ?? memberships[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string) ?? user.email ?? "",
    memberships,
    activeOrg: active.org,
    activeRole: active.role,
  };
}
