-- Runs against a freshly migrated local database.
-- psql -v ON_ERROR_STOP=1 -f supabase/checks/rls_and_constraints.sql
-- Each successful section prints an ok: line. A failed assertion aborts the script.

delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.com'),
  ('10000000-0000-4000-8000-000000000002', 'owner-b@example.com');

-- profiles row, no email column, dormant default ---------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    raise exception 'profiles has an email column';
  end if;

  if (
    select display_name
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
  ) is distinct from '' then
    raise exception 'auth insert did not create a profile';
  end if;

  if (
    select plan
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
  ) is distinct from 'unlocked' then
    raise exception 'profile default is not unlocked';
  end if;
end
$$;

\echo ok: auth trigger creates a profile

-- check constraints ---------------------------------------------------------

do $$
begin
  begin
    insert into public.sites (owner_id, name, slug)
    values ('10000000-0000-4000-8000-000000000001', '', 'valid-name');
    raise exception 'empty name was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.sites (owner_id, name, slug)
    values (
      '10000000-0000-4000-8000-000000000001',
      repeat('n', 61),
      'valid-name'
    );
    raise exception 'long name was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: site name is 1 to 60 characters

do $$
begin
  begin
    insert into public.sites (owner_id, name, slug)
    values ('10000000-0000-4000-8000-000000000001', 'Name', 'ab');
    raise exception 'short slug was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.sites (owner_id, name, slug)
    values ('10000000-0000-4000-8000-000000000001', 'Name', 'No-Upper');
    raise exception 'uppercase slug was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: slug format

do $$
begin
  begin
    insert into public.sites (owner_id, name, slug, password_enabled)
    values (
      '10000000-0000-4000-8000-000000000001',
      'Name',
      'needs-hash',
      true
    );
    raise exception 'password without a hash was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: password requires a hash

do $$
begin
  begin
    insert into public.sites (owner_id, name, slug, seo_title)
    values (
      '10000000-0000-4000-8000-000000000001',
      'Name',
      'seo-title',
      repeat('t', 71)
    );
    raise exception 'long seo title was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.sites (owner_id, name, slug, seo_description)
    values (
      '10000000-0000-4000-8000-000000000001',
      'Name',
      'seo-description',
      repeat('d', 201)
    );
    raise exception 'long seo description was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: seo title and description limits

-- reserved slugs ------------------------------------------------------------

do $$
begin
  if (select count(*) from public.reserved_slugs) <> 30 then
    raise exception 'expected 30 reserved slugs, found %', (select count(*) from public.reserved_slugs);
  end if;

  begin
    insert into public.sites (owner_id, name, slug)
    values ('10000000-0000-4000-8000-000000000001', 'Name', 'www');
    raise exception 'reserved slug was accepted';
  exception
    when sqlstate 'ST003' then
      null;
  end;

  perform set_config('studiolo.restoring', 'on', true);
  begin
    insert into public.sites (
      id,
      owner_id,
      name,
      slug,
      slug_locked_at
    )
    values (
      '10000000-0000-4000-8000-000000000021',
      '10000000-0000-4000-8000-000000000001',
      'Name',
      'restore-reserved',
      now()
    );
    update public.sites
    set slug = 'admin'
    where id = '10000000-0000-4000-8000-000000000021';
    raise exception 'reserved slug was accepted while restoring';
  exception
    when sqlstate 'ST003' then
      null;
  end;
end
$$;

\echo ok: reserved slug rejected
\echo ok: reserved slug rejected while restoring

-- active slug uniqueness and the soft-delete hold -------------------------

do $$
begin
  insert into public.sites (id, owner_id, name, slug)
  values (
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'Held',
    'held-address'
  );

  begin
    insert into public.sites (owner_id, name, slug)
    values (
      '10000000-0000-4000-8000-000000000002',
      'Other',
      'held-address'
    );
    raise exception 'duplicate active slug was accepted';
  exception
    when unique_violation then
      null;
  end;

  update public.sites
  set deleted_at = now()
  where id = '10000000-0000-4000-8000-000000000011';

  begin
    insert into public.sites (owner_id, name, slug)
    values (
      '10000000-0000-4000-8000-000000000002',
      'Other',
      'held-address'
    );
    raise exception 'cross-owner soft-deleted slug was accepted';
  exception
    when sqlstate 'ST001' then
      null;
  end;

  insert into public.sites (id, owner_id, name, slug)
  values (
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000001',
    'Held again',
    'held-address'
  );
end
$$;

\echo ok: active slug is unique
\echo ok: cross-owner soft-deleted slug blocked
\echo ok: same owner may reuse a soft-deleted slug

-- locked address ------------------------------------------------------------

do $$
begin
  insert into public.sites (id, owner_id, name, slug, slug_locked_at)
  values (
    '10000000-0000-4000-8000-000000000013',
    '10000000-0000-4000-8000-000000000001',
    'Locked',
    'locked-address',
    now()
  );

  begin
    update public.sites
    set slug = 'locked-address-2'
    where id = '10000000-0000-4000-8000-000000000013';
    raise exception 'locked slug change was accepted';
  exception
    when sqlstate 'ST002' then
      null;
  end;

  if (
    select slug
    from public.sites
    where id = '10000000-0000-4000-8000-000000000013'
  ) is distinct from 'locked-address' then
    raise exception 'failed lock changed the slug';
  end if;
