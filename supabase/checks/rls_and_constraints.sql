-- Runs against a freshly migrated local database.
-- psql -v ON_ERROR_STOP=1 -f supabase/checks/rls_and_constraints.sql
-- Each successful section prints an ok: line. A failed assertion aborts the script.

-- Remove every fixture this script creates, so it can run twice in a row and
-- after supabase/seed.sql. Every fixture user id starts with 10000000-,
-- 20000000- or c2000000-; their sites and site rows go with them (cascade).
-- The seeded account (5a000000-…) is left alone.
delete from auth.users
where id::text ~ '^(10000000|20000000|c2000000)-0000-4000-8000-';
delete from storage.objects where name like 'c2000000-%';
delete from public.rate_limits
where bucket like 'form:c2000000-%'
  or bucket in ('content-bucket', 'other-bucket');

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

do $$
declare
  bad text;
begin
  foreach bad in array array[
    '   ',
    E'\t',
    E' \t\n ',
    repeat('n', 81),
    ' ' || repeat('n', 81) || ' ',
    repeat(' ', 500) || 'a',
    repeat('n', 80) || ' '
  ] loop
    begin
      update public.profiles set display_name = bad
      where id = '10000000-0000-4000-8000-000000000001';
      raise exception 'display_name % was accepted', quote_literal(bad);
    exception
      when check_violation then
        null;
    end;
  end loop;
  update public.profiles set display_name = repeat('n', 80)
  where id = '10000000-0000-4000-8000-000000000001';
  update public.profiles set display_name = ' ' || repeat('n', 79)
  where id = '10000000-0000-4000-8000-000000000001';
  update public.profiles set display_name = 'Sam Carter'
  where id = '10000000-0000-4000-8000-000000000001';
  update public.profiles set display_name = ''
  where id = '10000000-0000-4000-8000-000000000001';
end
$$;

\echo ok: display_name is empty or at most 80 characters with a non-space character
\echo ok: tab-only and over-80 padded display names rejected

do $$
declare
  bad text;
begin
  foreach bad in array array[
    'not-an-email',
    'a@b',
    'two@@example.com',
    'sp ace@example.com',
    '',
    repeat('a', 243) || '@example.com'
  ] loop
    begin
      update public.profiles set notification_email = bad
      where id = '10000000-0000-4000-8000-000000000001';
      raise exception 'notification_email % was accepted', quote_literal(bad);
    exception
      when check_violation then
        null;
    end;
  end loop;
  update public.profiles set notification_email = repeat('a', 242) || '@example.com'
  where id = '10000000-0000-4000-8000-000000000001';
  update public.profiles set notification_email = 'studio@example.com'
  where id = '10000000-0000-4000-8000-000000000001';
  update public.profiles set notification_email = null
  where id = '10000000-0000-4000-8000-000000000001';
end
$$;

\echo ok: notification_email is null or a 254-character address

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
    insert into public.assets (id, site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-0000000a0001',
      '10000000-0000-4000-8000-000000000014',
      '10000000-0000-4000-8000-000000000014/draft/10000000-0000-4000-8000-0000000a0001.png',
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
    '10000000-0000-4000-8000-000000000014/draft/10000000-0000-4000-8000-000000000041.png',
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
  values (asset, site, site::text || '/draft/' || asset::text || '.png', 'image/png', 128);

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
    insert into public.assets (id, site_id, path, mime, bytes)
    select
      n.id,
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000012/draft/' || n.id::text || '.' || split_part(allowed, '/', 2),
      allowed,
      64
    from (select gen_random_uuid() as id) n;
  end loop;

  begin
    insert into public.assets (id, site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-0000000a0002',
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000012/draft/10000000-0000-4000-8000-0000000a0002.png',
      'image/gif',
      1
    );
    raise exception 'image/gif was accepted';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.assets (id, site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-0000000a0003',
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000012/draft/10000000-0000-4000-8000-0000000a0003.png',
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

  insert into public.assets (id, site_id, path, mime, bytes)
  values (
    '10000000-0000-4000-8000-0000000a0004',
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000012/draft/10000000-0000-4000-8000-0000000a0004.png',
    'image/png',
    8388608
  );

  begin
    insert into public.assets (id, site_id, path, mime, bytes)
    values (
      '10000000-0000-4000-8000-0000000a0005',
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000012/draft/10000000-0000-4000-8000-0000000a0005.png',
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

  -- 02c: the 02b tables carry exactly their owner policies (asserted in full
  -- in the 02c policy block below). rate_limits has none.
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limits'
  ) then
    raise exception 'rate_limits has a policy';
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

  -- pages_site_slug_key is deferred; check it at statement end here.
  set constraints public.pages_site_slug_key immediate;
  begin
    insert into public.pages (site_id, title, slug, sort_order)
    values (content_site, 'Again', 'about', 3);
    raise exception 'duplicate page slug was accepted';
  exception
    when unique_violation then
      null;
  end;
  set constraints public.pages_site_slug_key deferred;

  insert into public.sections (id, site_id, page_id, name, sort_order)
  values
    (header_section, content_site, null, 'Header', 0),
    (body_section, content_site, about_page, 'Body', 0);

  insert into public.assets (id, site_id, path, mime, bytes)
  values
    (own_asset, content_site, content_site::text || '/draft/' || own_asset::text || '.png', 'image/png', 128),
    (rival_asset, rival_site, rival_site::text || '/draft/' || rival_asset::text || '.png', 'image/png', 128);

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

-- 02b-fix: cross-site integrity, hostname namespace, page swaps, restore flag,
-- cascade indexes. Two fresh owners; removed again at the end.
insert into auth.users (id, email)
values
  ('20000000-0000-4000-8000-000000000001', 'fix-owner@example.com'),
  ('20000000-0000-4000-8000-000000000002', 'fix-rival@example.com');

insert into public.sites (id, owner_id, name, slug)
values
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'Fix A', 'fix-site-a'),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', 'Fix B', 'fix-site-b'),
  ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', 'Fix C', 'fix-site-c');

insert into public.pages (id, site_id, title, slug, sort_order, is_home)
values
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000011', 'Home', '', 0, true),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000011', 'About', 'about', 1, false),
  ('20000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000012', 'Home', '', 0, true);

insert into public.sections (id, site_id, page_id, name, sort_order)
values
  ('20000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000021', 'Body', 0),
  ('20000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000011', null, 'Header', 1),
  ('20000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000023', 'Body', 0);

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  site_b uuid := '20000000-0000-4000-8000-000000000012';
  page_b uuid := '20000000-0000-4000-8000-000000000023';
  before_count bigint;
  rev integer;
begin
  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.sections'::regclass
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (page_id, site_id) REFERENCES pages(id, site_id) ON DELETE CASCADE'
  ) <> 1 or (
    select count(*)
    from pg_constraint
    where conrelid in ('public.pages'::regclass, 'public.sections'::regclass)
      and pg_get_constraintdef(oid) = 'UNIQUE (id, site_id)'
  ) <> 2 then
    raise exception 'sections composite page fk or unique (id, site_id) missing';
  end if;

  select count(*) into before_count from public.sections;

  begin
    insert into public.sections (site_id, page_id, name, sort_order)
    values (site_a, page_b, 'Stray', 9);
    raise exception 'section on another site''s page was accepted';
  exception
    when foreign_key_violation then
      null;
  end;

  select draft_revision into rev from public.sites where id = site_a;

  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'sections', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
        'id', '20000000-0000-4000-8000-000000000039',
        'page_id', page_b,
        'name', 'Stray',
        'sort_order', 9
      )))
    ));
    raise exception 'save_draft put a section on another site''s page';
  exception
    when sqlstate 'ST007' then
      null;
  end;

  if (select count(*) from public.sections) <> before_count
    or (select draft_revision from public.sites where id = site_a) <> rev
  then
    raise exception 'cross-site section changed rows';
  end if;
end
$$;

\echo 'ok: section cannot use another site''s page'

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  page_a uuid := '20000000-0000-4000-8000-000000000021';
  page_b uuid := '20000000-0000-4000-8000-000000000023';
  section_a uuid := '20000000-0000-4000-8000-000000000031';
  section_b uuid := '20000000-0000-4000-8000-000000000033';
  before_count bigint;
  rev integer;
begin
  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.elements'::regclass
      and pg_get_constraintdef(oid) in (
        'FOREIGN KEY (section_id, site_id) REFERENCES sections(id, site_id) ON DELETE CASCADE',
        'FOREIGN KEY (page_id, site_id) REFERENCES pages(id, site_id) ON DELETE CASCADE'
      )
  ) <> 2 then
    raise exception 'elements composite fks missing';
  end if;

  select count(*) into before_count from public.elements;

  -- section_id: another site's section.
  begin
    insert into public.elements (site_id, page_id, section_id, type, name, content, sort_order)
    values (site_a, page_b, section_b, 'text', 'Stray', '{}'::jsonb, 0);
    raise exception 'element in another site''s section was accepted';
  exception
    when foreign_key_violation then
      null;
  end;

  -- page_id: another site's page. The page-match trigger rejects it first;
  -- with the trigger off, the composite fk is the backstop.
  begin
    insert into public.elements (site_id, page_id, section_id, type, name, content, sort_order)
    values (site_a, page_b, section_a, 'text', 'Stray', '{}'::jsonb, 0);
    raise exception 'element on another site''s page was accepted';
  exception
    when sqlstate 'ST008' then
      null;
  end;

  begin
    alter table public.elements disable trigger elements_page_matches_section;
    insert into public.elements (site_id, page_id, section_id, type, name, content, sort_order)
    values (site_a, page_b, section_a, 'text', 'Stray', '{}'::jsonb, 0);
    raise exception 'element page fk did not reject another site''s page';
  exception
    when foreign_key_violation then
      null;
  end;

  if exists (
    select 1
    from pg_trigger
    where tgname = 'elements_page_matches_section'
      and tgenabled = 'D'
  ) then
    raise exception 'page-match trigger left disabled';
  end if;

  select draft_revision into rev from public.sites where id = site_a;

  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'elements', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
        'id', '20000000-0000-4000-8000-000000000049',
        'section_id', section_b,
        'page_id', page_b,
        'type', 'text',
        'name', 'Stray',
        'content', '{}'::jsonb,
        'sort_order', 0
      )))
    ));
    raise exception 'save_draft put an element in another site''s section';
  exception
    when sqlstate 'ST007' then
      null;
  end;

  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'elements', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
        'id', '20000000-0000-4000-8000-000000000049',
        'section_id', section_a,
        'page_id', page_b,
        'type', 'text',
        'name', 'Stray',
        'content', '{}'::jsonb,
        'sort_order', 0
      )))
    ));
    raise exception 'save_draft put an element on another site''s page';
  exception
    when sqlstate 'ST007' then
      null;
  end;

  if (select count(*) from public.elements) <> before_count
    or (select draft_revision from public.sites where id = site_a) <> rev
  then
    raise exception 'cross-site element changed rows';
  end if;
