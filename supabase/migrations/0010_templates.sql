-- Studiolo 06b: template provenance and a service-role create_site.
-- template_id / template_version record which original a site was copied
-- from. They are never used for rendering or restrictions, and they are
-- not in the authenticated update grant.
-- The previous create_site(text, text, jsonb) is dropped. The new function
-- takes the owner explicitly and inserts asset rows before save_draft.

alter table public.sites
  add column template_id text,
  add column template_version integer,
  add constraint sites_template_id_format check (
    template_id is null or template_id ~ '^[a-z0-9-]{1,40}$'
  ),
  add constraint sites_template_version_positive check (
    template_version is null or template_version > 0
  );

comment on column public.sites.template_id is
  'Provenance only: the Studiolo original this site was copied from. Not used for rendering.';
comment on column public.sites.template_version is
  'Provenance only: the template file version at create time.';

grant select (template_id, template_version) on table public.sites to authenticated;

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
    hidden, placement_source
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
    l.placement_source
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


drop function public.create_site(text, text, jsonb);

create function public.create_site(
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


alter function public.duplicate_site(uuid, uuid) owner to postgres;
alter function public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb) owner to postgres;

revoke all on function public.duplicate_site(uuid, uuid) from public, anon, authenticated;
grant execute on function public.duplicate_site(uuid, uuid) to service_role;

revoke all on function public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb)
  to service_role;