end
$$;

\echo ok: locked slug blocked

begin;
do $$
begin
  perform set_config('studiolo.restoring', 'on', true);
  update public.sites
  set slug = 'locked-address-2'
  where id = '10000000-0000-4000-8000-000000000013';
end
$$;
commit;

do $$
begin
  if (
    select slug
    from public.sites
    where id = '10000000-0000-4000-8000-000000000013'
  ) is distinct from 'locked-address-2' then
    raise exception 'restoring did not change the locked slug';
  end if;

  if current_setting('studiolo.restoring', true) = 'on' then
    raise exception 'restoring setting survived commit';
  end if;
end
$$;

\echo ok: locked slug allowed while restoring
\echo ok: restoring setting cleared after commit

begin;
select set_config('studiolo.restoring', 'on', true) \gset
commit;

do $$
begin
  if coalesce(current_setting('studiolo.restoring', true), '') <> '' then
    raise exception 'restoring setting survived commit';
  end if;
end
$$;

\echo ok: restoring is transaction-local in restore path

-- slug_is_free truth table --------------------------------------------------

do $$
declare
  owner_a uuid := '10000000-0000-4000-8000-000000000001';
  owner_b uuid := '10000000-0000-4000-8000-000000000002';
begin
  insert into public.sites (id, owner_id, name, slug)
  values (
    '10000000-0000-4000-8000-000000000014',
    owner_a,
    'Live',
    'live-address'
  );

  insert into public.sites (id, owner_id, name, slug, deleted_at)
  values (
    '10000000-0000-4000-8000-000000000015',
    owner_b,
    'Foreign',
    'foreign-hold',
    now()
  );

  insert into public.sites (id, owner_id, name, slug, deleted_at)
  values (
    '10000000-0000-4000-8000-000000000016',
    owner_a,
    'Retired',
    'retired-address',
    now()
  );

  if public.slug_is_free('fresh-address', owner_a) is not true then
    raise exception 'case 1 free slug';
  end if;
  if public.slug_is_free('admin', owner_a) is not false then
    raise exception 'case 2 reserved slug';
  end if;
  if public.slug_is_free('ab', owner_a) is not false then
    raise exception 'case 3 short slug';
  end if;
  if public.slug_is_free('No-Upper', owner_a) is not false then
    raise exception 'case 4 uppercase slug';
  end if;
  if public.slug_is_free('live-address', owner_a) is not false then
    raise exception 'case 5 active slug';
  end if;
  if public.slug_is_free('foreign-hold', owner_a) is not false then
    raise exception 'case 6 other owner hold';
  end if;
  if public.slug_is_free('foreign-hold', owner_b) is not true then
    raise exception 'case 6 owner of the hold should be free';
  end if;
  if public.slug_is_free('retired-address', owner_a) is not true then
    raise exception 'case 7 same owner hold';
  end if;
  if public.slug_is_free('', owner_a) is not false then
    raise exception 'case 8 empty slug';
  end if;

  if has_function_privilege(
    'anon',
    'public.slug_is_free(text, uuid)',
    'execute'
  ) then
    raise exception 'anon can execute slug_is_free';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.slug_is_free(text, uuid)',
    'execute'
  ) then
    raise exception 'authenticated cannot execute slug_is_free';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.slug_is_free(text, uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot execute slug_is_free';
  end if;
end
$$;

\echo ok: slug_is_free free slug
\echo ok: slug_is_free reserved
\echo ok: slug_is_free short
\echo ok: slug_is_free uppercase
\echo ok: slug_is_free active slug
\echo ok: slug_is_free other owner hold
\echo ok: slug_is_free same owner hold
\echo ok: slug_is_free empty

-- publish history is insert-only -------------------------------------------

do $$
begin
  if has_table_privilege('anon', 'public.site_publishes', 'update') then
    raise exception 'anon has update on site_publishes';
  end if;
  if has_table_privilege('authenticated', 'public.site_publishes', 'update') then
    raise exception 'authenticated has update on site_publishes';
  end if;
  if has_table_privilege('service_role', 'public.site_publishes', 'update') then
    raise exception 'service_role has update on site_publishes';
  end if;

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (
    '10000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000014',
    '{"version":1}'::jsonb,
    '10000000-0000-4000-8000-000000000001'
  );

  begin
    update public.site_publishes
    set snapshot = '{"version":2}'::jsonb
    where id = '10000000-0000-4000-8000-000000000031';
    raise exception 'publish update was accepted';
  exception
    when sqlstate 'ST004' then
      null;
  end;

  begin
    update public.site_publishes
    set published_by = '10000000-0000-4000-8000-000000000002'
    where id = '10000000-0000-4000-8000-000000000031';
    raise exception 'publish reassignment was accepted';
  exception
    when sqlstate 'ST004' then
      null;
  end;
end
$$;

\echo ok: site_publishes update rejected

-- asset checks and site delete cascade -------------------------------------

do $$
begin
  begin
    insert into public.assets (site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-000000000014',
      'live-address/empty.png',
      'image/png',
      0
    );
    raise exception 'zero-byte asset was accepted';
  exception
    when check_violation then
      null;
  end;

  insert into public.assets (id, site_id, path, width, height, mime, bytes)
  values (
    '10000000-0000-4000-8000-000000000041',
    '10000000-0000-4000-8000-000000000014',
    'live-address/og.png',
    1200,
    630,
    'image/png',
    2048
  );

  update public.sites
  set
    og_asset_id = '10000000-0000-4000-8000-000000000041',
    live_publish_id = '10000000-0000-4000-8000-000000000031'
  where id = '10000000-0000-4000-8000-000000000014';

  delete from public.assets
  where id = '10000000-0000-4000-8000-000000000041';

  if (
    select og_asset_id
    from public.sites
    where id = '10000000-0000-4000-8000-000000000014'
  ) is not null then
    raise exception 'deleting an asset did not clear og_asset_id';
  end if;

  delete from public.sites
  where id = '10000000-0000-4000-8000-000000000014';

  if exists (
    select 1
    from public.site_publishes
    where id = '10000000-0000-4000-8000-000000000031'
  ) then
    raise exception 'deleting a site left its publish';
  end if;
end
$$;

\echo ok: asset bytes and site cascade

-- nothing in functions, policies, or views reads the dormant column --------

do $$
declare
  hits integer;
begin
  select count(*)
  into hits
  from (
    select p.prosrc as src
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ilike '%plan%'
    union all
    select
      coalesce(qual, '')
      || ' '
      || coalesce(with_check, '')
      || ' '
      || policyname
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%plan%'
        or coalesce(with_check, '') ilike '%plan%'
        or policyname ilike '%plan%'
      )
    union all
    select coalesce(definition, '') || ' ' || viewname
    from pg_views
    where schemaname = 'public'
      and (
        definition ilike '%plan%'
        or viewname ilike '%plan%'
      )
  ) as found;

  if hits <> 0 then
    raise exception 'dormant column is referenced by % object(s)', hits;
  end if;
