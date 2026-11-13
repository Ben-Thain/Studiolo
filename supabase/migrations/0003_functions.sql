-- Studiolo 02a and 02b: triggers and functions.
-- Function bodies must not mention the dormant profiles column.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create trigger sites_set_updated_at
  before update on public.sites
  for each row
  execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create function public.slug_is_free(s text, for_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    s ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
    and not exists (
      select 1
      from public.reserved_slugs as reserved
      where reserved.slug = s
    )
    and not exists (
      select 1
      from public.sites as active_site
      where active_site.slug = s
        and active_site.deleted_at is null
    )
    and not exists (
      select 1
      from public.sites as held
      where held.slug = s
        and held.deleted_at is not null
        and held.owner_id is distinct from for_owner
    ),
    false
  );
$$;

alter function public.slug_is_free(text, uuid) owner to postgres;

revoke all on function public.slug_is_free(text, uuid) from public, anon;
grant execute on function public.slug_is_free(text, uuid) to authenticated, service_role;

-- Reject a slug held by another owner's soft-deleted site.
-- SQLSTATE ST001, message "address taken".

create function public.sites_slug_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.sites as held
    where held.slug = new.slug
      and held.deleted_at is not null
      and held.owner_id is distinct from new.owner_id
      and held.id is distinct from new.id
  ) then
    raise exception 'address taken'
      using errcode = 'ST001';
  end if;
  return new;
end;
$$;

alter function public.sites_slug_available() owner to postgres;

create trigger sites_slug_available
  before insert or update of slug on public.sites
  for each row
  execute function public.sites_slug_available();

-- Reject reserved addresses, and reject a change once the address is locked,
-- unless this transaction set studiolo.restoring. Reserved addresses stay
-- rejected while restoring.
-- SQLSTATE ST003, message "address reserved".
-- SQLSTATE ST002, message "address locked".

create function public.sites_lock_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    if exists (
      select 1
      from public.reserved_slugs as reserved
      where reserved.slug = new.slug
    ) then
      raise exception 'address reserved'
        using errcode = 'ST003';
    end if;
  end if;

  -- Only restore_site (02b) may set studiolo.restoring, and only with
  -- set_config('studiolo.restoring', 'on', true) so is_local is true and the
  -- bypass ends when that transaction commits. A session-wide SET would also
  -- match this read; restore_site must not use one.
  if tg_op = 'UPDATE'
    and new.slug is distinct from old.slug
    and old.slug_locked_at is not null
    and coalesce(current_setting('studiolo.restoring', true), '') <> 'on'
  then
    raise exception 'address locked'
      using errcode = 'ST002';
  end if;

  return new;
end;
$$;

alter function public.sites_lock_slug() owner to postgres;

create trigger sites_lock_slug
  before insert or update of slug on public.sites
  for each row
  execute function public.sites_lock_slug();

-- Insert-only publish history, including for the table owner and service_role.

create function public.reject_site_publish_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published_by is null and old.published_by is not null
     and (to_jsonb(new) - 'published_by') = (to_jsonb(old) - 'published_by') then
    return new;
  end if;
  raise exception 'site_publishes is insert-only'
    using errcode = 'ST004';
end;
$$;

create trigger site_publishes_immutable
  before update on public.site_publishes
  for each row
  execute function public.reject_site_publish_update();

revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.sites_slug_available() from public, anon;
revoke all on function public.sites_lock_slug() from public, anon;
revoke all on function public.reject_site_publish_update() from public, anon;

-- 02b functions --------------------------------------------------------------

create trigger pages_set_updated_at
  before update on public.pages
  for each row
  execute function public.set_updated_at();

create trigger elements_set_updated_at
  before update on public.elements
  for each row
  execute function public.set_updated_at();

create trigger domains_set_updated_at
  before update on public.domains
  for each row
  execute function public.set_updated_at();

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

create function public.is_site_public(site uuid)
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
      and live_publish_id is not null
      and deleted_at is null
      and password_enabled = false
  );
$$;

