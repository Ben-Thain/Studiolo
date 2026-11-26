-- 06c free canvas: 96 columns, z-order. Existing rows are converted in place.

alter table public.element_layouts
  drop constraint element_layouts_col_start,
  drop constraint element_layouts_col_span,
  drop constraint element_layouts_columns_fit;

update public.element_layouts
set
  col_start = round(((col_start - 1) * 116.6667) / (1376.0 / 96))::integer + 1,
  col_span = (
    least(
      97,
      round((
        (col_start - 1) * 116.6667
        + col_span * 92.6667
        + (col_span - 1) * 24
      ) / (1376.0 / 96))::integer + 1
    )
    - (round(((col_start - 1) * 116.6667) / (1376.0 / 96))::integer + 1)
  );

alter table public.element_layouts
  add constraint element_layouts_col_start check (col_start between 1 and 96),
  add constraint element_layouts_col_span check (col_span between 1 and 96),
  add constraint element_layouts_columns_fit check (col_start + col_span - 1 <= 96),
  add column z_index smallint not null default 0,
  add constraint element_layouts_z_index check (z_index between 0 and 9999);

create or replace function public.save_draft(site uuid, expected_revision integer, changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  payload jsonb := coalesce(changes, '{}'::jsonb);
  new_revision integer;
  home_count integer;
begin
  -- service_role (and the table owner) may update the draft columns directly.
  -- The signed-in owner goes through bump_draft_revision, which checks
  -- ownership itself. Either way RLS still applies to every content write.
  if has_column_privilege('public.sites', 'draft_revision', 'UPDATE') then
    update public.sites
    set
      draft_revision = draft_revision + 1,
      draft_updated_at = now()
    where id = site
      and draft_revision = expected_revision
    returning draft_revision into new_revision;
  else
    new_revision := public.bump_draft_revision(site, expected_revision);
  end if;

  if new_revision is null then
    raise exception 'stale_revision' using errcode = 'ST409';
  end if;

  -- Both checks run in crosses_site_draft (security definer) so they see rows
  -- RLS hides from the caller: a payload id or parent that belongs to another
  -- site raises ST007 instead of being skipped or denied row by row.
  if public.crosses_site_draft(site, payload) then
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

  -- one_home_per_site is a partial unique index and cannot be deferred, so clear
  -- the outgoing home first. Payload order no longer matters.
  -- 02c-fix: a payload may name only the new home. Two or more homes in one
  -- payload is ST010; exactly one clears is_home on every other page of the
  -- site, so the save never surfaces a raw 23505.
  select count(*)
  into home_count
  from jsonb_array_elements(coalesce(payload #> '{pages,upsert}', '[]'::jsonb)) item
  where coalesce((item->>'is_home')::boolean, false);

  if home_count > 1 then
    raise exception 'home_page_required' using errcode = 'ST010';
  end if;

  if home_count = 1 then
    update public.pages p
    set is_home = false
    where p.site_id = site
      and p.is_home
      and p.id <> (
        select (item->>'id')::uuid
        from jsonb_array_elements(payload #> '{pages,upsert}') item
        where coalesce((item->>'is_home')::boolean, false)
      );
  end if;

  update public.pages p
  set is_home = false
  from jsonb_array_elements(coalesce(payload #> '{pages,upsert}', '[]'::jsonb)) item
  where p.site_id = site
    and p.is_home
    and p.id = (item->>'id')::uuid
    and not coalesce((item->>'is_home')::boolean, false);

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

  -- A save that touches pages must leave exactly one home page, unless the
  -- site has no pages at all.
  if (
    jsonb_array_length(coalesce(payload #> '{pages,upsert}', '[]'::jsonb)) > 0
    or jsonb_array_length(coalesce(payload #> '{pages,delete}', '[]'::jsonb)) > 0
  ) and exists (
    select 1 from public.pages where site_id = site
  ) and (
    select count(*) from public.pages where site_id = site and is_home
  ) <> 1 then
    raise exception 'home_page_required' using errcode = 'ST010';
  end if;

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
    placement_source,
    z_index
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
    coalesce(item->>'placement_source', 'auto'),
    coalesce((item->>'z_index')::smallint, 0)
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
    placement_source = excluded.placement_source,
    z_index = excluded.z_index
  where exists (
    select 1
    from public.elements owner_element
    where owner_element.id = el.element_id
      and owner_element.site_id = site
  );

  return new_revision;
end;
$$;

create or replace function public.duplicate_site(p_site uuid, p_owner uuid)
returns table (
  id uuid,
  name text,
  slug text,
  asset_paths jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  src public.sites%rowtype;
  new_site uuid := gen_random_uuid();
  new_name text;
  base text;
  candidate text;
  chosen text;
  n integer := 1;
  page_map jsonb;
  section_map jsonb;
  element_map jsonb;
  asset_map jsonb;
  paths jsonb;
begin
  select s.*
  into src
  from public.sites s
  where s.id = p_site
    and s.owner_id = p_owner
    and s.deleted_at is null;

  if not found then
    raise exception 'not_found' using errcode = 'ST404';
  end if;

  new_name := rtrim(left('Copy of ' || src.name, 60));

  base := regexp_replace(left('copy-of-' || src.slug, 40), '-+$', '');

  -- 04a-fix: two duplicates by the same owner at once used to pick the same
  -- free slug and the second failed with 23505. The owner's duplicates now
  -- queue on a transaction-level advisory lock, so the second sees the first
  -- one's slug. A clash with anyone else (another owner taking the address
  -- between the check and the insert) moves on to the next suffix.
  perform pg_advisory_xact_lock(hashtext('duplicate_site:' || p_owner::text));

  loop
    if n > 1000 then
      raise exception 'slug_unavailable' using errcode = 'ST003';
    end if;
    if n = 1 then
      candidate := base;
    else
      candidate := regexp_replace(
        left(base, 40 - char_length('-' || n::text)), '-+$', ''
      ) || '-' || n::text;
    end if;
    if public.slug_is_free(candidate, p_owner) then
      begin
        insert into public.sites (id, owner_id, name, slug, seo_title, seo_description, template_id, template_version)
        values (new_site, p_owner, new_name, candidate, src.seo_title, src.seo_description, src.template_id, src.template_version);
        chosen := candidate;
        exit;
      exception
        when unique_violation then
          null;
      end;
    end if;
    n := n + 1;
  end loop;

  select coalesce(jsonb_object_agg(p.id::text, gen_random_uuid()), '{}'::jsonb)
  into page_map
  from public.pages p
  where p.site_id = p_site;

  select coalesce(jsonb_object_agg(s.id::text, gen_random_uuid()), '{}'::jsonb)
  into section_map
  from public.sections s
  where s.site_id = p_site;

  select coalesce(jsonb_object_agg(e.id::text, gen_random_uuid()), '{}'::jsonb)
  into element_map
  from public.elements e
  where e.site_id = p_site;

  select coalesce(jsonb_object_agg(a.id::text, gen_random_uuid()), '{}'::jsonb)
  into asset_map
  from public.assets a
  where a.site_id = p_site;

  -- Assets first: image elements and the sites og/favicon columns must point
  -- at an asset of their own site (assets_same_site).
  insert into public.assets (
    id, site_id, path, width, height, mime, bytes, blur_data_url, created_at
  )
  select
    (asset_map->>a.id::text)::uuid,
    new_site,
    new_site::text || '/draft/' || (asset_map->>a.id::text)
      || substring(a.path from '\.[a-z]+$'),
    a.width,
    a.height,
    a.mime,
    a.bytes,
    a.blur_data_url,
    a.created_at
  from public.assets a
  where a.site_id = p_site;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'from', a.path,
        'to', new_site::text || '/draft/' || (asset_map->>a.id::text)
          || substring(a.path from '\.[a-z]+$')
      )
      order by a.path
    ),
    '[]'::jsonb
  )
  into paths
  from public.assets a
  where a.site_id = p_site;

  insert into public.pages (id, site_id, title, slug, sort_order, in_nav, is_home)
  select
    (page_map->>p.id::text)::uuid,
    new_site,
    p.title,
    p.slug,
    p.sort_order,
    p.in_nav,
    p.is_home
  from public.pages p
  where p.site_id = p_site;

  insert into public.sections (id, site_id, page_id, name, sort_order)
  select
    (section_map->>s.id::text)::uuid,
    new_site,
    (page_map->>s.page_id::text)::uuid,
    s.name,
    s.sort_order
  from public.sections s
  where s.site_id = p_site;

  insert into public.elements (
    id, site_id, page_id, section_id, type, name, content, sort_order
  )
  select
    (element_map->>e.id::text)::uuid,
    new_site,
    (page_map->>e.page_id::text)::uuid,
    (section_map->>e.section_id::text)::uuid,
    e.type,
    e.name,
    public.duplicate_site_content(e.content, page_map, asset_map),
    e.sort_order
  from public.elements e
  where e.site_id = p_site;

  insert into public.element_layouts (
    id, element_id, breakpoint, col_start, col_span, row_start, row_span,
    hidden, placement_source, z_index
  )
  select
    gen_random_uuid(),
    (element_map->>l.element_id::text)::uuid,
    l.breakpoint,
    l.col_start,
    l.col_span,
    l.row_start,
    l.row_span,
    l.hidden,
    l.placement_source,
    l.z_index
  from public.element_layouts l
  join public.elements e on e.id = l.element_id
  where e.site_id = p_site;

  update public.sites
  set
    og_asset_id = (asset_map->>src.og_asset_id::text)::uuid,
    favicon_asset_id = (asset_map->>src.favicon_asset_id::text)::uuid
  where sites.id = new_site
    and (src.og_asset_id is not null or src.favicon_asset_id is not null);

  return query select new_site, new_name, chosen, paths;
end;
$$;

create or replace function public.create_site(
  p_owner uuid,
  p_site uuid,
  p_name text,
  p_slug text,
  p_template_id text,
  p_template_version integer,
  p_assets jsonb,
  p_changes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  asset jsonb;
  asset_id uuid;
  asset_path text;
begin
  if p_owner is null or p_site is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.sites (
    id, owner_id, name, slug, template_id, template_version
  )
  values (
    p_site, p_owner, p_name, p_slug, p_template_id, p_template_version
  );

  -- Assets before content so assets_same_site passes.
  for asset in select value from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb))
  loop
    asset_id := (asset->>'id')::uuid;
    asset_path := asset->>'path';
    if asset_path is distinct from (p_site::text || '/draft/' || asset_id::text || '.webp') then
      raise exception 'bad_asset_path' using errcode = 'ST011';
    end if;
    insert into public.assets (
      id, site_id, path, width, height, mime, bytes, blur_data_url
    )
    values (
      asset_id,
      p_site,
      asset_path,
      (asset->>'width')::integer,
      (asset->>'height')::integer,
      asset->>'mime',
      (asset->>'bytes')::integer,
      asset->>'blur_data_url'
    );
  end loop;

  perform public.save_draft(p_site, 0, coalesce(p_changes, '{}'::jsonb));
  return p_site;
end;
$$;
grant execute on function public.save_draft(uuid, integer, jsonb) to authenticated, service_role;
grant execute on function public.duplicate_site(uuid, uuid) to service_role;
grant execute on function public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb) to service_role;
