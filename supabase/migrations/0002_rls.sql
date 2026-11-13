-- Studiolo 02a, 02b and 02c: row level security, grants and policies.
--
-- Every table has RLS on and no table is public read/write. Hosted Supabase
-- grants ALL on new public tables to anon and authenticated through default
-- privileges, so this file revokes everything first and grants back only what
-- each role needs. Policies then scope those grants to the right rows.
-- Policies never read profiles.plan, and nothing here depends on the trial.

alter table public.profiles enable row level security;
alter table public.reserved_slugs enable row level security;
alter table public.sites enable row level security;
alter table public.site_publishes enable row level security;
alter table public.assets enable row level security;
alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.elements enable row level security;
alter table public.element_layouts enable row level security;
alter table public.submissions enable row level security;
alter table public.page_views_daily enable row level security;
alter table public.rate_limits enable row level security;
alter table public.domains enable row level security;

revoke all on table
  public.profiles,
  public.reserved_slugs,
  public.sites,
  public.site_publishes,
  public.assets,
  public.pages,
  public.sections,
  public.elements,
  public.element_layouts,
  public.submissions,
  public.page_views_daily,
  public.rate_limits,
  public.domains
from public, anon, authenticated, service_role;

-- service_role: server actions, publish, prune, form route, Vercel sync. ------
-- It bypasses RLS, so every server action must check ownership first.

grant select, insert, update, delete on table public.profiles to service_role;
grant select on table public.reserved_slugs to service_role;
grant select, insert, update, delete on table public.sites to service_role;
-- site_publishes is insert-only history. No UPDATE grant for any API role.
grant select, insert, delete on table public.site_publishes to service_role;
grant select, insert, update, delete on table public.assets to service_role;
grant select, insert, update, delete on table public.pages to service_role;
grant select, insert, update, delete on table public.sections to service_role;
grant select, insert, update, delete on table public.elements to service_role;
grant select, insert, update, delete on table public.element_layouts to service_role;
grant select, insert, update, delete on table public.submissions to service_role;
grant select, insert, update, delete on table public.page_views_daily to service_role;
grant select, insert, update, delete on table public.rate_limits to service_role;
grant select, insert, update, delete on table public.domains to service_role;

-- anon: reserved addresses only. Public rendering goes through the server. --

grant select on table public.reserved_slugs to anon;

-- authenticated: the signed-in owner. ----------------------------------------

-- profiles: own row. plan and trial_started_at are not updatable.
grant select on table public.profiles to authenticated;
grant update (display_name, notification_email) on table public.profiles to authenticated;

grant select on table public.reserved_slugs to authenticated;

-- sites: every column except password_hash is readable. Inserts and updates
-- are limited to the columns the owner edits directly. Draft columns change
-- only through save_draft. Publish, password, lock and delete columns are
-- written by server actions with the service role after an ownership check.
grant select (
  id,
  owner_id,
  name,
  slug,
  slug_locked_at,
  draft_revision,
  draft_updated_at,
  live_publish_id,
  first_published_at,
  last_published_at,
  password_enabled,
  gate_version,
  seo_title,
  seo_description,
  og_asset_id,
  favicon_asset_id,
  desktop_layout_seen_at,
  mobile_layout_seen_at,
  deleted_at,
  purge_after,
  created_at,
  updated_at
) on table public.sites to authenticated;
grant insert (
  id,
  owner_id,
  name,
  slug,
  seo_title,
  seo_description
) on table public.sites to authenticated;
grant update (
  name,
  slug,
  seo_title,
  seo_description,
  og_asset_id,
  favicon_asset_id,
  desktop_layout_seen_at,
  mobile_layout_seen_at
) on table public.sites to authenticated;

grant select on table public.site_publishes to authenticated;
grant select, insert, update, delete on table public.assets to authenticated;
grant select, insert, update, delete on table public.pages to authenticated;
grant select, insert, update, delete on table public.sections to authenticated;
grant select, insert, update, delete on table public.elements to authenticated;
grant select, insert, update, delete on table public.element_layouts to authenticated;
grant select, delete on table public.submissions to authenticated;
grant update (read_at) on table public.submissions to authenticated;
grant select on table public.page_views_daily to authenticated;
grant select on table public.domains to authenticated;

-- is_site_owner ----------------------------------------------------------------
-- Defined here, before the policies that use it. True only for a site the
-- caller owns that is not soft-deleted, so a deleted site's children are not
-- readable or writable until it is restored.

create function public.is_site_owner(site uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites
    where id = site
      and owner_id = auth.uid()
      and deleted_at is null
  );
$$;

alter function public.is_site_owner(uuid) owner to postgres;
revoke all on function public.is_site_owner(uuid) from public, anon;
grant execute on function public.is_site_owner(uuid) to authenticated, service_role;

-- policies --------------------------------------------------------------------
-- auth.uid() is wrapped in a subselect so it is evaluated once per statement.

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy reserved_slugs_select
  on public.reserved_slugs
  for select
  to anon, authenticated
  using (true);

-- Includes the owner's soft-deleted sites so Recently deleted can list them.
-- App queries add deleted_at is null everywhere else.
create policy sites_select_own
  on public.sites
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy sites_insert_own
  on public.sites
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and deleted_at is null);

create policy sites_update_own
  on public.sites
  for update
  to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null)
  with check (owner_id = (select auth.uid()) and deleted_at is null);

-- No delete policy on sites: deleting is a soft delete by the server.

create policy site_publishes_select_owner
  on public.site_publishes
  for select
  to authenticated
  using (public.is_site_owner(site_id));

create policy assets_owner_all
  on public.assets
  for all
  to authenticated
  using (public.is_site_owner(site_id))
  with check (public.is_site_owner(site_id));

create policy pages_owner_all
  on public.pages
  for all
  to authenticated
  using (public.is_site_owner(site_id))
  with check (public.is_site_owner(site_id));

create policy sections_owner_all
  on public.sections
  for all
  to authenticated
  using (public.is_site_owner(site_id))
  with check (public.is_site_owner(site_id));

create policy elements_owner_all
  on public.elements
  for all
  to authenticated
  using (public.is_site_owner(site_id))
  with check (public.is_site_owner(site_id));

create policy element_layouts_owner_all
  on public.element_layouts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.elements e
      where e.id = element_id
        and public.is_site_owner(e.site_id)
    )
  )
  with check (
    exists (
      select 1
      from public.elements e
      where e.id = element_id
        and public.is_site_owner(e.site_id)
    )
  );

-- No insert policy: the form route inserts with the service role.
create policy submissions_select_owner
  on public.submissions
  for select
  to authenticated
  using (public.is_site_owner(site_id));

create policy submissions_update_owner
  on public.submissions
  for update
  to authenticated
  using (public.is_site_owner(site_id))
  with check (public.is_site_owner(site_id));

create policy submissions_delete_owner
  on public.submissions
  for delete
  to authenticated
  using (public.is_site_owner(site_id));

-- Writes only through increment_page_views (service role).
create policy page_views_daily_select_owner
  on public.page_views_daily
  for select
  to authenticated
  using (public.is_site_owner(site_id));

-- Writes server-side with the service role after Vercel calls.
create policy domains_select_owner
  on public.domains
  for select
  to authenticated
  using (public.is_site_owner(site_id));

-- rate_limits: no policy for any API role. service_role bypasses RLS.