end
$$;

\echo 'ok: element cannot use another site''s section'

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  page_home uuid := '20000000-0000-4000-8000-000000000021';
  page_about uuid := '20000000-0000-4000-8000-000000000022';
  section_body uuid := '20000000-0000-4000-8000-000000000031';
  section_header uuid := '20000000-0000-4000-8000-000000000032';
  element_id uuid := '20000000-0000-4000-8000-000000000041';
  rev integer;
begin
  begin
    insert into public.elements (site_id, page_id, section_id, type, name, content, sort_order)
    values (site_a, page_about, section_body, 'text', 'Wrong page', '{}'::jsonb, 0);
    raise exception 'element on a different page from its section was accepted';
  exception
    when sqlstate 'ST008' then
      null;
  end;

  begin
    insert into public.elements (site_id, page_id, section_id, type, name, content, sort_order)
    values (site_a, page_home, section_header, 'text', 'Wrong page', '{}'::jsonb, 0);
    raise exception 'element with a page in a site-wide section was accepted';
  exception
    when sqlstate 'ST008' then
      null;
  end;

  insert into public.elements (id, site_id, page_id, section_id, type, name, content, sort_order)
  values (element_id, site_a, page_home, section_body, 'text', 'Body', '{}'::jsonb, 0);

  begin
    update public.elements set page_id = page_about where id = element_id;
    raise exception 'element page update away from its section was accepted';
  exception
    when sqlstate 'ST008' then
      null;
  end;

  select draft_revision into rev from public.sites where id = site_a;

  perform public.save_draft(site_a, rev, jsonb_build_object(
    'sections', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
      'id', section_body,
      'page_id', page_about,
      'name', 'Body',
      'sort_order', 0
    )))
  ));

  if (select page_id from public.elements where id = element_id) is distinct from page_about then
    raise exception 'moving a section did not move its elements';
  end if;
end
$$;

\echo ok: element page matches its section

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  new_page uuid := '20000000-0000-4000-8000-000000000051';
  new_section uuid := '20000000-0000-4000-8000-000000000052';
  new_element uuid := '20000000-0000-4000-8000-000000000053';
  new_layout uuid := '20000000-0000-4000-8000-000000000054';
  rev integer;
begin
  select draft_revision into rev from public.sites where id = site_a;

  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
      'id', new_page, 'title', 'Fresh', 'slug', 'fresh', 'sort_order', 5, 'is_home', false
    ))),
    'sections', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
      'id', new_section, 'page_id', new_page, 'name', 'Fresh', 'sort_order', 0
    ))),
    'elements', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
      'id', new_element, 'page_id', new_page, 'section_id', new_section,
      'type', 'text', 'name', 'Fresh', 'content', '{}'::jsonb, 'sort_order', 0
    ))),
    'element_layouts', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object(
      'id', new_layout, 'element_id', new_element, 'breakpoint', 'desktop',
      'col_start', 1, 'col_span', 12, 'row_start', 1, 'row_span', 1
    )))
  ));

  if not exists (
    select 1
    from public.element_layouts el
    join public.elements e on e.id = el.element_id
    join public.sections s on s.id = e.section_id
    join public.pages p on p.id = s.page_id
    where el.id = new_layout
      and p.id = new_page
      and e.page_id = new_page
      and p.site_id = site_a
      and s.site_id = site_a
      and e.site_id = site_a
  ) then
    raise exception 'save_draft did not create new parents and children together';
  end if;
end
$$;

\echo ok: save_draft accepts new parents in the same payload

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  site_b uuid := '20000000-0000-4000-8000-000000000012';
  site_c uuid := '20000000-0000-4000-8000-000000000013';
  owner uuid := '20000000-0000-4000-8000-000000000001';
  rival uuid := '20000000-0000-4000-8000-000000000002';
  publish_a uuid := '20000000-0000-4000-8000-000000000061';
  publish_b uuid := '20000000-0000-4000-8000-000000000062';
  found_id uuid;
begin
  insert into public.domains (site_id, hostname, alias_hostname, status)
  values (site_a, 'fix-a.example.com', 'www.fix-a.example.com', 'connected');

  begin
    insert into public.domains (site_id, hostname, alias_hostname, status)
    values (site_b, 'fix-b.example.com', 'fix-a.example.com', 'connected');
    raise exception 'alias equal to another hostname was accepted';
  exception
    when sqlstate 'ST009' then
      null;
  end;

  begin
    insert into public.domains (site_id, hostname, status)
    values (site_b, 'www.fix-a.example.com', 'connected');
    raise exception 'hostname equal to another alias was accepted';
  exception
    when sqlstate 'ST009' then
      null;
  end;

  begin
    insert into public.domains (site_id, hostname, alias_hostname)
    values (site_c, 'fix-c.example.com', 'fix-c.example.com');
    raise exception 'alias equal to its own hostname was accepted';
  exception
    when sqlstate 'ST009' then
      null;
  end;

  insert into public.domains (site_id, hostname, alias_hostname, status)
  values (site_b, 'fix-b.example.com', 'www.fix-b.example.com', 'connected');

  begin
    update public.domains
    set alias_hostname = 'fix-a.example.com'
    where site_id = site_b;
    raise exception 'alias update onto another hostname was accepted';
  exception
    when sqlstate 'ST009' then
      null;
  end;

  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values
    (publish_a, site_a, '{"version":1}'::jsonb, owner),
    (publish_b, site_b, '{"version":1}'::jsonb, rival);

  update public.sites set live_publish_id = publish_a where id = site_a;
  update public.sites set live_publish_id = publish_b where id = site_b;

  select r.site_id into found_id from public.resolve_host('fix-a.example.com') r;
  if found_id is distinct from site_a then
    raise exception 'resolve_host did not return the hostname owner';
  end if;

  select r.site_id into found_id from public.resolve_host('www.fix-a.example.com') r;
  if found_id is distinct from site_a then
    raise exception 'resolve_host did not return the alias owner';
  end if;

  if position('order by' in lower(pg_get_functiondef('public.resolve_host(text)'::regprocedure))) = 0 then
    raise exception 'resolve_host has no order by';
  end if;
end
$$;

\echo ok: hostname namespace is shared

do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  page_home uuid := '20000000-0000-4000-8000-000000000021';
  page_about uuid := '20000000-0000-4000-8000-000000000022';
  page_fresh uuid := '20000000-0000-4000-8000-000000000051';
  rev integer;
begin
  -- New home listed first.
  select draft_revision into rev from public.sites where id = site_a;
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'about', 'sort_order', 1, 'is_home', true),
      jsonb_build_object('id', page_home, 'title', 'Home', 'slug', '', 'sort_order', 0, 'is_home', false)
    ))
  ));
  if (select count(*) from public.pages where site_id = site_a and is_home) <> 1
    or not (select is_home from public.pages where id = page_about)
  then
    raise exception 'home swap with the new home first failed';
  end if;

  -- New home listed last.
  select draft_revision into rev from public.sites where id = site_a;
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'about', 'sort_order', 1, 'is_home', false),
      jsonb_build_object('id', page_home, 'title', 'Home', 'slug', '', 'sort_order', 0, 'is_home', true)
    ))
  ));
  if (select count(*) from public.pages where site_id = site_a and is_home) <> 1
    or not (select is_home from public.pages where id = page_home)
  then
    raise exception 'home swap with the new home last failed';
  end if;

  -- Slug swap, one order.
  select draft_revision into rev from public.sites where id = site_a;
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'fresh', 'sort_order', 1, 'is_home', false),
      jsonb_build_object('id', page_fresh, 'title', 'Fresh', 'slug', 'about', 'sort_order', 5, 'is_home', false)
    ))
  ));
  set constraints public.pages_site_slug_key immediate;
  set constraints public.pages_site_slug_key deferred;

  -- Slug swap back, the other order.
  select draft_revision into rev from public.sites where id = site_a;
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'about', 'sort_order', 1, 'is_home', false),
      jsonb_build_object('id', page_fresh, 'title', 'Fresh', 'slug', 'fresh', 'sort_order', 5, 'is_home', false)
    ))
  ));
  set constraints public.pages_site_slug_key immediate;
  set constraints public.pages_site_slug_key deferred;

  if (select slug from public.pages where id = page_about) <> 'about'
    or (select slug from public.pages where id = page_fresh) <> 'fresh'
    or (select count(*) from public.pages where site_id = site_a and is_home) <> 1
  then
    raise exception 'slug swap left the wrong slugs';
  end if;

  -- A save that leaves no home page is rejected.
  select draft_revision into rev from public.sites where id = site_a;
  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'pages', jsonb_build_object('upsert', jsonb_build_array(
        jsonb_build_object('id', page_home, 'title', 'Home', 'slug', '', 'sort_order', 0, 'is_home', false)
      ))
    ));
    raise exception 'save_draft left a site with no home page';
  exception
    when sqlstate 'ST010' then
      null;
  end;

  -- A duplicate slug that is not a swap still fails once checked.
  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'pages', jsonb_build_object('upsert', jsonb_build_array(
        jsonb_build_object('id', page_fresh, 'title', 'Fresh', 'slug', 'about', 'sort_order', 5, 'is_home', false)
      ))
    ));
    set constraints public.pages_site_slug_key immediate;
    raise exception 'duplicate page slug survived a save';
  exception
    when unique_violation then
      null;
  end;
  set constraints public.pages_site_slug_key deferred;
