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

  delete from auth.users
  where id = owner;

  if exists (select 1 from public.profiles where id = owner)
    or exists (select 1 from public.sites where id = site)
    or exists (select 1 from public.site_publishes where id = publish)
    or exists (select 1 from public.assets where id = asset)
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

delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
