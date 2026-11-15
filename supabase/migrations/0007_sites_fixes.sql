-- Studiolo 04a-fix: profile name check, duplicate_site under concurrency,
-- one-transaction site creation and a one-query slug suggestion.

-- 1. display_name ------------------------------------------------------------
-- 0005 trimmed spaces only (btrim), so a tab-only name passed, and the length
-- was measured after trimming, so 500 spaces + "a" passed. Now: at most 80
-- characters as stored, and either empty (handle_new_user() creates every
-- profile with '') or containing at least one non-space character. The
-- Account action trims and collapses whitespace before saving.
alter table public.profiles
  drop constraint profiles_display_name_length;

alter table public.profiles
  add constraint profiles_display_name_length
  check (
    char_length(display_name) <= 80
    and (display_name = '' or display_name ~ '[^[:space:]]')
  );

-- 2. duplicate_site ------------------------------------------------------------
-- Same copy as 0006, plus: search_path includes pg_temp last, an advisory
-- lock per owner around the slug choice, and a retry on unique_violation.
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
        insert into public.sites (id, owner_id, name, slug, seo_title, seo_description)
        values (new_site, p_owner, new_name, candidate, src.seo_title, src.seo_description);
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

alter function public.duplicate_site_content(jsonb, jsonb, jsonb)
  set search_path = public, pg_temp;

-- 3. create_site ---------------------------------------------------------------
-- The New site form used to insert the site, then write the starter content
-- with save_draft in a second call; a failure in between left a site with no
-- pages. create_site does both in one transaction as the signed-in user
-- (security invoker: the sites insert policy, the column grants and
-- save_draft's own checks all apply). Any error rolls back the site too.
-- Errors pass through unchanged: 23505 or ST001 (address taken), ST003
-- (reserved), 23514 (name or slug format), ST007/ST010 (bad starter content).
create function public.create_site(p_name text, p_slug text, p_changes jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_site uuid := gen_random_uuid();
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.sites (id, owner_id, name, slug)
  values (new_site, me, p_name, p_slug);

  perform public.save_draft(new_site, 0, coalesce(p_changes, '{}'::jsonb));

  return new_site;
end;
$$;

-- 4. first_free_slug -----------------------------------------------------------
-- The "Use <slug>-2" suggestion in one query instead of up to 20 calls:
-- the first of <slug>-2 … <slug>-20 (base cut so the result stays within 40
-- characters, as withSuffix in src/lib/sites/slug.ts) that slug_is_free
-- accepts, or null.
create function public.first_free_slug(s text, for_owner uuid)
returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select c.candidate
  from (
    select
      n,
      regexp_replace(left(s, 40 - char_length('-' || n::text)), '-+$', '')
        || '-' || n::text as candidate
    from generate_series(2, 20) as n
  ) c
  where public.slug_is_free(c.candidate, for_owner)
  order by c.n
  limit 1;
$$;

alter function public.create_site(text, text, jsonb) owner to postgres;
alter function public.first_free_slug(text, uuid) owner to postgres;

revoke all on function public.create_site(text, text, jsonb) from public, anon;
revoke all on function public.first_free_slug(text, uuid) from public, anon;

grant execute on function public.create_site(text, text, jsonb) to authenticated;
grant execute on function public.first_free_slug(text, uuid) to authenticated, service_role;