end
$$;

\echo ok: save_draft swaps home and slugs

-- 02c-fix: a payload that names only the new home moves the home; two homes
-- in one payload is ST010, never a raw 23505.
do $$
declare
  site_a uuid := '20000000-0000-4000-8000-000000000011';
  page_home uuid := '20000000-0000-4000-8000-000000000021';
  page_about uuid := '20000000-0000-4000-8000-000000000022';
  rev integer;
  rev_after integer;
begin
  if not (select is_home from public.pages where id = page_home) then
    raise exception 'fixture: Home is not the home page';
  end if;

  select draft_revision into rev from public.sites where id = site_a;
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'about', 'sort_order', 1, 'is_home', true)
    ))
  ));
  if (select count(*) from public.pages where site_id = site_a and is_home) <> 1
    or not (select is_home from public.pages where id = page_about)
    or (select is_home from public.pages where id = page_home)
  then
    raise exception 'home-only payload did not move the home page';
  end if;

  select draft_revision into rev from public.sites where id = site_a;
  begin
    perform public.save_draft(site_a, rev, jsonb_build_object(
      'pages', jsonb_build_object('upsert', jsonb_build_array(
        jsonb_build_object('id', page_about, 'title', 'About', 'slug', 'about', 'sort_order', 1, 'is_home', true),
        jsonb_build_object('id', page_home, 'title', 'Home', 'slug', '', 'sort_order', 0, 'is_home', true)
      ))
    ));
    raise exception 'two homes in one payload were accepted';
  exception
    when sqlstate 'ST010' then
      null;
  end;
  select draft_revision into rev_after from public.sites where id = site_a;
  if rev_after <> rev or not (select is_home from public.pages where id = page_about) then
    raise exception 'a rejected two-home save changed the draft';
  end if;

  -- Put Home back, again naming only the new home.
  perform public.save_draft(site_a, rev, jsonb_build_object(
    'pages', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', page_home, 'title', 'Home', 'slug', '', 'sort_order', 0, 'is_home', true)
    ))
  ));
  if not (select is_home from public.pages where id = page_home)
    or (select count(*) from public.pages where site_id = site_a and is_home) <> 1
  then
    raise exception 'home-only payload did not move the home back';
  end if;
end
$$;

\echo ok: save_draft moves the home from a payload naming only the new home
\echo ok: save_draft rejects two homes in one payload with ST010

do $$
declare
  owner uuid := '20000000-0000-4000-8000-000000000001';
  site_c uuid := '20000000-0000-4000-8000-000000000013';
  gone_site uuid := '20000000-0000-4000-8000-000000000014';
begin
  insert into public.sites (id, owner_id, name, slug, deleted_at, purge_after)
  values (gone_site, owner, 'Gone', 'fix-gone', now(), now() + interval '10 days');

  update public.sites set slug_locked_at = now() where id = site_c;

  perform public.restore_site(gone_site, owner);

  if current_setting('studiolo.restoring', true) is distinct from '' then
    raise exception 'restore flag still set after restore_site returned';
  end if;

  begin
    update public.sites set slug = 'fix-site-c-moved' where id = site_c;
    raise exception 'locked slug changed after restore_site in the same transaction';
  exception
    when sqlstate 'ST002' then
      null;
  end;
end
$$;

\echo ok: restore flag cleared on return

do $$
declare
  missing text;
begin
  select string_agg(name, ', ' order by name)
  into missing
  from (
    select unnest(array[
      'sections_site_id_idx',
      'elements_section_sort_idx',
      'submissions_page_id_idx',
      'element_layouts_element_id_idx'
    ]) as name
    except
    select indexname
    from pg_indexes
    where schemaname = 'public'
  ) as gone;

  if missing is not null then
    raise exception 'missing cascade fk indexes: %', missing;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where indexname = 'sections_site_id_idx'
      and indexdef like '%(site_id)'
  ) or not exists (
    select 1
    from pg_indexes
    where indexname = 'elements_section_sort_idx'
      and indexdef like '%(section_id, sort_order)'
  ) or not exists (
    select 1
    from pg_indexes
    where indexname = 'submissions_page_id_idx'
      and indexdef like '%(page_id) WHERE (page_id IS NOT NULL)'
  ) then
    raise exception 'cascade fk index has the wrong shape';
  end if;
end
$$;

\echo ok: cascade fk indexes

delete from auth.users
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002'
);

-- 02c: policies, grants, storage and per-role access ------------------------
-- Owner A and owner B each have a live site; A also has a soft-deleted site
-- and B a password-protected one. Every check below runs as a real API role.

create function pg_temp.expect_denied(q text)
returns void
language plpgsql
as $$
begin
  execute q;
  raise exception 'not denied: %', q;
exception
  when insufficient_privilege then
    null;
end
$$;

create function pg_temp.expect_state(q text, state text)
returns void
language plpgsql
as $$
declare
  got text;
begin
  begin
    execute q;
  exception
    when others then
      got := sqlstate;
  end;
  if got is distinct from state then
    raise exception 'expected % from %, got %', state, q, coalesce(got, 'success');
  end if;
end
$$;