end
$$;

\echo ok: dormant column is not referenced

-- account deletion and asset allow-list ------------------------------------

do $$
declare
  owner uuid := '10000000-0000-4000-8000-000000000003';
  site uuid := '10000000-0000-4000-8000-000000000017';
  publish uuid := '10000000-0000-4000-8000-000000000032';
  asset uuid := '10000000-0000-4000-8000-000000000042';
  fk text;
begin
  select pg_get_constraintdef(oid)
  into fk
  from pg_constraint
  where conname = 'site_publishes_published_by_fkey';

  if fk is null or fk not like '%ON DELETE SET NULL%' then
    raise exception 'published_by foreign key is %', coalesce(fk, 'missing');
  end if;

  insert into auth.users (id, email)
  values (owner, 'publisher@example.com');

  insert into public.sites (id, owner_id, name, slug)
  values (site, owner, 'Publisher', 'publisher-address');

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (publish, site, '{"version":1}'::jsonb, owner);

  update public.sites
  set live_publish_id = publish
  where id = site;

  insert into public.assets (id, site_id, path, mime, bytes)
  values (asset, site, 'publisher-address/og.png', 'image/png', 128);

  insert into public.pages (id, site_id, title, slug, sort_order, is_home)
  values (
    '10000000-0000-4000-8000-000000000051',
    site,
    'Home',
    'home',
    0,
    true
  );

  insert into public.sections (id, site_id, page_id, name, sort_order)
  values (
    '10000000-0000-4000-8000-000000000052',
    site,
    '10000000-0000-4000-8000-000000000051',
    'Intro',
    0
  );

  insert into public.elements (
    id, site_id, page_id, section_id, type, name, content, sort_order
  )
  values (
    '10000000-0000-4000-8000-000000000053',
    site,
    '10000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000052',
    'text',
    'Intro',
    '{"text":"Hello"}'::jsonb,
    0
  );

  insert into public.element_layouts (
    id, element_id, breakpoint, col_start, col_span, row_start, row_span
  )
  values (
    '10000000-0000-4000-8000-000000000054',
    '10000000-0000-4000-8000-000000000053',
    'desktop',
    1,
    12,
    1,
    4
  );

  insert into public.submissions (id, site_id, page_id, name, email, message)
  values (
    '10000000-0000-4000-8000-000000000055',
    site,
    '10000000-0000-4000-8000-000000000051',
    'Ada',
    'ada@example.com',
    'Hello'
  );

  insert into public.page_views_daily (site_id, day, views)
  values (site, current_date, 3);

  insert into public.domains (id, site_id, hostname, status)
  values (
    '10000000-0000-4000-8000-000000000056',
    site,
    'publisher.example.com',
    'pending'
  );

  delete from auth.users
  where id = owner;

  if exists (select 1 from public.profiles where id = owner)
    or exists (select 1 from public.sites where id = site)
    or exists (select 1 from public.site_publishes where id = publish)
    or exists (select 1 from public.assets where id = asset)
    or exists (select 1 from public.pages where site_id = site)
    or exists (select 1 from public.sections where site_id = site)
    or exists (select 1 from public.elements where site_id = site)
    or exists (
      select 1
      from public.element_layouts
      where id = '10000000-0000-4000-8000-000000000054'
    )
    or exists (select 1 from public.submissions where site_id = site)
    or exists (select 1 from public.page_views_daily where site_id = site)
    or exists (select 1 from public.domains where site_id = site)
  then
    raise exception 'account deletion left rows behind';
  end if;
