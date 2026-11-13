-- Studiolo 02c: the private site-assets bucket and its policies.
--
-- Paths: {site_id}/draft/{asset_id}.{ext}
--        {site_id}/published/{publish_id}/{asset_id}.{ext}
-- The owner may read, write and delete objects under their own {site_id}/.
-- anon has no access at all. Live-site images are served by the app's own
-- asset route with the service role, which also enforces the password gate.
-- The 8 MB cap and the MIME allow-list are enforced by the Storage API from the
-- bucket settings below; the assets table repeats both as check constraints.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  false,
  8388608,
  array['image/webp', 'image/avif', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The first path segment as a site id, or null when it is not a uuid, so a
-- malformed name is simply not owned instead of raising a cast error.
create function public.storage_object_site_id(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when (storage.foldername(object_name))[1]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

alter function public.storage_object_site_id(text) owner to postgres;
revoke all on function public.storage_object_site_id(text) from public, anon;
grant execute on function public.storage_object_site_id(text) to authenticated, service_role;

drop policy if exists site_assets_owner_select on storage.objects;
drop policy if exists site_assets_owner_insert on storage.objects;
drop policy if exists site_assets_owner_update on storage.objects;
drop policy if exists site_assets_owner_delete on storage.objects;

create policy site_assets_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'site-assets'
    and public.is_site_owner(public.storage_object_site_id(name))
  );

create policy site_assets_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and public.is_site_owner(public.storage_object_site_id(name))
  );

create policy site_assets_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and public.is_site_owner(public.storage_object_site_id(name))
  )
  with check (
    bucket_id = 'site-assets'
    and public.is_site_owner(public.storage_object_site_id(name))
  );

create policy site_assets_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and public.is_site_owner(public.storage_object_site_id(name))
  );