create function pg_temp.affected(q text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end
$$;

create function pg_temp.counted(q text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute 'select count(*) from (' || q || ') as rows' into n;
  return n;
end
$$;

grant execute on function pg_temp.expect_denied(text) to anon, authenticated, service_role;
grant execute on function pg_temp.expect_state(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.affected(text) to anon, authenticated, service_role;
grant execute on function pg_temp.counted(text) to anon, authenticated, service_role;

insert into auth.users (id, email)
values
  ('c2000000-0000-4000-8000-000000000001', 'rls-a@example.com'),
  ('c2000000-0000-4000-8000-000000000002', 'rls-b@example.com');

insert into public.sites (id, owner_id, name, slug)
values
  ('c2000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000001', 'A live', 'rls-a-live'),
  ('c2000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000001', 'A gone', 'rls-a-gone'),
  ('c2000000-0000-4000-8000-000000000021', 'c2000000-0000-4000-8000-000000000002', 'B live', 'rls-b-live'),
  ('c2000000-0000-4000-8000-000000000022', 'c2000000-0000-4000-8000-000000000002', 'B draft', 'rls-b-draft');

insert into public.site_publishes (id, site_id, snapshot, published_by)
values
  ('c2000000-0000-4000-8000-000000000091', 'c2000000-0000-4000-8000-000000000011', '{"version":1}', 'c2000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000092', 'c2000000-0000-4000-8000-000000000012', '{"version":1}', 'c2000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000093', 'c2000000-0000-4000-8000-000000000021', '{"version":1}', 'c2000000-0000-4000-8000-000000000002');

update public.sites
set live_publish_id = 'c2000000-0000-4000-8000-000000000091', slug_locked_at = now()
where id = 'c2000000-0000-4000-8000-000000000011';

update public.sites
set
  live_publish_id = 'c2000000-0000-4000-8000-000000000093',
  slug_locked_at = now(),
  password_enabled = true,
  password_hash = 'b-hash-placeholder'
where id = 'c2000000-0000-4000-8000-000000000021';

insert into public.pages (id, site_id, title, slug, sort_order, is_home)
values
  ('c2000000-0000-4000-8000-000000000031', 'c2000000-0000-4000-8000-000000000011', 'Home', '', 0, true),
  ('c2000000-0000-4000-8000-000000000032', 'c2000000-0000-4000-8000-000000000012', 'Home', '', 0, true),
  ('c2000000-0000-4000-8000-000000000033', 'c2000000-0000-4000-8000-000000000021', 'Home', '', 0, true);

insert into public.sections (id, site_id, page_id, name, sort_order)
values
  ('c2000000-0000-4000-8000-000000000041', 'c2000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000031', 'Body', 0),
  ('c2000000-0000-4000-8000-000000000042', 'c2000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000032', 'Body', 0),
  ('c2000000-0000-4000-8000-000000000043', 'c2000000-0000-4000-8000-000000000021', 'c2000000-0000-4000-8000-000000000033', 'Body', 0);

insert into public.elements (id, site_id, page_id, section_id, type, name, content, sort_order)
values
  ('c2000000-0000-4000-8000-000000000051', 'c2000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000031', 'c2000000-0000-4000-8000-000000000041', 'text', 'Hi', '{}', 0),
  ('c2000000-0000-4000-8000-000000000052', 'c2000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000032', 'c2000000-0000-4000-8000-000000000042', 'text', 'Hi', '{}', 0),
  ('c2000000-0000-4000-8000-000000000053', 'c2000000-0000-4000-8000-000000000021', 'c2000000-0000-4000-8000-000000000033', 'c2000000-0000-4000-8000-000000000043', 'text', 'Hi', '{}', 0);

insert into public.element_layouts (id, element_id, breakpoint, col_start, col_span, row_start, row_span)
values
  ('c2000000-0000-4000-8000-000000000061', 'c2000000-0000-4000-8000-000000000051', 'desktop', 1, 6, 1, 2),
  ('c2000000-0000-4000-8000-000000000062', 'c2000000-0000-4000-8000-000000000052', 'desktop', 1, 6, 1, 2),
  ('c2000000-0000-4000-8000-000000000063', 'c2000000-0000-4000-8000-000000000053', 'desktop', 1, 6, 1, 2);

insert into public.submissions (id, site_id, page_id, name, email, message)
values
  ('c2000000-0000-4000-8000-000000000071', 'c2000000-0000-4000-8000-000000000011', null, 'Ann', 'ann@example.com', 'Hi'),
  ('c2000000-0000-4000-8000-000000000072', 'c2000000-0000-4000-8000-000000000011', null, 'Ben', 'ben@example.com', 'Hi'),
  ('c2000000-0000-4000-8000-000000000073', 'c2000000-0000-4000-8000-000000000012', null, 'Cat', 'cat@example.com', 'Hi'),
  ('c2000000-0000-4000-8000-000000000074', 'c2000000-0000-4000-8000-000000000021', null, 'Dan', 'dan@example.com', 'Hi');

insert into public.assets (id, site_id, path, mime, bytes)
values
  ('c2000000-0000-4000-8000-000000000081', 'c2000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000011/draft/c2000000-0000-4000-8000-000000000081.png', 'image/png', 10),
  ('c2000000-0000-4000-8000-000000000082', 'c2000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000012/draft/c2000000-0000-4000-8000-000000000082.png', 'image/png', 10),
  ('c2000000-0000-4000-8000-000000000083', 'c2000000-0000-4000-8000-000000000021', 'c2000000-0000-4000-8000-000000000021/draft/c2000000-0000-4000-8000-000000000083.png', 'image/png', 10);

insert into public.domains (site_id, hostname, status)
values
  ('c2000000-0000-4000-8000-000000000011', 'rls-a.example.com', 'connected'),
  ('c2000000-0000-4000-8000-000000000021', 'rls-b.example.com', 'connected');

insert into public.page_views_daily (site_id, day, views)
values
  ('c2000000-0000-4000-8000-000000000011', current_date, 5),
  ('c2000000-0000-4000-8000-000000000012', current_date, 6),
  ('c2000000-0000-4000-8000-000000000021', current_date, 7);

insert into storage.objects (bucket_id, name)
values
  ('site-assets', 'c2000000-0000-4000-8000-000000000011/draft/a.png'),
  ('site-assets', 'c2000000-0000-4000-8000-000000000011/published/c2000000-0000-4000-8000-000000000091/a.png'),
  ('site-assets', 'c2000000-0000-4000-8000-000000000012/draft/g.png'),
  ('site-assets', 'c2000000-0000-4000-8000-000000000021/draft/b.png'),
  ('site-assets', 'c2000000-0000-4000-8000-000000000021/published/c2000000-0000-4000-8000-000000000093/b.png');

-- soft-delete A's second site the way the server will.
update public.sites
set deleted_at = now(), purge_after = now() + interval '30 days', live_publish_id = null
where id = 'c2000000-0000-4000-8000-000000000012';

-- the exact policy set, RLS on everywhere, the private bucket ---------------

do $$
declare
  expected text[] := array[
    'public.assets|assets_owner_delete|DELETE|{authenticated}',
    'public.assets|assets_owner_select|SELECT|{authenticated}',
    'public.domains|domains_select_owner|SELECT|{authenticated}',
    'public.element_layouts|element_layouts_owner_all|ALL|{authenticated}',
    'public.elements|elements_owner_all|ALL|{authenticated}',
    'public.page_views_daily|page_views_daily_select_owner|SELECT|{authenticated}',
    'public.pages|pages_owner_all|ALL|{authenticated}',
    'public.profiles|profiles_select_own|SELECT|{authenticated}',
    'public.profiles|profiles_update_own|UPDATE|{authenticated}',
    'public.reserved_slugs|reserved_slugs_select|SELECT|{anon,authenticated}',
    'public.sections|sections_owner_all|ALL|{authenticated}',
    'public.site_publishes|site_publishes_select_owner|SELECT|{authenticated}',
    'public.sites|sites_insert_own|INSERT|{authenticated}',
    'public.sites|sites_select_own|SELECT|{authenticated}',
    'public.sites|sites_update_own|UPDATE|{authenticated}',
    'public.submissions|submissions_delete_owner|DELETE|{authenticated}',
    'public.submissions|submissions_select_owner|SELECT|{authenticated}',
    'public.submissions|submissions_update_owner|UPDATE|{authenticated}',
    'storage.objects|site_assets_owner_delete|DELETE|{authenticated}',
    'storage.objects|site_assets_owner_insert|INSERT|{authenticated}',
    'storage.objects|site_assets_owner_select|SELECT|{authenticated}',
    'storage.objects|site_assets_owner_update|UPDATE|{authenticated}'
  ];
  actual text[];
  rls_off text;
begin
  select array_agg(
    schemaname || '.' || tablename || '|' || policyname || '|' || cmd || '|'
      || (select array_agg(r order by r) from unnest(roles) as r)::text
    order by schemaname, tablename, policyname
  )
  into actual
  from pg_policies
  where schemaname in ('public', 'storage');

  if actual is distinct from expected then
    raise exception 'policy set mismatch: %', actual;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname in ('public', 'storage')
      and 'public' = any (roles)
  ) then
    raise exception 'a policy applies to public';
  end if;

  select string_agg(c.relname, ', ')
  into rls_off
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if rls_off is not null then
    raise exception 'RLS is off on: %', rls_off;
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'site-assets'
      and public = false
      and file_size_limit = 8388608
      and allowed_mime_types = array['image/webp', 'image/avif', 'image/jpeg', 'image/png']
  ) then
    raise exception 'site-assets bucket is missing or misconfigured';
  end if;
end
$$;

\echo ok: exact policy set and RLS on every table
\echo ok: site-assets bucket is private, 8 MB, images only

-- table and column privileges ------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'sites', 'site_publishes', 'assets', 'pages', 'sections',
    'elements', 'element_layouts', 'submissions', 'page_views_daily',
    'rate_limits', 'domains'
  ] loop
    if has_table_privilege('anon', 'public.' || t, 'select')
      or has_table_privilege('anon', 'public.' || t, 'insert')
      or has_table_privilege('anon', 'public.' || t, 'update')
      or has_table_privilege('anon', 'public.' || t, 'delete')
      or has_any_column_privilege('anon', 'public.' || t, 'select')
    then
      raise exception 'anon has a privilege on %', t;
    end if;
  end loop;

  if not has_table_privilege('anon', 'public.reserved_slugs', 'select')
    or has_table_privilege('anon', 'public.reserved_slugs', 'insert')
    or has_table_privilege('authenticated', 'public.reserved_slugs', 'insert')
    or has_table_privilege('authenticated', 'public.reserved_slugs', 'delete')
    or has_table_privilege('authenticated', 'public.rate_limits', 'select')
  then
    raise exception 'reserved_slugs or rate_limits privileges mismatch';
  end if;

  if has_column_privilege('authenticated', 'public.sites', 'password_hash', 'select')
    or not has_column_privilege('authenticated', 'public.sites', 'password_enabled', 'select')
    or has_table_privilege('authenticated', 'public.sites', 'delete')
  then
    raise exception 'sites column privileges mismatch';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'plan', 'update')
    or has_column_privilege('authenticated', 'public.profiles', 'trial_started_at', 'update')
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update')
  then
    raise exception 'profiles column privileges mismatch';
  end if;

  if has_column_privilege('authenticated', 'public.submissions', 'message', 'update')
    or not has_column_privilege('authenticated', 'public.submissions', 'read_at', 'update')
    or has_table_privilege('authenticated', 'public.submissions', 'insert')
    or has_table_privilege('authenticated', 'public.page_views_daily', 'insert')
    or has_table_privilege('authenticated', 'public.domains', 'insert')
    or has_table_privilege('authenticated', 'public.domains', 'update')
    or has_table_privilege('authenticated', 'public.site_publishes', 'insert')
    or has_table_privilege('authenticated', 'public.site_publishes', 'delete')
  then
    raise exception 'server-only writes are open to authenticated';
  end if;

  if has_function_privilege('authenticated', 'public.increment_page_views(uuid, date)', 'execute')
    or has_function_privilege('authenticated', 'public.rate_limit_hit(text, integer, integer)', 'execute')
    or has_function_privilege('authenticated', 'public.restore_site(uuid, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.is_site_restorable(uuid, uuid)', 'execute')
    or has_function_privilege('anon', 'public.save_draft(uuid, integer, jsonb)', 'execute')
    or has_function_privilege('anon', 'public.bump_draft_revision(uuid, integer)', 'execute')
    or has_function_privilege('anon', 'public.is_site_owner(uuid)', 'execute')
    or has_function_privilege('anon', 'public.storage_object_site_id(text)', 'execute')
  then
    raise exception 'function privileges mismatch';
  end if;
end
$$;

\echo ok: grants match the 02c table

-- owner A, signed in --------------------------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true) \g /dev/null

do $$
declare
  a_live constant text := '''c2000000-0000-4000-8000-000000000011''';
  a_gone constant text := '''c2000000-0000-4000-8000-000000000012''';
  b_live constant text := '''c2000000-0000-4000-8000-000000000021''';
  t text;
