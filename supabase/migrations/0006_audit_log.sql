-- Append-only audit log. Audit-readiness by default (CLAUDE.md principle #4):
-- every meaningful action produces a timestamped, exportable artifact. The RLS
-- policies (0007) grant SELECT and INSERT but never UPDATE/DELETE, making the
-- log immutable.

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations (id) on delete set null,
  actor_id     uuid references profiles (id) on delete set null, -- null = system/worker
  action       text not null,            -- e.g. 'building.created', 'document.uploaded'
  target_type  text,
  target_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index on audit_log (org_id, created_at desc);