create function public.increment_page_views(site uuid, d date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.page_views_daily (site_id, day, views)
  values (site, d, 1)
  on conflict (site_id, day) do update
  set views = public.page_views_daily.views + 1;
end;
$$;

create function public.resolve_host(h text)
returns table (
  site_id uuid,
  slug text,
  password_enabled boolean,
  gate_version integer,
  canonical_host text
)
language sql
stable
security definer
set search_path = public
as $$
  with host as (
    select lower(btrim(h)) as value
  )
  select
    s.id,
    s.slug,
    s.password_enabled,
    s.gate_version,
    d.hostname
  from public.sites s
  left join public.domains d
    on d.site_id = s.id
   and d.status = 'connected'
  cross join host
  where s.deleted_at is null
    and s.live_publish_id is not null
    and (
      s.slug = host.value
      or d.hostname = host.value
      or d.alias_hostname = host.value
    )
  limit 1;
$$;

create function public.rate_limit_hit(b text, window_seconds integer, max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  opened timestamptz;
  next_count integer;
  allowed integer := max;
begin
  if window_seconds < 1 or allowed < 1 then
    raise exception 'rate limit window is invalid' using errcode = 'ST006';
  end if;

  opened := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into public.rate_limits as rl (bucket, window_start, count)
  values (b, opened, 1)
  on conflict (bucket, window_start) do update
  set count = rl.count + 1
  returning count into next_count;

  return next_count <= allowed;
end;
$$;

-- Transaction-local only. The third argument of set_config is is_local.
create function public.restore_site(p_site uuid, p_owner uuid)
returns table (
  slug text,
  slug_changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_slug text;
  chosen text;
  suffix text;
  trimmed text;
  n integer;
  changed boolean := false;
begin
  perform set_config('studiolo.restoring', 'on', true);

  select s.slug
  into current_slug
  from public.sites s
  where s.id = p_site
    and s.owner_id = p_owner
    and s.deleted_at is not null
    and s.purge_after > now()
  for update;

  if not found then
    raise exception 'not_restorable' using errcode = 'ST404';
  end if;

  if public.slug_is_free(current_slug, p_owner) then
    chosen := current_slug;
  else
    changed := true;
    n := 2;
    loop
      suffix := '-' || n::text;
      trimmed := regexp_replace(left(current_slug, 40 - char_length(suffix)), '-+$', '');
      if char_length(trimmed) < 1 then
        raise exception 'slug_unavailable' using errcode = 'ST003';
      end if;
      chosen := trimmed || suffix;
      exit when public.slug_is_free(chosen, p_owner);
      n := n + 1;
      if n > 1000 then
        raise exception 'slug_unavailable' using errcode = 'ST003';
      end if;
    end loop;
  end if;

  update public.sites
  set
    deleted_at = null,
    purge_after = null,
    live_publish_id = null,
    slug = chosen,
    slug_locked_at = case when changed then null else slug_locked_at end,
    updated_at = now()
  where id = p_site;

  return query select chosen, changed;
end;
$$;

-- Prompt 05 owns the changes document. Keys are pages, sections, elements
-- and element_layouts. Each value is { "upsert": [row], "delete": [uuid] }.
-- A missing key changes nothing. site_id always comes from the site argument.
create function public.save_draft(site uuid, expected_revision integer, changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  payload jsonb := coalesce(changes, '{}'::jsonb);
  new_revision integer;
begin
  update public.sites
  set
    draft_revision = draft_revision + 1,
    draft_updated_at = now()
  where id = site
    and draft_revision = expected_revision
  returning draft_revision into new_revision;

  if new_revision is null then
    raise exception 'stale_revision' using errcode = 'ST409';
  end if;

  if exists (
    select 1
    from public.pages p
    join jsonb_array_elements(coalesce(payload #> '{pages,upsert}', '[]'::jsonb)) item
      on p.id = (item->>'id')::uuid
    where p.site_id <> site
  ) or exists (
    select 1
    from public.sections s
    join jsonb_array_elements(coalesce(payload #> '{sections,upsert}', '[]'::jsonb)) item
      on s.id = (item->>'id')::uuid
    where s.site_id <> site
  ) or exists (
    select 1
    from public.elements e
    join jsonb_array_elements(coalesce(payload #> '{elements,upsert}', '[]'::jsonb)) item
      on e.id = (item->>'id')::uuid
    where e.site_id <> site
  ) or exists (
    select 1
    from public.element_layouts el
    join public.elements e on e.id = el.element_id
    join jsonb_array_elements(coalesce(payload #> '{element_layouts,upsert}', '[]'::jsonb)) item
      on el.id = (item->>'id')::uuid
    where e.site_id <> site
  ) then
    raise exception 'cross_site_change' using errcode = 'ST007';
  end if;

  delete from public.element_layouts el
  using jsonb_array_elements_text(coalesce(payload #> '{element_layouts,delete}', '[]'::jsonb)) item
  where el.id = item.value::uuid
    and exists (
      select 1
      from public.elements e
      where e.id = el.element_id
        and e.site_id = site
    );

  delete from public.elements e
  using jsonb_array_elements_text(coalesce(payload #> '{elements,delete}', '[]'::jsonb)) item
  where e.id = item.value::uuid
    and e.site_id = site;

  delete from public.sections s
  using jsonb_array_elements_text(coalesce(payload #> '{sections,delete}', '[]'::jsonb)) item
  where s.id = item.value::uuid
    and s.site_id = site;

  delete from public.pages p
  using jsonb_array_elements_text(coalesce(payload #> '{pages,delete}', '[]'::jsonb)) item
  where p.id = item.value::uuid
    and p.site_id = site;

  insert into public.pages as p (id, site_id, title, slug, sort_order, in_nav, is_home)
  select
    (item->>'id')::uuid,
    site,
    item->>'title',
    coalesce(item->>'slug', ''),
    (item->>'sort_order')::integer,
    coalesce((item->>'in_nav')::boolean, true),
    coalesce((item->>'is_home')::boolean, false)
  from jsonb_array_elements(coalesce(payload #> '{pages,upsert}', '[]'::jsonb)) item
  on conflict (id) do update
  set
    title = excluded.title,
    slug = excluded.slug,
    sort_order = excluded.sort_order,
    in_nav = excluded.in_nav,
    is_home = excluded.is_home
  where p.site_id = site;

  insert into public.sections as s (id, site_id, page_id, name, sort_order)
  select
    (item->>'id')::uuid,
    site,
    nullif(item->>'page_id', '')::uuid,
    item->>'name',
    (item->>'sort_order')::integer
  from jsonb_array_elements(coalesce(payload #> '{sections,upsert}', '[]'::jsonb)) item
  on conflict (id) do update
  set
    page_id = excluded.page_id,
    name = excluded.name,
    sort_order = excluded.sort_order
  where s.site_id = site;

  insert into public.elements as e (
    id, site_id, page_id, section_id, type, name, content, sort_order
  )
  select
    (item->>'id')::uuid,
    site,
    nullif(item->>'page_id', '')::uuid,
    (item->>'section_id')::uuid,
    item->>'type',
    item->>'name',
    coalesce(item->'content', '{}'::jsonb),
    (item->>'sort_order')::integer
  from jsonb_array_elements(coalesce(payload #> '{elements,upsert}', '[]'::jsonb)) item
  on conflict (id) do update
  set
    page_id = excluded.page_id,
    section_id = excluded.section_id,
    type = excluded.type,
    name = excluded.name,
    content = excluded.content,
    sort_order = excluded.sort_order
  where e.site_id = site;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(payload #> '{element_layouts,upsert}', '[]'::jsonb)) item
    where not exists (
      select 1
      from public.elements e
      where e.id = (item->>'element_id')::uuid
        and e.site_id = site
    )
  ) then
    raise exception 'cross_site_change' using errcode = 'ST007';
  end if;

  insert into public.element_layouts as el (
    id,
    element_id,
    breakpoint,
    col_start,
    col_span,
    row_start,
    row_span,
    hidden,
    placement_source
  )
  select
    (item->>'id')::uuid,
    (item->>'element_id')::uuid,
    item->>'breakpoint',
    (item->>'col_start')::integer,
    (item->>'col_span')::integer,
    (item->>'row_start')::integer,
    (item->>'row_span')::integer,
    coalesce((item->>'hidden')::boolean, false),
    coalesce(item->>'placement_source', 'auto')
  from jsonb_array_elements(coalesce(payload #> '{element_layouts,upsert}', '[]'::jsonb)) item
  on conflict (id) do update
  set
    element_id = excluded.element_id,
    breakpoint = excluded.breakpoint,
    col_start = excluded.col_start,
    col_span = excluded.col_span,
    row_start = excluded.row_start,
    row_span = excluded.row_span,
    hidden = excluded.hidden,
    placement_source = excluded.placement_source
  where exists (
    select 1
    from public.elements owner_element
    where owner_element.id = el.element_id
      and owner_element.site_id = site
  );

  return new_revision;
end;
$$;

create function public.assets_same_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset uuid;
begin
  if tg_table_name = 'sites' then
    if new.og_asset_id is not null and not exists (
      select 1
      from public.assets
      where id = new.og_asset_id
        and site_id = new.id
    ) then
      raise exception 'asset site mismatch' using errcode = 'ST005';
    end if;
    if new.favicon_asset_id is not null and not exists (
      select 1
      from public.assets
      where id = new.favicon_asset_id
        and site_id = new.id
    ) then
      raise exception 'asset site mismatch' using errcode = 'ST005';
    end if;
    return new;
  end if;

  if tg_table_name = 'elements' then
    if new.type = 'image' and coalesce(new.content->>'assetId', '') <> '' then
      begin
        asset := (new.content->>'assetId')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'asset site mismatch' using errcode = 'ST005';
      end;
      if not exists (
        select 1
        from public.assets
        where id = asset
          and site_id = new.site_id
      ) then
        raise exception 'asset site mismatch' using errcode = 'ST005';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'assets'
     and tg_op = 'UPDATE'
     and new.site_id is distinct from old.site_id
     and (
       exists (
         select 1
         from public.sites
         where (og_asset_id = new.id or favicon_asset_id = new.id)
           and id is distinct from new.site_id
       )
       or exists (
         select 1
         from public.elements
         where type = 'image'
           and content->>'assetId' = new.id::text
           and site_id is distinct from new.site_id
       )
     ) then
    raise exception 'asset site mismatch' using errcode = 'ST005';
  end if;

  return new;
end;
$$;

create trigger assets_same_site
  before insert or update of og_asset_id, favicon_asset_id on public.sites
  for each row
  execute function public.assets_same_site();

create trigger assets_same_site
  before insert or update of type, content, site_id on public.elements
  for each row
  execute function public.assets_same_site();

create trigger assets_same_site
  before update of site_id on public.assets
  for each row
  execute function public.assets_same_site();

alter function public.is_site_owner(uuid) owner to postgres;
alter function public.is_site_public(uuid) owner to postgres;
alter function public.increment_page_views(uuid, date) owner to postgres;
alter function public.resolve_host(text) owner to postgres;
alter function public.rate_limit_hit(text, integer, integer) owner to postgres;
alter function public.restore_site(uuid, uuid) owner to postgres;
alter function public.save_draft(uuid, integer, jsonb) owner to postgres;
alter function public.assets_same_site() owner to postgres;

revoke all on function public.is_site_owner(uuid) from public;
revoke all on function public.is_site_public(uuid) from public;
revoke all on function public.increment_page_views(uuid, date) from public, anon, authenticated;
revoke all on function public.resolve_host(text) from public;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.restore_site(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_draft(uuid, integer, jsonb) from public, anon;
revoke all on function public.assets_same_site() from public, anon, authenticated;

grant execute on function public.is_site_owner(uuid) to authenticated, service_role;
grant execute on function public.is_site_public(uuid) to anon, authenticated, service_role;
grant execute on function public.increment_page_views(uuid, date) to service_role;
grant execute on function public.resolve_host(text) to anon, authenticated, service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.restore_site(uuid, uuid) to service_role;
grant execute on function public.save_draft(uuid, integer, jsonb) to authenticated, service_role;