begin
  -- A sees both own sites, including the soft-deleted one, and none of B's.
  if pg_temp.counted('select id from public.sites') <> 2
    or pg_temp.counted('select id from public.sites where id = ' || a_gone) <> 1
    or pg_temp.counted('select id from public.sites where owner_id = ''c2000000-0000-4000-8000-000000000002''') <> 0
  then
    raise exception 'A sees the wrong sites';
  end if;

  -- Children: A's live site only. Not B's, not the deleted site's.
  foreach t in array array['pages', 'sections', 'elements', 'submissions', 'assets', 'domains', 'page_views_daily', 'site_publishes'] loop
    if pg_temp.counted('select 1 from public.' || t || ' where site_id = ' || a_live) < 1 then
      raise exception 'A cannot read own %', t;
    end if;
    if pg_temp.counted('select 1 from public.' || t || ' where site_id <> ' || a_live) <> 0 then
      raise exception 'A can read another or deleted site''s %', t;
    end if;
  end loop;

  if pg_temp.counted('select 1 from public.element_layouts') <> 1 then
    raise exception 'A sees the wrong element layouts';
  end if;

  if pg_temp.counted('select 1 from public.profiles') <> 1
    or public.is_site_owner('c2000000-0000-4000-8000-000000000012') is not false
    or public.is_site_owner('c2000000-0000-4000-8000-000000000011') is not true
    or public.is_site_owner('c2000000-0000-4000-8000-000000000021') is not false
  then
    raise exception 'A profile or is_site_owner mismatch';
  end if;

  -- password_hash is not readable, by name or by *.
  perform pg_temp.expect_denied('select password_hash from public.sites');
  perform pg_temp.expect_denied('select * from public.sites');

  -- profiles: own display name yes; plan and trial no; B's profile untouched.
  if pg_temp.affected('update public.profiles set display_name = ''A'' where id = ''c2000000-0000-4000-8000-000000000001''') <> 1
    or pg_temp.affected('update public.profiles set display_name = ''X'' where id = ''c2000000-0000-4000-8000-000000000002''') <> 0
  then
    raise exception 'profiles update scope mismatch';
  end if;
  perform pg_temp.expect_denied('update public.profiles set plan = ''pro''');
  perform pg_temp.expect_denied('update public.profiles set trial_started_at = now()');
  perform pg_temp.expect_denied('insert into public.profiles (id) values (gen_random_uuid())');
  perform pg_temp.expect_denied('delete from public.profiles');

  -- sites: owner columns on the live site; nothing on the deleted site or B's.
  if pg_temp.affected('update public.sites set name = ''A live 2'' where id = ' || a_live) <> 1
    or pg_temp.affected('update public.sites set name = ''Back'' where id = ' || a_gone) <> 0
    or pg_temp.affected('update public.sites set name = ''Mine'' where id = ' || b_live) <> 0
  then
    raise exception 'sites update scope mismatch';
  end if;
  foreach t in array array[
    'password_hash = ''x''', 'password_enabled = false', 'gate_version = 9',
    'live_publish_id = null', 'first_published_at = now()', 'last_published_at = now()',
    'slug_locked_at = null', 'deleted_at = null', 'purge_after = null',
    'draft_revision = 99', 'draft_updated_at = now()', 'owner_id = owner_id'
  ] loop
    perform pg_temp.expect_denied('update public.sites set ' || t || ' where id = ' || a_live);
  end loop;
  perform pg_temp.expect_denied('delete from public.sites where id = ' || a_live);
  perform pg_temp.expect_denied(
    'insert into public.sites (owner_id, name, slug, live_publish_id) values (''c2000000-0000-4000-8000-000000000001'', ''Hijack'', ''rls-hijack'', ''c2000000-0000-4000-8000-000000000093'')'
  );
  perform pg_temp.expect_denied(
    'insert into public.sites (owner_id, name, slug, password_enabled, password_hash) values (''c2000000-0000-4000-8000-000000000001'', ''Pw'', ''rls-pw'', true, ''x'')'
  );
  perform pg_temp.expect_denied(
    'insert into public.sites (owner_id, name, slug) values (''c2000000-0000-4000-8000-000000000002'', ''For B'', ''rls-for-b'')'
  );
  if pg_temp.affected(
    'insert into public.sites (id, owner_id, name, slug) values (''c2000000-0000-4000-8000-000000000013'', ''c2000000-0000-4000-8000-000000000001'', ''A new'', ''rls-a-new'')'
  ) <> 1 then
    raise exception 'owner could not create a site';
  end if;
  -- the locked slug stays locked for the owner.
  perform pg_temp.expect_state('update public.sites set slug = ''rls-a-moved'' where id = ' || a_live, 'ST002');

  -- children of B: no update, no delete, no insert.
  foreach t in array array['pages', 'sections', 'elements', 'assets', 'submissions'] loop
    if pg_temp.affected('delete from public.' || t || ' where site_id = ' || b_live) <> 0 then
      raise exception 'A deleted B''s %', t;
    end if;
  end loop;
  if pg_temp.affected('update public.pages set title = ''Mine'' where site_id = ' || b_live) <> 0
    or pg_temp.affected('update public.sections set name = ''Mine'' where site_id = ' || b_live) <> 0
    or pg_temp.affected('update public.elements set name = ''Mine'' where site_id = ' || b_live) <> 0
    or pg_temp.affected('update public.element_layouts set hidden = true where element_id = ''c2000000-0000-4000-8000-000000000053''') <> 0
    or pg_temp.affected('delete from public.element_layouts where element_id = ''c2000000-0000-4000-8000-000000000053''') <> 0
    or pg_temp.affected('update public.submissions set read_at = now() where site_id = ' || b_live) <> 0
  then
    raise exception 'A changed B''s rows';
  end if;
  perform pg_temp.expect_denied('insert into public.pages (site_id, title, slug, sort_order) values (' || b_live || ', ''X'', ''x'', 9)');
  perform pg_temp.expect_denied('insert into public.assets (site_id, path, mime, bytes) values (' || b_live || ', ''x/draft/x.png'', ''image/png'', 1)');
  perform pg_temp.expect_denied(
    'insert into public.element_layouts (element_id, breakpoint, col_start, col_span, row_start, row_span) values (''c2000000-0000-4000-8000-000000000053'', ''mobile'', 1, 1, 1, 1)'
  );
  -- moving A's own row onto B's site fails the with check.
  perform pg_temp.expect_denied('update public.assets set site_id = ' || b_live || ' where site_id = ' || a_live);
  -- children of A's deleted site are frozen too.
  if pg_temp.affected('update public.pages set title = ''Back'' where site_id = ' || a_gone) <> 0 then
    raise exception 'A changed a deleted site''s page';
  end if;
  perform pg_temp.expect_denied('insert into public.pages (site_id, title, slug, sort_order) values (' || a_gone || ', ''X'', ''x'', 9)');

  -- server-only tables and columns.
  perform pg_temp.expect_denied('update public.domains set status = ''pending''');
  perform pg_temp.expect_denied('delete from public.domains');
  perform pg_temp.expect_denied('insert into public.domains (site_id, hostname) values (' || a_live || ', ''x.example.com'')');
  perform pg_temp.expect_denied('update public.page_views_daily set views = 0');
  perform pg_temp.expect_denied('insert into public.page_views_daily (site_id, day, views) values (' || a_live || ', current_date - 1, 1)');
  perform pg_temp.expect_denied('insert into public.submissions (site_id, name, email, message) values (' || a_live || ', ''n'', ''n@example.com'', ''m'')');
  perform pg_temp.expect_denied('update public.submissions set message = ''edited'' where site_id = ' || a_live);
  perform pg_temp.expect_denied('insert into public.site_publishes (site_id, snapshot) values (' || a_live || ', ''{}'')');
  perform pg_temp.expect_denied('update public.site_publishes set snapshot = ''{}''');
  perform pg_temp.expect_denied('delete from public.site_publishes');
  perform pg_temp.expect_denied('select * from public.rate_limits');
  perform pg_temp.expect_denied('insert into public.reserved_slugs (slug) values (''mine'')');
  perform pg_temp.expect_denied('select public.increment_page_views(' || a_live || ', current_date)');
  perform pg_temp.expect_denied('select public.rate_limit_hit(''x'', 60, 5)');
  perform pg_temp.expect_denied('select public.restore_site(' || a_gone || ', ''c2000000-0000-4000-8000-000000000001'')');
  perform pg_temp.expect_denied(
    'select public.is_site_restorable(' || a_gone || ', ''c2000000-0000-4000-8000-000000000001'')'
  );

  -- submissions: own read_at and delete.
  if pg_temp.affected('update public.submissions set read_at = now() where id = ''c2000000-0000-4000-8000-000000000071''') <> 1
    or pg_temp.affected('delete from public.submissions where id = ''c2000000-0000-4000-8000-000000000072''') <> 1
    or pg_temp.affected('delete from public.submissions where id = ''c2000000-0000-4000-8000-000000000073''') <> 0
  then
    raise exception 'submissions owner scope mismatch';
  end if;

  if pg_temp.counted('select 1 from public.reserved_slugs') < 1 then
    raise exception 'authenticated cannot read reserved slugs';
  end if;
end
$$;

commit;

\echo ok: owner reads own rows, including soft-deleted sites, and nothing else
\echo ok: owner cannot update a soft-deleted site or read its children
\echo 'ok: user A cannot select, update or delete user B''s rows'
\echo ok: authenticated cannot read password_hash or update plan
\echo ok: server-only columns, tables and functions are closed to authenticated

-- save_draft and storage as owner A -----------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true) \g /dev/null

do $$
declare
  rev integer;
  b_rev integer;
