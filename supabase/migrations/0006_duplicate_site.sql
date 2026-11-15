-- Studiolo 04a: duplicate a site in one transaction.
--
-- Called by the duplicateSite server action with the service role, after the
-- action has checked that the signed-in user owns the site. The function
-- checks ownership again (p_owner) and refuses deleted sites.
--
-- The copy: name "Copy of <name>" cut to 60; slug "copy-of-<slug>" cut to 40,
-- then the first free "-2", "-3", ...; a Draft (no live publish, slug not
-- locked); seo_title and seo_description copied; no password, domain,
-- submissions, views or publishes. Pages, sections, elements, element_layouts
-- and assets are deep-copied with new ids; page_id, section_id, element_id,
-- content.assetId, page links (content.link.kind = 'page'), og_asset_id and
-- favicon_asset_id are remapped. An asset's path is fixed by its site and id
-- (assets_path_in_site), so every copied asset gets a new path.
--
-- Returns the new site and an asset_paths array of {from, to} object names.
-- The caller copies those storage objects (and any other "<old>/draft/*"
-- object) and hard-deletes the new site if a copy fails.
--
-- SQLSTATE ST404 "not_found": no such site for this owner, or it is deleted.
-- SQLSTATE ST003 "slug_unavailable": no free "-n" suffix up to 1000.

create function public.duplicate_site(p_site uuid, p_owner uuid)
returns table (
  id uuid,
  name text,
  slug text,
  asset_paths jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.sites%rowtype;
  new_site uuid := gen_random_uuid();
  new_name text;
  base text;
  chosen text;
  n integer := 2;
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
  chosen := base;
  while not public.slug_is_free(chosen, p_owner) loop
    chosen := regexp_replace(
      left(base, 40 - char_length('-' || n::text)), '-+$', ''
    ) || '-' || n::text;
    n := n + 1;
    if n > 1000 then
      raise exception 'slug_unavailable' using errcode = 'ST003';
    end if;
  end loop;

  insert into public.sites (id, owner_id, name, slug, seo_title, seo_description)
  values (new_site, p_owner, new_name, chosen, src.seo_title, src.seo_description);

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

-- content.assetId and a page link's value point into the copied site.
-- Ids that are not in the maps (an empty assetId, a link to a page that no
-- longer exists) are left as they are.
create function public.duplicate_site_content(
  content jsonb,
  page_map jsonb,
  asset_map jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select
    case
      when coalesce(c2.content->'link'->>'kind', '') = 'page'
        and page_map ? (c2.content->'link'->>'value')
      then jsonb_set(
        c2.content,
        '{link,value}',
        page_map->(c2.content->'link'->>'value')
      )
      else c2.content
    end
  from (
    select
      case
        when jsonb_typeof(content) = 'object'
          and asset_map ? coalesce(content->>'assetId', '')
        then jsonb_set(content, '{assetId}', asset_map->(content->>'assetId'))
        else content
      end as content
  ) c2;
$$;

alter function public.duplicate_site(uuid, uuid) owner to postgres;
alter function public.duplicate_site_content(jsonb, jsonb, jsonb) owner to postgres;

revoke all on function public.duplicate_site(uuid, uuid) from public, anon, authenticated;
revoke all on function public.duplicate_site_content(jsonb, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.duplicate_site(uuid, uuid) to service_role;
grant execute on function public.duplicate_site_content(jsonb, jsonb, jsonb) to service_role;