end
$$;

\echo ok: account deletion cascades

do $$
declare
  publisher uuid := '10000000-0000-4000-8000-000000000004';
  publish uuid := '10000000-0000-4000-8000-000000000033';
begin
  insert into auth.users (id, email)
  values (publisher, 'guest-publisher@example.com');

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (
    publish,
    '10000000-0000-4000-8000-000000000012',
    '{"version":1}'::jsonb,
    publisher
  );

  delete from auth.users
  where id = publisher;

  if not exists (
    select 1
    from public.site_publishes
    where id = publish
      and published_by is null
  ) then
    raise exception 'cross-owner publish was not kept with a null publisher';
  end if;
end
$$;

\echo ok: cross-owner publisher set null

do $$
declare
  allowed text;
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_mime_allowed'
  ) or exists (
    select 1
    from pg_constraint
    where conname = 'assets_mime_present'
  ) then
    raise exception 'mime allow-list constraint is missing';
  end if;

  foreach allowed in array array['image/webp', 'image/avif', 'image/jpeg', 'image/png']
  loop
    insert into public.assets (site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-000000000012',
      'held-address/' || allowed,
      allowed,
      64
    );
  end loop;

  begin
    insert into public.assets (site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-000000000012',
      'held-address/no.gif',
      'image/gif',
      1
    );
    raise exception 'image/gif was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.assets (site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-000000000012',
      'held-address/no.html',
      'text/html',
      1
    );
    raise exception 'text/html was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: asset mime allow-list

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_bytes_range'
  ) or exists (
    select 1
    from pg_constraint
    where conname = 'assets_bytes_positive'
  ) then
    raise exception 'byte range constraint is missing';
  end if;

  insert into public.assets (site_id, path, mime, bytes)
  values (
    '10000000-0000-4000-8000-000000000012',
    'held-address/max.png',
    'image/png',
    8388608
  );

  begin
    insert into public.assets (site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-000000000012',
      'held-address/over.png',
      'image/png',
      8388609
    );
    raise exception '8388609 bytes was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

\echo ok: asset 8 MiB cap

-- 02b tables, indexes, and functions ---------------------------------------

do $$
declare
  missing text;
  rel_count integer;
begin
  select string_agg(name, ', ' order by name)
  into missing
  from (
    select unnest(array[
      'pages',
      'sections',
      'elements',
      'element_layouts',
      'submissions',
      'page_views_daily',
      'rate_limits',
      'domains'
    ]) as name
    except
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ) as gone;

  if missing is not null then
    raise exception 'missing tables: %', missing;
  end if;

  select count(*)
  into rel_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'pages',
      'sections',
      'elements',
      'element_layouts',
      'submissions',
      'page_views_daily',
      'rate_limits',
      'domains'
    )
    and c.relrowsecurity
    and not c.relforcerowsecurity;

  if rel_count <> 8 then
    raise exception 'expected 8 RLS tables, found %', rel_count;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'pages',
        'sections',
        'elements',
        'element_layouts',
        'submissions',
        'page_views_daily',
        'rate_limits',
        'domains'
      )
  ) then
    raise exception '02b tables have policies';
  end if;

  select string_agg(name, ', ' order by name)
  into missing
  from (
    select unnest(array[
      'pages_title_length',
      'pages_slug_format',
      'pages_site_slug_key',
      'elements_type_allowed',
      'element_layouts_breakpoint',
      'element_layouts_col_start',
      'element_layouts_col_span',
      'element_layouts_row_start',
      'element_layouts_row_span',
      'element_layouts_columns_fit',
      'element_layouts_placement_source',
      'element_layouts_element_breakpoint_key',
      'submissions_name_length',
      'submissions_email_length',
      'submissions_message_length',
      'domains_status',
      'domains_hostname_lowercase',
      'domains_alias_lowercase',
      'domains_site_id_key',
      'domains_hostname_key',
      'domains_alias_hostname_key'
    ]) as name
    except
    select c.conname
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
  ) as gone;

  if missing is not null then
    raise exception 'missing constraints: %', missing;
  end if;

  select string_agg(name, ', ' order by name)
  into missing
  from (
    select unnest(array[
      'sites_owner_active_updated_idx',
      'sites_owner_deleted_idx',
      'sites_purge_after_idx',
      'pages_site_sort_idx',
      'one_home_per_site',
      'sections_page_sort_idx',
      'elements_page_sort_idx',
      'elements_site_id_idx',
      'element_layouts_element_id_idx',
      'submissions_site_created_idx',
      'submissions_site_unread_idx',
      'site_publishes_site_created_idx',
      'domains_pending_idx'
    ]) as name
    except
    select indexname
    from pg_indexes
    where schemaname = 'public'
  ) as gone;

  if missing is not null then
    raise exception 'missing indexes: %', missing;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'assets_site_id_idx'
  ) then
    raise exception 'duplicate assets site index';
  end if;

  select string_agg(name, ', ' order by name)
  into missing
  from (
    select unnest(array[
      'is_site_owner',
      'is_site_public',
      'increment_page_views',
      'resolve_host',
      'rate_limit_hit',
      'restore_site',
      'save_draft',
      'assets_same_site'
    ]) as name
    except
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ) as gone;

  if missing is not null then
    raise exception 'missing functions: %', missing;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname in (
        'is_site_owner',
        'is_site_public',
        'increment_page_views',
        'resolve_host',
        'rate_limit_hit',
        'restore_site',
        'assets_same_site'
      )
      and (
        not p.prosecdef
        or r.rolname <> 'postgres'
        or not ('search_path=public' = any (p.proconfig))
      )
  ) then
    raise exception 'security definer function is not owned by postgres';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_draft'
      and p.prosecdef
  ) then
    raise exception 'save_draft must run as the invoker';
  end if;

  if (
    select count(*)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and t.tgname = 'assets_same_site'
      and not t.tgisinternal
      and c.relname in ('sites', 'elements', 'assets')
  ) <> 3 then
    raise exception 'assets_same_site trigger is not attached';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'submissions'
      and column_name = 'honeypot'
  ) then
    raise exception 'submissions has a honeypot column';
  end if;
