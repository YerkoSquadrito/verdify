-- Buildings — the unit of compliance. The schedule (deadlines, A/RCx cycle,
-- fine exposure) is DERIVED on read from src/lib/compliance, never stored here,
-- so it can never drift from the ordinance rules.

create type ownership_type as enum ('private', 'city');
create type data_source_type as enum ('socrata', 'manual');

create table buildings (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  bin          text not null,              -- LADBS Building ID; drives A/RCx cycle
  name         text,
  address      text,
  sqft         integer not null,
  ownership    ownership_type not null default 'private',
  data_source  data_source_type not null default 'manual',
  source_raw   jsonb,                       -- raw lookup payload, kept for audit
  created_at   timestamptz not null default now(),
  unique (org_id, bin)                      -- one building per BIN per org
);

create index on buildings (org_id);

-- Sparse record of actual compliance events. A 'violation_issued' event's
-- event_date is the invoice date that feeds the live fine-exposure counter.
create type compliance_event_type as enum (
  'benchmark_submitted',
  'arcx_completed',
  'violation_issued'
);

create table compliance_events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  building_id  uuid not null references buildings (id) on delete cascade,
  event_type   compliance_event_type not null,
  event_date   date not null,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index on compliance_events (building_id);
create index on compliance_events (org_id);
