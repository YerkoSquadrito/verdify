-- ─────────────────────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY — the white-label isolation guarantee, all in one file.
--
-- Every customer table carries `org_id` and the identical org-scoped policy
-- block, gated on public.user_org_ids(). RLS is FORCED so even the table owner
-- is subject to it; only the bypassrls `service_role` (used by the worker and
-- seed) sees across orgs by design.
--
-- The single most important property: a consultant authenticated for Org B can
-- never read Org C's rows, on any table, ever. The seed includes two
-- consultants specifically to make that an executable acceptance test.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── organizations ────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table organizations force row level security;
create policy organizations_select on organizations for select to authenticated
  using (id in (select user_org_ids()));
-- inserts/updates/deletes happen via service_role (seed/admin) only.

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table profiles force row level security;
create policy profiles_select_self on profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── memberships (isolation-defining; keyed ONLY on auth.uid() to avoid
-- recursion with user_org_ids()) ─────────────────────────────────────────────
alter table memberships enable row level security;
alter table memberships force row level security;
create policy memberships_select_self on memberships for select to authenticated
  using (user_id = auth.uid());

-- ── buildings ────────────────────────────────────────────────────────────────
alter table buildings enable row level security;
alter table buildings force row level security;
create policy buildings_select on buildings for select to authenticated
  using (org_id in (select user_org_ids()));
create policy buildings_insert on buildings for insert to authenticated
  with check (org_id in (select user_org_ids()));
create policy buildings_update on buildings for update to authenticated
  using (org_id in (select user_org_ids()))
  with check (org_id in (select user_org_ids()));
create policy buildings_delete on buildings for delete to authenticated
  using (org_id in (select user_org_ids()));

-- ── compliance_events ────────────────────────────────────────────────────────
alter table compliance_events enable row level security;
alter table compliance_events force row level security;
create policy compliance_events_select on compliance_events for select to authenticated
  using (org_id in (select user_org_ids()));
create policy compliance_events_insert on compliance_events for insert to authenticated
  with check (org_id in (select user_org_ids()));
create policy compliance_events_update on compliance_events for update to authenticated
  using (org_id in (select user_org_ids()))
  with check (org_id in (select user_org_ids()));
create policy compliance_events_delete on compliance_events for delete to authenticated
  using (org_id in (select user_org_ids()));

-- ── documents ────────────────────────────────────────────────────────────────
alter table documents enable row level security;
alter table documents force row level security;
create policy documents_select on documents for select to authenticated
  using (org_id in (select user_org_ids()));
create policy documents_insert on documents for insert to authenticated
  with check (org_id in (select user_org_ids()));
create policy documents_update on documents for update to authenticated
  using (org_id in (select user_org_ids()))
  with check (org_id in (select user_org_ids()));
create policy documents_delete on documents for delete to authenticated
  using (org_id in (select user_org_ids()));

-- ── alerts (authenticated may read + dismiss; worker inserts via service_role) ─
alter table alerts enable row level security;
alter table alerts force row level security;
create policy alerts_select on alerts for select to authenticated
  using (org_id in (select user_org_ids()));
create policy alerts_update on alerts for update to authenticated
  using (org_id in (select user_org_ids()))
  with check (org_id in (select user_org_ids()));

-- ── audit_log (append-only: SELECT + INSERT, never UPDATE/DELETE) ─────────────
alter table audit_log enable row level security;
alter table audit_log force row level security;
create policy audit_log_select on audit_log for select to authenticated
  using (org_id in (select user_org_ids()));
create policy audit_log_insert on audit_log for insert to authenticated
  with check (org_id in (select user_org_ids()));