end
$$;

\echo ok: pages
\echo ok: sections
\echo ok: elements
\echo ok: element layouts
\echo ok: submissions
\echo ok: page views daily
\echo ok: rate limits
\echo ok: domains
\echo ok: required indexes

do $$
declare
  owner uuid := '10000000-0000-4000-8000-000000000005';
  rival uuid := '10000000-0000-4000-8000-000000000006';
  content_site uuid := '10000000-0000-4000-8000-000000000018';
  rival_site uuid := '10000000-0000-4000-8000-000000000019';
  public_site uuid := '10000000-0000-4000-8000-000000000020';
  home_page uuid := '10000000-0000-4000-8000-000000000060';
  about_page uuid := '10000000-0000-4000-8000-000000000061';
  contact_page uuid := '10000000-0000-4000-8000-000000000062';
  header_section uuid := '10000000-0000-4000-8000-000000000063';
  body_section uuid := '10000000-0000-4000-8000-000000000064';
  text_element uuid := '10000000-0000-4000-8000-000000000065';
  image_element uuid := '10000000-0000-4000-8000-000000000066';
  layout_id uuid := '10000000-0000-4000-8000-000000000067';
  own_asset uuid := '10000000-0000-4000-8000-000000000043';
  rival_asset uuid := '10000000-0000-4000-8000-000000000044';
  publish uuid := '10000000-0000-4000-8000-000000000034';
  domain uuid := '10000000-0000-4000-8000-000000000070';
  submission uuid := '10000000-0000-4000-8000-000000000071';
  found_id uuid;
  found_slug text;
  found_password boolean;
  found_gate integer;
  found_host text;