begin
  select draft_revision into rev from public.sites where id = 'c2000000-0000-4000-8000-000000000011';

  if public.save_draft(
    'c2000000-0000-4000-8000-000000000011',
    rev,
    '{"pages":{"upsert":[{"id":"c2000000-0000-4000-8000-0000000000a1","title":"About","slug":"about","sort_order":1}]}}'
  ) <> rev + 1 then
    raise exception 'owner save_draft did not advance the revision';
  end if;

  perform pg_temp.expect_state(
    'select public.save_draft(''c2000000-0000-4000-8000-000000000021'', 0, ''{}'')',
    'ST409'
  );
  perform pg_temp.expect_state(
    'select public.save_draft(''c2000000-0000-4000-8000-000000000012'', 0, ''{}'')',
    'ST409'
  );
  perform pg_temp.expect_state(
    'select public.save_draft(''c2000000-0000-4000-8000-000000000011'', ' || (rev + 1)
      || ', ''{"sections":{"upsert":[{"id":"c2000000-0000-4000-8000-0000000000a2","page_id":"c2000000-0000-4000-8000-000000000033","name":"x","sort_order":0}]}}'')',
    'ST007'
  );
  -- reusing B's page id is refused with ST007 even though RLS hides B's row.
  perform pg_temp.expect_state(
    'select public.save_draft(''c2000000-0000-4000-8000-000000000011'', ' || (rev + 1)
      || ', ''{"pages":{"upsert":[{"id":"c2000000-0000-4000-8000-000000000033","title":"Stolen","slug":"stolen","sort_order":5}]}}'')',
    'ST007'
  );
  perform pg_temp.expect_state(
    'select public.save_draft(''c2000000-0000-4000-8000-000000000011'', ' || (rev + 1)
      || ', ''{"element_layouts":{"upsert":[{"id":"c2000000-0000-4000-8000-000000000063","element_id":"c2000000-0000-4000-8000-000000000051","breakpoint":"mobile","col_start":1,"col_span":1,"row_start":1,"row_span":1}]}}'')',
    'ST007'
  );

  if public.bump_draft_revision('c2000000-0000-4000-8000-000000000021', 0) is not null
    or public.bump_draft_revision('c2000000-0000-4000-8000-000000000012', 0) is not null
  then
    raise exception 'bump_draft_revision touched a site A does not own';
  end if;

  -- storage: own objects only, never B's, never the deleted site's.
  if pg_temp.counted('select 1 from storage.objects') <> 2 then
    raise exception 'A sees the wrong storage objects';
  end if;
  if pg_temp.affected(
    'insert into storage.objects (bucket_id, name) values (''site-assets'', ''c2000000-0000-4000-8000-000000000011/draft/new.png'')'
  ) <> 1 then
    raise exception 'owner could not upload';
  end if;
  perform pg_temp.expect_denied(
    'insert into storage.objects (bucket_id, name) values (''site-assets'', ''c2000000-0000-4000-8000-000000000021/draft/evil.png'')'
  );
  perform pg_temp.expect_denied(
    'insert into storage.objects (bucket_id, name) values (''site-assets'', ''c2000000-0000-4000-8000-000000000012/draft/evil.png'')'
  );
  perform pg_temp.expect_denied(
    'insert into storage.objects (bucket_id, name) values (''site-assets'', ''not-a-uuid/draft/evil.png'')'
  );
  perform pg_temp.expect_denied(
    'insert into storage.objects (bucket_id, name) values (''other-bucket'', ''c2000000-0000-4000-8000-000000000011/draft/x.png'')'
  );
  if pg_temp.affected('delete from storage.objects where name like ''c2000000-0000-4000-8000-000000000021/%''') <> 0
    or pg_temp.affected('update storage.objects set name = name where name like ''c2000000-0000-4000-8000-000000000021/%''') <> 0
  then
    raise exception 'A changed B''s storage objects';
  end if;
  perform pg_temp.expect_denied(
    'update storage.objects set name = ''c2000000-0000-4000-8000-000000000021/draft/moved.png'' where name = ''c2000000-0000-4000-8000-000000000011/draft/new.png'''
  );
  if pg_temp.affected('delete from storage.objects where name = ''c2000000-0000-4000-8000-000000000011/draft/new.png''') <> 1 then
    raise exception 'owner could not delete own object';
  end if;
end
$$;

commit;

\echo ok: save_draft runs as the owner and is refused on other or deleted sites
\echo ok: owner storage access is limited to their own live sites

-- anon ------------------------------------------------------------------------

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true) \g /dev/null

do $$
declare
  t text;
  found_id uuid;
begin
  foreach t in array array[
    'profiles', 'sites', 'site_publishes', 'assets', 'pages', 'sections',
    'elements', 'element_layouts', 'submissions', 'page_views_daily',
    'rate_limits', 'domains'
  ] loop
    perform pg_temp.expect_denied('select 1 from public.' || t);
  end loop;

  if pg_temp.counted('select 1 from public.reserved_slugs') < 1 then
    raise exception 'anon cannot read reserved slugs';
  end if;

  perform pg_temp.expect_denied(
    'insert into public.submissions (site_id, name, email, message) values (''c2000000-0000-4000-8000-000000000011'', ''n'', ''n@example.com'', ''m'')'
  );
  perform pg_temp.expect_denied(
    'insert into public.page_views_daily (site_id, day, views) values (''c2000000-0000-4000-8000-000000000011'', current_date - 2, 1)'
  );
  perform pg_temp.expect_denied('select public.increment_page_views(''c2000000-0000-4000-8000-000000000011'', current_date)');
  perform pg_temp.expect_denied('select public.rate_limit_hit(''form:x'', 60, 5)');
  perform pg_temp.expect_denied('select public.restore_site(''c2000000-0000-4000-8000-000000000012'', ''c2000000-0000-4000-8000-000000000001'')');
  perform pg_temp.expect_denied('select public.save_draft(''c2000000-0000-4000-8000-000000000011'', 0, ''{}'')');
  perform pg_temp.expect_denied('select public.bump_draft_revision(''c2000000-0000-4000-8000-000000000011'', 0)');
  perform pg_temp.expect_denied('select public.is_site_owner(''c2000000-0000-4000-8000-000000000011'')');
  perform pg_temp.expect_denied('select public.slug_is_free(''anything'', null)');

  -- storage: nothing readable, nothing writable, draft or published.
  if pg_temp.counted('select 1 from storage.objects') <> 0 then
    raise exception 'anon can read storage objects';
  end if;
  perform pg_temp.expect_denied(
    'insert into storage.objects (bucket_id, name) values (''site-assets'', ''c2000000-0000-4000-8000-000000000011/draft/anon.png'')'
  );
  if pg_temp.affected('delete from storage.objects') <> 0
    or pg_temp.affected('update storage.objects set name = name') <> 0
  then
    raise exception 'anon changed storage objects';
  end if;

  -- resolve_host: live public and live protected resolve; draft and deleted do not.
  select r.site_id into found_id from public.resolve_host('rls-a-live') r;
  if found_id is distinct from 'c2000000-0000-4000-8000-000000000011' then
    raise exception 'anon could not resolve a live site';
  end if;
  if (select r.password_enabled from public.resolve_host('rls-b.example.com') r) is not true then
    raise exception 'protected site did not report its gate';
  end if;
  if exists (select 1 from public.resolve_host('rls-b-draft'))
    or exists (select 1 from public.resolve_host('rls-a-gone'))
  then
    raise exception 'anon resolved a draft or deleted site';
  end if;
  if public.is_site_public('c2000000-0000-4000-8000-000000000011') is not true
    or public.is_site_public('c2000000-0000-4000-8000-000000000021') is not false
    or public.is_site_public('c2000000-0000-4000-8000-000000000022') is not false
    or public.is_site_public('c2000000-0000-4000-8000-000000000012') is not false
  then
    raise exception 'is_site_public mismatch for anon';
  end if;
end
$$;

commit;

\echo ok: anon cannot select any table except reserved_slugs
\echo ok: anon cannot insert submissions or page views
\echo ok: anon cannot read or write any storage object
\echo ok: anon resolves live sites only, never password_hash

-- service_role ----------------------------------------------------------------

begin;
set local role service_role;

do $$
begin
  if (select password_hash from public.sites where id = 'c2000000-0000-4000-8000-000000000021') is distinct from 'b-hash-placeholder' then
    raise exception 'service_role cannot read password_hash';
  end if;

  -- the form route: rate limit, then insert.
  if public.rate_limit_hit('form:c2000000-0000-4000-8000-000000000011', 3600, 1) is not true
    or public.rate_limit_hit('form:c2000000-0000-4000-8000-000000000011', 3600, 1) is not false
  then
    raise exception 'service_role rate limit mismatch';
  end if;
  insert into public.submissions (site_id, name, email, message)
  values ('c2000000-0000-4000-8000-000000000011', 'Eve', 'eve@example.com', 'Hello');
  perform public.increment_page_views('c2000000-0000-4000-8000-000000000011', current_date);

  perform pg_temp.expect_denied('update public.site_publishes set snapshot = ''{}''');
  perform pg_temp.expect_denied('insert into public.reserved_slugs (slug) values (''svc'')');

  if pg_temp.counted('select 1 from storage.objects where bucket_id = ''site-assets''') < 4 then
    raise exception 'service_role cannot read storage objects';
  end if;
end
$$;

commit;

\echo ok: service_role writes server-only rows and reads password_hash

-- restore_site with the north-light case --------------------------------------
-- Mirrors the spec's north-light example under an rls- prefix, so it does not
-- collide with the seeded North Light site (slug north-light).

do $$
declare
  owner uuid := 'c2000000-0000-4000-8000-000000000001';
  gone uuid := 'c2000000-0000-4000-8000-000000000014';
  expired uuid := 'c2000000-0000-4000-8000-000000000015';
  got_slug text;
  got_changed boolean;
begin
  insert into public.site_publishes (id, site_id, snapshot, published_by)
  values ('c2000000-0000-4000-8000-000000000094', 'c2000000-0000-4000-8000-000000000011', '{}', owner);

  insert into public.sites (id, owner_id, name, slug, slug_locked_at, deleted_at, purge_after)
  values (gone, owner, 'North Light', 'rls-north-light', now(), now() - interval '1 day', now() + interval '29 days');

  -- the owner has since used rls-north-light for a new site.
  insert into public.sites (owner_id, name, slug)
  values (owner, 'North Light again', 'rls-north-light');

  select r.slug, r.slug_changed into got_slug, got_changed
  from public.restore_site(gone, owner) r;

  if got_slug is distinct from 'rls-north-light-2'
    or got_changed is not true
    or exists (
      select 1 from public.sites
      where id = gone
        and (live_publish_id is not null or deleted_at is not null or slug_locked_at is not null)
    )
  then
    raise exception 'rls-north-light restore mismatch: %', got_slug;
  end if;

  insert into public.sites (id, owner_id, name, slug, deleted_at, purge_after)
  values (expired, owner, 'Expired', 'rls-expired', now() - interval '31 days', now() - interval '1 day');

  begin
    perform public.restore_site(expired, owner);
    raise exception 'expired site was restored';
  exception
    when sqlstate 'ST404' then
      null;
  end;
