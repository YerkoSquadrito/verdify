-- Document Vault storage bucket + Storage RLS that MIRRORS the documents-table
-- RLS. Objects are stored at {org_id}/{building_id}/{file}; access is gated on
-- the first path segment (org_id) belonging to the caller. This double-gates
-- the vault: a row in `documents` AND the storage object are both org-scoped,
-- which is the non-negotiable white-label continuity guarantee.

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;

create policy "vault_select" on storage.objects for select to authenticated
using (
  bucket_id = 'vault'
  and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
);

create policy "vault_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'vault'
  and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
);

create policy "vault_update" on storage.objects for update to authenticated
using (
  bucket_id = 'vault'
  and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
)
with check (
  bucket_id = 'vault'
  and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
);

create policy "vault_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'vault'
  and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
);