begin
  insert into auth.users (id, email)
  values
    (owner, 'content-owner@example.com'),
    (rival, 'rival-owner@example.com');

  insert into public.sites (id, owner_id, name, slug)
  values
    (content_site, owner, 'Content', 'content-address'),
    (rival_site, rival, 'Rival', 'rival-address'),
    (public_site, owner, 'Public', 'public-address');

  insert into public.pages (id, site_id, title, slug, sort_order, is_home)
  values (home_page, content_site, 'Home', '', 0, true);

  insert into public.pages (id, site_id, title, slug, sort_order, is_home)
  values (about_page, content_site, 'About', 'about', 1, false);

  begin
    insert into public.pages (site_id, title, slug, sort_order, is_home)
    values (content_site, 'Second', 'second', 2, true);
    raise exception 'second home was accepted';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.pages (site_id, title, slug, sort_order)
    values (content_site, repeat('a', 61), 'too-long', 3);
    raise exception 'long page title was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.pages (site_id, title, slug, sort_order)
    values (content_site, 'Bad', 'About', 3);
    raise exception 'uppercase page slug was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.pages (site_id, title, slug, sort_order)
    values (content_site, 'Again', 'about', 3);
    raise exception 'duplicate page slug was accepted';
  exception
    when unique_violation then
      null;
  end;

  insert into public.sections (id, site_id, page_id, name, sort_order)
  values
    (header_section, content_site, null, 'Header', 0),
    (body_section, content_site, about_page, 'Body', 0);

  insert into public.assets (id, site_id, path, mime, bytes)
  values
    (own_asset, content_site, 'content-address/photo.png', 'image/png', 128),
    (rival_asset, rival_site, 'rival-address/photo.png', 'image/png', 128);

  insert into public.elements (
    id, site_id, page_id, section_id, type, name, content, sort_order
  )
  values (
    text_element,
    content_site,
    about_page,
    body_section,
    'text',
    'Intro',
    '{"text":"Hello"}'::jsonb,
    0
  );

  insert into public.elements (
    id, site_id, page_id, section_id, type, name, content, sort_order
  )
  values (
    image_element,
    content_site,
    null,
    header_section,
    'image',
    'Mark',
    jsonb_build_object('assetId', own_asset, 'alt', 'Mark', 'aspectLocked', true),
    0
  );

  begin
    insert into public.elements (
      site_id, page_id, section_id, type, name, content, sort_order
    )
    values (
      content_site,
      about_page,
      body_section,
      'image',
      'Foreign',
      jsonb_build_object('assetId', rival_asset),
      1
    );
    raise exception 'foreign image asset was accepted';
  exception
    when sqlstate 'ST005' then
      null;
  end;

  begin
    insert into public.elements (
      site_id, section_id, type, name, content, sort_order
    )
    values (
      content_site,
      header_section,
      'image',
      'Broken',
      '{"assetId":"not-a-uuid"}'::jsonb,
      2
    );
    raise exception 'invalid image asset was accepted';
  exception
    when sqlstate 'ST005' then
      null;
  end;

  begin
    update public.sites
    set og_asset_id = rival_asset
    where id = content_site;
    raise exception 'foreign og asset was accepted';
  exception
    when sqlstate 'ST005' then
      null;
  end;

  update public.sites
  set og_asset_id = own_asset
  where id = content_site;

  begin
    update public.assets
    set site_id = rival_site
    where id = own_asset;
    raise exception 'moving a referenced asset was accepted';
  exception
    when sqlstate 'ST005' then
      null;
  end;

  insert into public.element_layouts (
    id, element_id, breakpoint, col_start, col_span, row_start, row_span
  )
  values (layout_id, text_element, 'desktop', 1, 12, 1, 4);

  begin
    insert into public.element_layouts (
      element_id, breakpoint, col_start, col_span, row_start, row_span
    )
    values (text_element, 'desktop', 1, 6, 2, 2);
    raise exception 'duplicate breakpoint was accepted';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.element_layouts (
      element_id, breakpoint, col_start, col_span, row_start, row_span
    )
    values (text_element, 'mobile', 11, 3, 1, 1);
    raise exception 'layout past column 12 was accepted';
  exception
    when check_violation then
      null;
  end;

  insert into public.pages (id, site_id, title, slug, sort_order)
  values (contact_page, content_site, 'Contact', 'contact', 2);

  insert into public.submissions (id, site_id, page_id, name, email, message)
  values (submission, content_site, contact_page, 'Ada', 'ada@example.com', 'Hello');

  begin
    insert into public.submissions (site_id, name, email, message)
    values (content_site, '', 'ada@example.com', 'Hello');
    raise exception 'empty submission name was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.submissions (site_id, name, email, message)
    values (content_site, 'Ada', repeat('a', 255), 'Hello');
    raise exception 'long submission email was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.submissions (site_id, name, email, message)
    values (content_site, 'Ada', 'ada@example.com', repeat('m', 5001));
    raise exception 'long submission message was accepted';
  exception
    when check_violation then
      null;
  end;

  delete from public.pages
  where id = contact_page;

  if exists (select 1 from public.pages where id = contact_page)
    or (
      select page_id
      from public.submissions
      where id = submission
    ) is not null
    or not exists (select 1 from public.sections where id = header_section)
  then
    raise exception 'page delete did not keep the submission and site-wide section';
  end if;

  begin
    insert into public.domains (site_id, hostname)
    values (public_site, 'House.example.com');
    raise exception 'uppercase hostname was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.domains (site_id, hostname, status)
    values (public_site, 'bad.example.com', 'live');
    raise exception 'unknown domain status was accepted';
  exception
    when check_violation then
      null;
  end;

  insert into public.domains (id, site_id, hostname, alias_hostname, status)
  values (
    domain,
    public_site,
    'house.example.com',
    'www.house.example.com',
    'pending'
  );

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (publish, public_site, '{"version":1}'::jsonb, owner);

  update public.sites
  set live_publish_id = publish
  where id = public_site;

  if public.is_site_public(public_site) is not true
    or public.is_site_public(content_site) is not false
  then
    raise exception 'is_site_public mismatch before a password';
  end if;

  select site_id, slug, password_enabled, gate_version, canonical_host
  into found_id, found_slug, found_password, found_gate, found_host
  from public.resolve_host('public-address');

  if found_id is distinct from public_site
    or found_slug is distinct from 'public-address'
    or found_password is distinct from false
    or found_gate is distinct from 1
    or found_host is not null
  then
    raise exception 'live slug did not resolve';
  end if;

  perform 1
  from public.resolve_host('house.example.com');

  if found then
    raise exception 'pending hostname resolved';
  end if;

  perform 1
  from public.resolve_host('content-address');

  if found then
    raise exception 'draft slug resolved';
  end if;

  update public.domains
  set status = 'connected'
  where id = domain;

  select canonical_host
  into found_host
  from public.resolve_host('WWW.house.example.com');

  if found_host is distinct from 'house.example.com' then
    raise exception 'alias did not resolve to the canonical host';
  end if;

  update public.sites
  set password_enabled = true, password_hash = 'hash-placeholder-not-a-password'
  where id = public_site;

  select password_enabled
  into found_password
  from public.resolve_host('public-address');

  if found_password is distinct from true
    or public.is_site_public(public_site) is not false
  then
    raise exception 'password gate was not visible';
  end if;

  perform set_config('request.jwt.claim.sub', owner::text, true);

  if public.is_site_owner(content_site) is not true
    or public.is_site_owner(rival_site) is not false
  then
    raise exception 'is_site_owner mismatch';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  perform public.increment_page_views(public_site, current_date);
  perform public.increment_page_views(public_site, current_date);

  if (
    select views
    from public.page_views_daily
    where site_id = public_site
      and day = current_date
  ) <> 2 then
    raise exception 'page views did not increment';
  end if;

  if public.rate_limit_hit('content-bucket', 3600, 2) is not true
    or public.rate_limit_hit('content-bucket', 3600, 2) is not true
    or public.rate_limit_hit('content-bucket', 3600, 2) is not false
    or public.rate_limit_hit('other-bucket', 3600, 2) is not true
  then
    raise exception 'rate limit hit mismatch';
  end if;

  if has_function_privilege('anon', 'public.resolve_host(text)', 'execute') is not true
    or has_function_privilege('anon', 'public.restore_site(uuid, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.restore_site(uuid, uuid)', 'execute')
    or has_function_privilege('anon', 'public.rate_limit_hit(text, integer, integer)', 'execute')
    or has_function_privilege('anon', 'public.increment_page_views(uuid, date)', 'execute')
    or has_function_privilege('service_role', 'public.restore_site(uuid, uuid)', 'execute') is not true
    or has_function_privilege('authenticated', 'public.save_draft(uuid, integer, jsonb)', 'execute') is not true
  then
    raise exception 'function privileges mismatch';
  end if;