end
$$;

\echo ok: restore_site returns rls-north-light-2 as a draft and refuses an expired site

-- 02c-fix: an asset row's path is fixed by its own site and id. ------------

do $$
declare
  a_live uuid := 'c2000000-0000-4000-8000-000000000011';
  b_live uuid := 'c2000000-0000-4000-8000-000000000021';
  new_id uuid := 'c2000000-0000-4000-8000-0000000000a1';
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assets'::regclass and conname = 'assets_path_in_site'
  ) then
    raise exception 'assets_path_in_site is missing';
  end if;

  perform pg_temp.expect_state(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/png'', 1)',
    new_id, a_live, b_live::text || '/draft/' || new_id::text || '.png'
  ), '23514');
  perform pg_temp.expect_state(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/png'', 1)',
    new_id, a_live, a_live::text || '/draft/c2000000-0000-4000-8000-000000000081.png'
  ), '23514');
  perform pg_temp.expect_state(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/png'', 1)',
    new_id, a_live, a_live::text || '/draft/' || new_id::text || '.png/../x.png'
  ), '23514');
  perform pg_temp.expect_state(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/png'', 1)',
    new_id, a_live, a_live::text || '/published/' || new_id::text || '.png'
  ), '23514');
  perform pg_temp.expect_state(
    'update public.assets set site_id = ''' || b_live || ''' where id = ''c2000000-0000-4000-8000-000000000081''',
    '23514'
  );
  perform pg_temp.expect_state(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/webp'', 1)',
    new_id, a_live, a_live::text || '/draft/' || new_id::text || '.webp'
  ), null);
  delete from public.assets where id = new_id;
end
$$;

\echo 'ok: asset path must be the row''s own site draft path'

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true) \g /dev/null

do $$
declare
  a_live constant text := 'c2000000-0000-4000-8000-000000000011';
begin
  if has_table_privilege('authenticated', 'public.assets', 'insert')
    or has_table_privilege('authenticated', 'public.assets', 'update')
    or has_table_privilege('authenticated', 'public.assets', 'select') is not true
    or has_table_privilege('authenticated', 'public.assets', 'delete') is not true
  then
    raise exception 'authenticated has the wrong asset privileges';
  end if;
  perform pg_temp.expect_denied(format(
    'insert into public.assets (id, site_id, path, mime, bytes) values (%L, %L, %L, ''image/png'', 1)',
    'c2000000-0000-4000-8000-0000000000a2', a_live,
    a_live || '/draft/c2000000-0000-4000-8000-0000000000a2.png'
  ));
  perform pg_temp.expect_denied(
    'update public.assets set bytes = 1, mime = ''image/png'', width = 9 where site_id = ''' || a_live || ''''
  );
  if pg_temp.counted('select 1 from public.assets where site_id = ''' || a_live || '''') < 1 then
    raise exception 'owner cannot read own assets';
  end if;
  if pg_temp.affected('delete from public.assets where id = ''c2000000-0000-4000-8000-000000000081''') <> 1 then
    raise exception 'owner cannot delete own asset';
  end if;
end
$$;

rollback;

\echo ok: owners read and delete asset rows but cannot insert or update them

do $$
begin
  insert into public.element_layouts (element_id, breakpoint, col_start, col_span, row_start, row_span)
  values ('c2000000-0000-4000-8000-000000000051', 'mobile', 1, 13, 1, 1);
  raise exception 'col_span 13 was accepted';
exception
  when check_violation then
    null;
end
$$;

\echo ok: col_span 13 rejected

-- 04a: duplicate_site deep-copies a site in one transaction.
begin;

insert into auth.users (id, email)
values
  ('d4000000-0000-4000-8000-000000000001', 'dup-owner@example.com'),
  ('d4000000-0000-4000-8000-000000000002', 'dup-other@example.com');

insert into public.sites (id, owner_id, name, slug, seo_title, seo_description)
values
  ('d4000000-0000-4000-8000-000000000011', 'd4000000-0000-4000-8000-000000000001',
   'Dup Source', 'dup-src-a', 'Dup title', 'Dup description'),
  ('d4000000-0000-4000-8000-000000000012', 'd4000000-0000-4000-8000-000000000002',
   'Held', 'copy-of-dup-src-a', null, null);

-- Another owner's soft-deleted site holds "copy-of-dup-src-a".
update public.sites
set deleted_at = now(), purge_after = now() + interval '30 days'
where id = 'd4000000-0000-4000-8000-000000000012';

update public.sites
set template_id = 'still', template_version = 1
where id = 'd4000000-0000-4000-8000-000000000011';

insert into public.pages (id, site_id, title, slug, sort_order, in_nav, is_home)
values
  ('d4000000-0000-4000-8000-000000000021', 'd4000000-0000-4000-8000-000000000011', 'Home', 'home', 0, true, true),
  ('d4000000-0000-4000-8000-000000000022', 'd4000000-0000-4000-8000-000000000011', 'Contact', 'contact', 1, true, false);

insert into public.assets (id, site_id, path, width, height, mime, bytes)
values (
  'd4000000-0000-4000-8000-000000000031',
  'd4000000-0000-4000-8000-000000000011',
  'd4000000-0000-4000-8000-000000000011/draft/d4000000-0000-4000-8000-000000000031.webp',
  1600, 1200, 'image/webp', 2048
);

insert into public.sections (id, site_id, page_id, name, sort_order)
values
  ('d4000000-0000-4000-8000-000000000041', 'd4000000-0000-4000-8000-000000000011', null, 'Header', 0),
  ('d4000000-0000-4000-8000-000000000042', 'd4000000-0000-4000-8000-000000000011', 'd4000000-0000-4000-8000-000000000021', 'Intro', 1);

insert into public.elements (id, site_id, page_id, section_id, type, name, content, sort_order)
values
  ('d4000000-0000-4000-8000-000000000051', 'd4000000-0000-4000-8000-000000000011', null,
   'd4000000-0000-4000-8000-000000000041', 'text', 'Site name',
   '{"text":"Dup Source","link":{"kind":"page","value":"d4000000-0000-4000-8000-000000000022"}}', 0),
  ('d4000000-0000-4000-8000-000000000052', 'd4000000-0000-4000-8000-000000000011',
   'd4000000-0000-4000-8000-000000000021', 'd4000000-0000-4000-8000-000000000042', 'image', 'Hero image',
   '{"assetId":"d4000000-0000-4000-8000-000000000031","alt":"A room","aspectLocked":true}', 0);

insert into public.element_layouts (element_id, breakpoint, col_start, col_span, row_start, row_span, placement_source)
values
  ('d4000000-0000-4000-8000-000000000051', 'desktop', 1, 6, 1, 4, 'manual'),
  ('d4000000-0000-4000-8000-000000000051', 'mobile', 1, 12, 1, 4, 'auto'),
  ('d4000000-0000-4000-8000-000000000052', 'desktop', 7, 6, 1, 40, 'manual'),
  ('d4000000-0000-4000-8000-000000000052', 'mobile', 1, 12, 1, 40, 'manual');

insert into public.site_publishes (id, site_id, snapshot)
values ('d4000000-0000-4000-8000-000000000061', 'd4000000-0000-4000-8000-000000000011', '{}');

update public.sites
set
  og_asset_id = 'd4000000-0000-4000-8000-000000000031',
  favicon_asset_id = 'd4000000-0000-4000-8000-000000000031',
  live_publish_id = 'd4000000-0000-4000-8000-000000000061',
  slug_locked_at = now(),
  password_enabled = true,
  password_hash = 'not-a-hash'
where id = 'd4000000-0000-4000-8000-000000000011';

insert into public.domains (site_id, hostname, status)
values ('d4000000-0000-4000-8000-000000000011', 'dup.example.com', 'connected');

insert into public.submissions (site_id, name, email, message)
values ('d4000000-0000-4000-8000-000000000011', 'A', 'a@example.com', 'Hi');

do $$
declare
  copy record;
  again record;
  copy_home uuid;
  copy_contact uuid;
  copy_asset uuid;
