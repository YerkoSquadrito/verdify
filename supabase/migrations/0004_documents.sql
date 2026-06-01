-- Document Vault metadata. File bytes live in the private `vault` Storage
-- bucket at {org_id}/{building_id}/...; Storage RLS (0008) mirrors these rows
-- so access is double-gated (DB row AND storage object).

create type document_type as enum (
  'benchmark_submission',
  'arcx_report',
  'lender_packet',
  'other'
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  building_id  uuid not null references buildings (id) on delete cascade,
  doc_type     document_type not null default 'other',
  storage_path text not null,
  filename     text not null,
  size_bytes   bigint,
  uploaded_by  uuid references profiles (id),
  created_at   timestamptz not null default now()
);

create index on documents (building_id);
create index on documents (org_id);