end
$$;

\echo ok: is site owner
\echo ok: is site public
\echo ok: resolve host
\echo ok: increment page views
\echo ok: rate limit hit
\echo ok: assets same site

do $$
declare
  owner uuid := '10000000-0000-4000-8000-000000000005';
  keep_site uuid := '10000000-0000-4000-8000-000000000021';
  active_site uuid := '10000000-0000-4000-8000-000000000022';
  renamed_site uuid := '10000000-0000-4000-8000-000000000023';
  expired_site uuid := '10000000-0000-4000-8000-000000000024';
  long_active uuid := '10000000-0000-4000-8000-000000000025';
  long_deleted uuid := '10000000-0000-4000-8000-000000000026';
  long_slug text := 'a' || repeat('b', 38) || 'c';
  keep_publish uuid := '10000000-0000-4000-8000-000000000035';
  renamed_publish uuid := '10000000-0000-4000-8000-000000000036';
  restored_slug text;
  changed boolean;
  locked timestamptz;
begin
  if position(
    'set_config(''studiolo.restoring'', ''on'', true)'
    in (
      select p.prosrc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'restore_site'
    )
  ) = 0
  or exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'restore_site'
      and p.prosrc ilike '%set studiolo.restoring%'
  ) then
    raise exception 'restore_site does not use a transaction-local flag';
  end if;

  insert into public.sites (id, owner_id, name, slug, slug_locked_at)
  values (keep_site, owner, 'Keep', 'restore-keep', now());

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (keep_publish, keep_site, '{"version":1}'::jsonb, owner);

  update public.sites
  set
    live_publish_id = keep_publish,
    deleted_at = now(),
    purge_after = now() + interval '10 days'
  where id = keep_site;

  select slug, slug_changed
  into restored_slug, changed
  from public.restore_site(keep_site, owner);

  select slug_locked_at
  into locked
  from public.sites
  where id = keep_site;

  if restored_slug is distinct from 'restore-keep'
    or changed is distinct from false
    or exists (
      select 1
      from public.sites
      where id = keep_site
        and (
          deleted_at is not null
          or purge_after is not null
          or live_publish_id is not null
        )
    )
    or locked is null
  then
    raise exception 'restore did not return the original draft';
  end if;

  insert into public.sites (id, owner_id, name, slug)
  values (active_site, owner, 'Active', 'taken-restore');

  insert into public.sites (id, owner_id, name, slug, slug_locked_at, deleted_at, purge_after)
  values (
    renamed_site,
    owner,
    'Renamed',
    'taken-restore',
    now(),
    now(),
    now() + interval '10 days'
  );

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values (renamed_publish, renamed_site, '{"version":1}'::jsonb, owner);

  update public.sites
  set live_publish_id = renamed_publish
  where id = renamed_site;

  select slug, slug_changed
  into restored_slug, changed
  from public.restore_site(renamed_site, owner);

  if restored_slug is distinct from 'taken-restore-2'
    or changed is distinct from true
    or exists (
      select 1
      from public.sites
      where id = renamed_site
        and (
          slug_locked_at is not null
          or live_publish_id is not null
          or deleted_at is not null
        )
    )
  then
    raise exception 'restore did not rename the taken slug';
  end if;

  insert into public.sites (id, owner_id, name, slug)
  values (long_active, owner, 'Long', long_slug);

  insert into public.sites (id, owner_id, name, slug, deleted_at, purge_after)
  values (
    long_deleted,
    owner,
    'Long deleted',
    long_slug,
    now(),
    now() + interval '10 days'
  );

  select slug, slug_changed
  into restored_slug, changed
  from public.restore_site(long_deleted, owner);

  if changed is distinct from true
    or char_length(restored_slug) <> 40
    or restored_slug is distinct from left(long_slug, 38) || '-2'
  then
    raise exception 'restore did not trim the slug to 40 characters';
  end if;

  insert into public.sites (id, owner_id, name, slug, deleted_at, purge_after)
  values (
    expired_site,
    owner,
    'Expired',
    'expired-restore',
    now(),
    now() - interval '1 day'
  );

  begin
    perform public.restore_site(expired_site, owner);
    raise exception 'expired site was restored';
  exception
    when sqlstate 'ST404' then
      null;
  end;

  begin
    perform public.restore_site(keep_site, '10000000-0000-4000-8000-000000000006');
    raise exception 'other owner restored a site';
  exception
    when sqlstate 'ST404' then
      null;
  end;