begin
  select * into copy
  from public.duplicate_site(
    'd4000000-0000-4000-8000-000000000011',
    'd4000000-0000-4000-8000-000000000001'
  );

  if copy.name <> 'Copy of Dup Source' or copy.slug <> 'copy-of-dup-src-a-2' then
    raise exception 'duplicate name or slug mismatch: % %', copy.name, copy.slug;
  end if;

  if not exists (
    select 1 from public.sites
    where id = copy.id and template_id = 'still' and template_version = 1
  ) then
    raise exception 'duplicate did not copy template provenance';
  end if;

  if not exists (
    select 1 from public.sites
    where id = copy.id
      and owner_id = 'd4000000-0000-4000-8000-000000000001'
      and live_publish_id is null
      and slug_locked_at is null
      and first_published_at is null
      and password_enabled = false
      and password_hash is null
      and deleted_at is null
      and seo_title = 'Dup title'
      and seo_description = 'Dup description'
  ) then
    raise exception 'duplicate is not a fresh draft';
  end if;

  if exists (select 1 from public.domains where site_id = copy.id)
    or exists (select 1 from public.submissions where site_id = copy.id)
    or exists (select 1 from public.site_publishes where site_id = copy.id)
    or exists (select 1 from public.page_views_daily where site_id = copy.id)
  then
    raise exception 'duplicate copied a domain, submission, publish or views';
  end if;

  select id into copy_home from public.pages where site_id = copy.id and is_home;
  select id into copy_contact from public.pages where site_id = copy.id and slug = 'contact';
  select id into copy_asset from public.assets where site_id = copy.id;

  if copy_home is null or copy_contact is null or copy_asset is null
    or copy_home = 'd4000000-0000-4000-8000-000000000021'
    or copy_asset = 'd4000000-0000-4000-8000-000000000031'
    or (select count(*) from public.pages where site_id = copy.id) <> 2
    or (select count(*) from public.sections where site_id = copy.id) <> 2
    or (select count(*) from public.elements where site_id = copy.id) <> 2
    or (
      select count(*) from public.element_layouts l
      join public.elements e on e.id = l.element_id
      where e.site_id = copy.id
    ) <> 4
  then
    raise exception 'duplicate did not deep-copy with new ids';
  end if;

  if not exists (
    select 1 from public.sites
    where id = copy.id and og_asset_id = copy_asset and favicon_asset_id = copy_asset
  ) then
    raise exception 'duplicate did not remap og and favicon assets';
  end if;

  if (
    select content->>'assetId' from public.elements
    where site_id = copy.id and type = 'image'
  ) <> copy_asset::text then
    raise exception 'duplicate did not remap content.assetId';
  end if;

  if (
    select content->'link'->>'value' from public.elements
    where site_id = copy.id and type = 'text'
  ) <> copy_contact::text then
    raise exception 'duplicate did not remap a page link';
  end if;

  if not exists (
    select 1 from public.sections s
    join public.elements e on e.section_id = s.id
    where s.site_id = copy.id and s.page_id = copy_home and e.page_id = copy_home
  ) then
    raise exception 'duplicate did not remap section and element pages';
  end if;

  if not exists (
    select 1 from public.element_layouts l
    join public.elements e on e.id = l.element_id
    where e.site_id = copy.id and e.type = 'image'
      and l.breakpoint = 'mobile' and l.placement_source = 'manual'
      and l.row_span = 40
  ) then
    raise exception 'duplicate did not copy layouts';
  end if;

  if copy.asset_paths <> jsonb_build_array(jsonb_build_object(
    'from', 'd4000000-0000-4000-8000-000000000011/draft/d4000000-0000-4000-8000-000000000031.webp',
    'to', copy.id::text || '/draft/' || copy_asset::text || '.webp'
  )) then
    raise exception 'duplicate asset paths mismatch: %', copy.asset_paths;
  end if;

  select * into again
  from public.duplicate_site(
    'd4000000-0000-4000-8000-000000000011',
    'd4000000-0000-4000-8000-000000000001'
  );
  if again.slug <> 'copy-of-dup-src-a-3' then
    raise exception 'second duplicate slug mismatch: %', again.slug;
  end if;

  begin
    perform public.duplicate_site(
      'd4000000-0000-4000-8000-000000000011',
      'd4000000-0000-4000-8000-000000000002'
    );
    raise exception 'duplicate_site accepted another owner';
  exception
    when sqlstate 'ST404' then
      null;
  end;

  begin
    perform public.duplicate_site(
      'd4000000-0000-4000-8000-000000000012',
      'd4000000-0000-4000-8000-000000000002'
    );
    raise exception 'duplicate_site accepted a deleted site';
  exception
    when sqlstate 'ST404' then
      null;
  end;

  if has_function_privilege('anon', 'public.duplicate_site(uuid, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.duplicate_site(uuid, uuid)', 'execute')
    or has_function_privilege('service_role', 'public.duplicate_site(uuid, uuid)', 'execute') is not true
    or has_function_privilege('authenticated', 'public.duplicate_site_content(jsonb, jsonb, jsonb)', 'execute')
  then
    raise exception 'duplicate_site privileges mismatch';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname = 'duplicate_site'
      and p.prosecdef
      and r.rolname = 'postgres'
      and 'search_path=public, pg_temp' = any (p.proconfig)
  ) then
    raise exception 'duplicate_site is not a postgres-owned security definer';
  end if;
end
$$;

rollback;

\echo ok: duplicate_site deep-copies a site as a draft with remapped ids

-- 04a-fix: create_site writes the site and its starter content in one
-- transaction, as the signed-in user; first_free_slug suggests in one query.
begin;

insert into auth.users (id, email)
values
  ('e7000000-0000-4000-8000-000000000001', 'create-owner@example.com'),
  ('e7000000-0000-4000-8000-000000000002', 'create-other@example.com');

insert into public.sites (id, owner_id, name, slug)
values
  ('e7000000-0000-4000-8000-000000000012', 'e7000000-0000-4000-8000-000000000002', 'Taken', 'e7-taken'),
  ('e7000000-0000-4000-8000-000000000013', 'e7000000-0000-4000-8000-000000000002', 'Taken 2', 'e7-taken-2');

set local role service_role;

do $$
declare
  made uuid;
  owner constant uuid := 'e7000000-0000-4000-8000-000000000001';
  site constant uuid := 'e7000000-0000-4000-8000-000000000099';
  asset constant uuid := 'e7000000-0000-4000-8000-000000000041';
  home constant text := '{"pages":{"upsert":[{"id":"e7000000-0000-4000-8000-000000000021","title":"Home","slug":"","sort_order":0,"in_nav":true,"is_home":true}]}}';
  two_homes constant text := '{"pages":{"upsert":[{"id":"e7000000-0000-4000-8000-000000000031","title":"Home","slug":"","sort_order":0,"in_nav":true,"is_home":true},{"id":"e7000000-0000-4000-8000-000000000032","title":"Also home","slug":"also","sort_order":1,"in_nav":true,"is_home":true}]}}';
  good_asset constant text := '[{"id":"e7000000-0000-4000-8000-000000000041","path":"e7000000-0000-4000-8000-000000000099/draft/e7000000-0000-4000-8000-000000000041.webp","width":100,"height":80,"mime":"image/webp","bytes":1200}]';
  bad_asset constant text := '[{"id":"e7000000-0000-4000-8000-000000000042","path":"not/a/draft/path.webp","width":100,"height":80,"mime":"image/webp","bytes":1200}]';
  copy record;
begin
  made := public.create_site(
    owner, site, 'Made Here', 'e7-made-here', 'still', 1, good_asset::jsonb, home::jsonb
  );
  if made <> site
    or not exists (
      select 1 from public.sites
      where id = made
        and owner_id = owner
        and slug = 'e7-made-here'
        and template_id = 'still'
        and template_version = 1
        and draft_revision = 1
    )
    or (select count(*) from public.pages where site_id = made and is_home) <> 1
    or (select count(*) from public.assets where site_id = made and id = asset) <> 1
  then
    raise exception 'create_site did not create the site, assets and content together';
  end if;

  select * into copy from public.duplicate_site(made, owner);
  if not exists (
    select 1 from public.sites
    where id = copy.id and template_id = 'still' and template_version = 1
  ) then
    raise exception 'duplicate did not copy template provenance';
  end if;

  perform pg_temp.expect_state(
    format(
      'select public.create_site(%L, %L, %L, %L, %L, %s, %L::jsonb, %L::jsonb)',
      owner, 'e7000000-0000-4000-8000-000000000098', 'Broken', 'e7-broken', 'blank', 1, '[]', two_homes
    ),
    'ST010'
  );
  if exists (select 1 from public.sites where slug = 'e7-broken') then
    raise exception 'create_site left a site behind after a content failure';
  end if;

  perform pg_temp.expect_state(
    format(
      'select public.create_site(%L, %L, %L, %L, %L, %s, %L::jsonb, %L::jsonb)',
      owner, 'e7000000-0000-4000-8000-000000000097', 'Bad path', 'e7-bad-path', 'blank', 1, bad_asset, '{}'
    ),
    'ST011'
  );
  if exists (select 1 from public.sites where slug = 'e7-bad-path')
    or exists (select 1 from public.assets where id = 'e7000000-0000-4000-8000-000000000042')
  then
    raise exception 'create_site left rows behind after a bad asset path';
  end if;

  perform pg_temp.expect_state(
    format(
      'select public.create_site(%L, %L, %L, %L, %L, %s, %L::jsonb, %L::jsonb)',
      owner, 'e7000000-0000-4000-8000-000000000096', 'Again', 'e7-taken', 'blank', 1, '[]', '{}'
    ),
    '23505'
  );
  if exists (select 1 from public.sites where slug = 'e7-taken' and id = 'e7000000-0000-4000-8000-000000000096') then
    raise exception 'create_site left a site behind after a taken slug';
  end if;

  perform pg_temp.expect_state(
    format(
      'select public.create_site(%L, %L, %L, %L, %L, %s, %L::jsonb, %L::jsonb)',
      owner, 'e7000000-0000-4000-8000-000000000095', 'Reserved', 'admin', 'blank', 1, '[]', '{}'
    ),
    'ST003'
  );
  perform pg_temp.expect_state(
    format(
      'select public.create_site(%L, %L, %L, %L, %L, %s, %L::jsonb, %L::jsonb)',
      owner, 'e7000000-0000-4000-8000-000000000094', '', 'e7-no-name', 'blank', 1, '[]', '{}'
    ),
    '23514'
  );

  if public.first_free_slug('e7-taken', owner) <> 'e7-taken-3'
    or public.first_free_slug('e7-made-here', owner) <> 'e7-made-here-2'
    or public.first_free_slug(repeat('a', 40), owner) <> repeat('a', 38) || '-2'
  then
    raise exception 'first_free_slug suggestion mismatch';
  end if;
end
$$;

reset role;

do $$
begin
  if to_regprocedure('public.create_site(text, text, jsonb)') is not null
    or has_function_privilege('anon', 'public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.create_site(uuid, uuid, text, text, text, integer, jsonb, jsonb)', 'execute')
    or has_function_privilege('anon', 'public.first_free_slug(text, uuid)', 'execute')
    or exists (
      select 1 from pg_proc
      where proname = 'create_site' and prosecdef
    )
  then
    raise exception 'create_site or first_free_slug grants are wrong';
  end if;
end
$$;

rollback;

\echo ok: create_site creates the site and its content in one transaction
\echo ok: create_site leaves no site when the content fails
\echo ok: first_free_slug suggests the first free -n in one query

delete from auth.users
where id in (
  'c2000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000002'
);
delete from storage.objects where name like 'c2000000-%';
delete from public.rate_limits
where bucket like 'form:c2000000-%'
  or bucket in ('content-bucket', 'other-bucket');

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