end
$$;

\echo ok: restore site

do $$
begin
  if coalesce(current_setting('studiolo.restoring', true), '') = 'on' then
    raise exception 'restoring flag leaked past the transaction';
  end if;
end
$$;

\echo ok: restore flag is transaction-local

do $$
declare
  owner uuid := '10000000-0000-4000-8000-000000000005';
  content_site uuid := '10000000-0000-4000-8000-000000000018';
  rival_site uuid := '10000000-0000-4000-8000-000000000019';
  page_id uuid := '10000000-0000-4000-8000-000000000080';
  rival_page uuid := '10000000-0000-4000-8000-000000000081';
  section_id uuid := '10000000-0000-4000-8000-000000000082';
  element_id uuid := '10000000-0000-4000-8000-000000000083';
  layout_id uuid := '10000000-0000-4000-8000-000000000084';
  revision integer;
  payload jsonb;
begin
  payload := jsonb_build_object(
    'pages', jsonb_build_object(
      'upsert', jsonb_build_array(jsonb_build_object(
        'id', page_id,
        'title', 'Notes',
        'slug', 'notes',
        'sort_order', 4,
        'in_nav', true,
        'is_home', false
      ))
    ),
    'sections', jsonb_build_object(
      'upsert', jsonb_build_array(jsonb_build_object(
        'id', section_id,
        'page_id', page_id,
        'name', 'Body',
        'sort_order', 0
      ))
    ),
    'elements', jsonb_build_object(
      'upsert', jsonb_build_array(jsonb_build_object(
        'id', element_id,
        'page_id', page_id,
        'section_id', section_id,
        'type', 'text',
        'name', 'Body',
        'content', jsonb_build_object('text', 'Hello'),
        'sort_order', 0
      ))
    ),
    'element_layouts', jsonb_build_object(
      'upsert', jsonb_build_array(jsonb_build_object(
        'id', layout_id,
        'element_id', element_id,
        'breakpoint', 'mobile',
        'col_start', 1,
        'col_span', 6,
        'row_start', 1,
        'row_span', 2,
        'hidden', false,
        'placement_source', 'manual'
      ))
    )
  );

  revision := public.save_draft(content_site, 0, payload);

  if revision <> 1
    or not exists (
      select 1
      from public.pages
      where id = page_id
        and site_id = content_site
        and title = 'Notes'
    )
    or not exists (
      select 1
      from public.element_layouts
      where id = layout_id
        and placement_source = 'manual'
        and col_span = 6
    )
  then
    raise exception 'save_draft did not apply the first revision';
  end if;

  revision := public.save_draft(
    content_site,
    1,
    jsonb_build_object(
      'pages', jsonb_build_object(
        'upsert', jsonb_build_array(jsonb_build_object(
          'id', page_id,
          'title', 'Notes two',
          'slug', 'notes',
          'sort_order', 4,
          'in_nav', false,
          'is_home', false
        ))
      )
    )
  );

  if revision <> 2
    or not exists (
      select 1
      from public.pages
      where id = page_id
        and title = 'Notes two'
        and in_nav = false
    )
  then
    raise exception 'save_draft did not update the page';
  end if;

  revision := public.save_draft(
    content_site,
    2,
    jsonb_build_object(
      'pages', jsonb_build_object('delete', jsonb_build_array(page_id::text))
    )
  );

  if revision <> 3
    or exists (select 1 from public.pages where id = page_id)
    or exists (select 1 from public.sections where id = section_id)
    or exists (select 1 from public.elements where id = element_id)
    or exists (select 1 from public.element_layouts where id = layout_id)
  then
    raise exception 'save_draft did not delete the page';
  end if;

  revision := public.save_draft(content_site, 3, '{}'::jsonb);

  if revision <> 4 then
    raise exception 'empty changes did not advance the revision';
  end if;

  begin
    perform public.save_draft(content_site, 3, '{}'::jsonb);
    raise exception 'stale revision was accepted';
  exception
    when sqlstate 'ST409' then
      null;
  end;

  if (
    select draft_revision
    from public.sites
    where id = content_site
  ) <> 4 then
    raise exception 'stale save_draft changed the revision';
  end if;

  insert into public.pages (id, site_id, title, slug, sort_order)
  values (rival_page, rival_site, 'Theirs', 'theirs', 0);

  begin
    perform public.save_draft(
      content_site,
      4,
      jsonb_build_object(
        'pages', jsonb_build_object(
          'upsert', jsonb_build_array(jsonb_build_object(
            'id', rival_page,
            'title', 'Stolen',
            'slug', 'theirs',
            'sort_order', 0,
            'is_home', false
          ))
        )
      )
    );
    raise exception 'cross-site save_draft was accepted';
  exception
    when sqlstate 'ST007' then
      null;
  end;

  if exists (
    select 1
    from public.pages
    where id = rival_page
      and site_id = content_site
  ) or (
    select draft_revision
    from public.sites
    where id = content_site
  ) <> 4 then
    raise exception 'cross-site save_draft changed rows';
  end if;
end
$$;

\echo ok: save draft

delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
);

delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
