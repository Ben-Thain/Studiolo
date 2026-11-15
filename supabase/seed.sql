-- Local seed only. Fake data mirroring the sample screens: one user,
-- sam@example.com, with Riverton House (live, password on, custom domain),
-- North Light (live) and Mara Lind (draft). Every email is @example.com.
-- `supabase db reset` runs this locally; never apply it to a hosted database.

-- One transaction: if the guard fails, nothing below is applied, even when the
-- client keeps going after an error.
begin;

-- Guard: refuse to run where real accounts exist (any non-@example.com user).
do $$
begin
  if exists (
    select 1
    from auth.users
    where email is null
      or email not like '%@example.com'
  ) then
    raise exception 'seed.sql is local only: this database has real accounts';
  end if;
end
$$;

insert into auth.users (id, email)
values ('5a000000-0000-4000-8000-000000000001', 'sam@example.com')
on conflict (id) do nothing;

update public.profiles
set
  display_name = 'Sam Carter',
  notification_email = 'sam@example.com'
where id = '5a000000-0000-4000-8000-000000000001';

insert into public.sites (id, owner_id, name, slug, seo_title, seo_description)
values
  (
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000001',
    'Riverton House',
    'riverton-house',
    'Riverton House',
    'Interiors and renovation for period homes.'
  ),
  (
    '5a000000-0000-4000-8000-000000000012',
    '5a000000-0000-4000-8000-000000000001',
    'North Light',
    'north-light',
    null,
    null
  ),
  (
    '5a000000-0000-4000-8000-000000000013',
    '5a000000-0000-4000-8000-000000000001',
    'Mara Lind',
    'mara-lind',
    null,
    null
  )
on conflict (id) do nothing;

-- Riverton House pages: Home, Projects, Studio, Contact in the menu; Press not.
insert into public.pages (id, site_id, title, slug, sort_order, in_nav, is_home)
values
  ('5a000000-0000-4000-8000-000000000021', '5a000000-0000-4000-8000-000000000011', 'Home', '', 0, true, true),
  ('5a000000-0000-4000-8000-000000000022', '5a000000-0000-4000-8000-000000000011', 'Projects', 'projects', 1, true, false),
  ('5a000000-0000-4000-8000-000000000023', '5a000000-0000-4000-8000-000000000011', 'Studio', 'studio', 2, true, false),
  ('5a000000-0000-4000-8000-000000000024', '5a000000-0000-4000-8000-000000000011', 'Contact', 'contact', 3, true, false),
  ('5a000000-0000-4000-8000-000000000025', '5a000000-0000-4000-8000-000000000011', 'Press', 'press', 4, false, false),
  ('5a000000-0000-4000-8000-000000000026', '5a000000-0000-4000-8000-000000000012', 'Home', '', 0, true, true),
  ('5a000000-0000-4000-8000-000000000027', '5a000000-0000-4000-8000-000000000013', 'Home', '', 0, true, true)
on conflict (id) do nothing;

insert into public.sections (id, site_id, page_id, name, sort_order)
values
  ('5a000000-0000-4000-8000-000000000031', '5a000000-0000-4000-8000-000000000011', null, 'Header', 0),
  ('5a000000-0000-4000-8000-000000000032', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021', 'Intro', 1),
  ('5a000000-0000-4000-8000-000000000033', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000024', 'Form', 1)
on conflict (id) do nothing;

insert into public.elements (id, site_id, page_id, section_id, type, name, content, sort_order)
values
  (
    '5a000000-0000-4000-8000-000000000041',
    '5a000000-0000-4000-8000-000000000011',
    null,
    '5a000000-0000-4000-8000-000000000031',
    'nav',
    'Menu',
    '{}'::jsonb,
    0
  ),
  (
    '5a000000-0000-4000-8000-000000000042',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000021',
    '5a000000-0000-4000-8000-000000000032',
    'text',
    'Intro',
    '{"text":"A small studio in York restoring Georgian and Victorian homes since 2014.","fontFamily":"Inter","fontSize":18,"fontWeight":400,"align":"left"}'::jsonb,
    0
  ),
  (
    '5a000000-0000-4000-8000-000000000043',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    '5a000000-0000-4000-8000-000000000033',
    'form',
    'Contact form',
    '{"fields":["name","email","message"],"buttonLabel":"Send"}'::jsonb,
    0
  )
on conflict (id) do nothing;

insert into public.element_layouts (
  id, element_id, breakpoint, col_start, col_span, row_start, row_span, placement_source
)
values
  ('5a000000-0000-4000-8000-000000000051', '5a000000-0000-4000-8000-000000000041', 'desktop', 7, 6, 1, 4, 'manual'),
  ('5a000000-0000-4000-8000-000000000052', '5a000000-0000-4000-8000-000000000041', 'mobile', 1, 12, 8, 4, 'auto'),
  ('5a000000-0000-4000-8000-000000000053', '5a000000-0000-4000-8000-000000000042', 'desktop', 1, 6, 20, 6, 'manual'),
  ('5a000000-0000-4000-8000-000000000054', '5a000000-0000-4000-8000-000000000042', 'mobile', 1, 12, 16, 8, 'auto'),
  ('5a000000-0000-4000-8000-000000000055', '5a000000-0000-4000-8000-000000000043', 'desktop', 2, 6, 1, 30, 'manual'),
  ('5a000000-0000-4000-8000-000000000056', '5a000000-0000-4000-8000-000000000043', 'mobile', 1, 12, 1, 40, 'auto')
on conflict (id) do nothing;

-- Real starter-shaped content for every seeded site (prompt 04a): the
-- Riverton House header name, hero and Projects section, and North Light and Mara Lind with a
-- header, an intro and (North Light) a Contact page with a form.
insert into public.pages (id, site_id, title, slug, sort_order, in_nav, is_home)
values
  ('5a000000-0000-4000-8000-000000000028', '5a000000-0000-4000-8000-000000000012', 'Contact', 'contact', 1, true, false)
on conflict (id) do nothing;

insert into public.sections (id, site_id, page_id, name, sort_order)
values
  ('5a000000-0000-4000-8000-000000000034', '5a000000-0000-4000-8000-000000000012', null, 'Header', 0),
  ('5a000000-0000-4000-8000-000000000035', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000026', 'Intro', 1),
  ('5a000000-0000-4000-8000-000000000036', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000028', 'Contact', 1),
  ('5a000000-0000-4000-8000-000000000037', '5a000000-0000-4000-8000-000000000013', null, 'Header', 0),
  ('5a000000-0000-4000-8000-000000000038', '5a000000-0000-4000-8000-000000000013', '5a000000-0000-4000-8000-000000000027', 'Intro', 1),
  ('5a000000-0000-4000-8000-000000000039', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021', 'Projects', 2)
on conflict (id) do nothing;

insert into public.elements (id, site_id, page_id, section_id, type, name, content, sort_order)
values
  ('5a000000-0000-4000-8000-000000000101', '5a000000-0000-4000-8000-000000000011', null,
   '5a000000-0000-4000-8000-000000000031', 'text', 'Site name',
   '{"text":"Riverton House","fontFamily":"Inter","fontSize":16,"fontWeight":500,"align":"left"}', 1),
  ('5a000000-0000-4000-8000-000000000102', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000032', 'text', 'Heading',
   '{"text":"Interiors for old houses, done slowly.","fontFamily":"Inter","fontSize":48,"fontWeight":500,"align":"left"}', 1),
  ('5a000000-0000-4000-8000-000000000103', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000032', 'image', 'Hero image',
   '{"assetId":null,"alt":"Sitting room with oak panelling and a grey linen sofa","aspectLocked":true}', 2),
  ('5a000000-0000-4000-8000-000000000104', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'text', 'Projects heading',
   '{"text":"Selected projects","fontFamily":"Inter","fontSize":13,"fontWeight":400,"align":"left"}', 0),
  ('5a000000-0000-4000-8000-000000000105', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'image', 'Clifton, York',
   '{"assetId":null,"alt":"Kitchen with a long oak table under a skylight","aspectLocked":true}', 1),
  ('5a000000-0000-4000-8000-000000000106', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'image', 'Bootham Terrace',
   '{"assetId":null,"alt":"Living room with a leather sofa and a brick fireplace","aspectLocked":true}', 2),
  ('5a000000-0000-4000-8000-000000000107', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'image', 'Heworth Hall',
   '{"assetId":null,"alt":"Hallway with a yellow armchair and black panelling","aspectLocked":true}', 3),
  ('5a000000-0000-4000-8000-000000000108', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'text', 'Clifton caption',
   '{"text":"Clifton, York","fontFamily":"Inter","fontSize":13,"fontWeight":400,"align":"left"}', 4),
  ('5a000000-0000-4000-8000-000000000109', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'text', 'Bootham caption',
   '{"text":"Bootham Terrace","fontFamily":"Inter","fontSize":13,"fontWeight":400,"align":"left"}', 5),
  ('5a000000-0000-4000-8000-000000000110', '5a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000021',
   '5a000000-0000-4000-8000-000000000039', 'text', 'Heworth caption',
   '{"text":"Heworth Hall","fontFamily":"Inter","fontSize":13,"fontWeight":400,"align":"left"}', 6),
  ('5a000000-0000-4000-8000-000000000111', '5a000000-0000-4000-8000-000000000012', null,
   '5a000000-0000-4000-8000-000000000034', 'text', 'Site name',
   '{"text":"North Light","fontFamily":"Inter","fontSize":16,"fontWeight":500,"align":"left"}', 0),
  ('5a000000-0000-4000-8000-000000000112', '5a000000-0000-4000-8000-000000000012', null,
   '5a000000-0000-4000-8000-000000000034', 'nav', 'Menu', '{}', 1),
  ('5a000000-0000-4000-8000-000000000113', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000026',
   '5a000000-0000-4000-8000-000000000035', 'text', 'Heading',
   '{"text":"Portraits and weddings in natural light.","fontFamily":"Inter","fontSize":40,"fontWeight":500,"align":"left"}', 0),
  ('5a000000-0000-4000-8000-000000000114', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000026',
   '5a000000-0000-4000-8000-000000000035', 'text', 'Intro',
   '{"text":"A photographer in Leeds, working across Yorkshire since 2016.","fontFamily":"Inter","fontSize":18,"fontWeight":400,"align":"left","link":{"kind":"page","value":"5a000000-0000-4000-8000-000000000028"}}', 1),
  ('5a000000-0000-4000-8000-000000000115', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000026',
   '5a000000-0000-4000-8000-000000000035', 'image', 'Hero image',
   '{"assetId":null,"alt":"","aspectLocked":true}', 2),
  ('5a000000-0000-4000-8000-000000000116', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000028',
   '5a000000-0000-4000-8000-000000000036', 'text', 'Heading',
   '{"text":"Contact","fontFamily":"Inter","fontSize":40,"fontWeight":500,"align":"left"}', 0),
  ('5a000000-0000-4000-8000-000000000117', '5a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000028',
   '5a000000-0000-4000-8000-000000000036', 'form', 'Form',
   '{"fields":["name","email","message"],"buttonLabel":"Send"}', 1),
  ('5a000000-0000-4000-8000-000000000121', '5a000000-0000-4000-8000-000000000013', null,
   '5a000000-0000-4000-8000-000000000037', 'text', 'Site name',
   '{"text":"Mara Lind","fontFamily":"Inter","fontSize":16,"fontWeight":500,"align":"left"}', 0),
  ('5a000000-0000-4000-8000-000000000122', '5a000000-0000-4000-8000-000000000013', '5a000000-0000-4000-8000-000000000027',
   '5a000000-0000-4000-8000-000000000038', 'text', 'Heading',
   '{"text":"Ceramics, made slowly in Whitby.","fontFamily":"Inter","fontSize":40,"fontWeight":500,"align":"left"}', 0)
on conflict (id) do nothing;

insert into public.element_layouts (
  id, element_id, breakpoint, col_start, col_span, row_start, row_span, placement_source
)
values
  ('5a000000-0000-4000-8000-000000000201', '5a000000-0000-4000-8000-000000000101', 'desktop', 1, 6, 1, 4, 'manual'),
  ('5a000000-0000-4000-8000-000000000202', '5a000000-0000-4000-8000-000000000101', 'mobile', 1, 12, 1, 4, 'auto'),
  ('5a000000-0000-4000-8000-000000000203', '5a000000-0000-4000-8000-000000000102', 'desktop', 1, 6, 1, 18, 'manual'),
  ('5a000000-0000-4000-8000-000000000204', '5a000000-0000-4000-8000-000000000102', 'mobile', 1, 12, 1, 12, 'auto'),
  ('5a000000-0000-4000-8000-000000000205', '5a000000-0000-4000-8000-000000000103', 'desktop', 7, 6, 1, 40, 'manual'),
  ('5a000000-0000-4000-8000-000000000206', '5a000000-0000-4000-8000-000000000103', 'mobile', 1, 12, 27, 30, 'auto'),
  ('5a000000-0000-4000-8000-000000000211', '5a000000-0000-4000-8000-000000000111', 'desktop', 1, 6, 1, 4, 'manual'),
  ('5a000000-0000-4000-8000-000000000212', '5a000000-0000-4000-8000-000000000111', 'mobile', 1, 12, 1, 4, 'auto'),
  ('5a000000-0000-4000-8000-000000000213', '5a000000-0000-4000-8000-000000000112', 'desktop', 7, 6, 1, 4, 'manual'),
  ('5a000000-0000-4000-8000-000000000214', '5a000000-0000-4000-8000-000000000112', 'mobile', 1, 12, 8, 4, 'auto'),
  ('5a000000-0000-4000-8000-000000000215', '5a000000-0000-4000-8000-000000000113', 'desktop', 1, 6, 1, 12, 'manual'),
  ('5a000000-0000-4000-8000-000000000216', '5a000000-0000-4000-8000-000000000113', 'mobile', 1, 12, 1, 12, 'auto'),
  ('5a000000-0000-4000-8000-000000000217', '5a000000-0000-4000-8000-000000000114', 'desktop', 1, 6, 14, 6, 'manual'),
  ('5a000000-0000-4000-8000-000000000218', '5a000000-0000-4000-8000-000000000114', 'mobile', 1, 12, 16, 6, 'auto'),
  ('5a000000-0000-4000-8000-000000000219', '5a000000-0000-4000-8000-000000000115', 'desktop', 7, 6, 1, 40, 'manual'),
  ('5a000000-0000-4000-8000-000000000220', '5a000000-0000-4000-8000-000000000115', 'mobile', 1, 12, 25, 40, 'auto'),
  ('5a000000-0000-4000-8000-000000000221', '5a000000-0000-4000-8000-000000000116', 'desktop', 1, 6, 1, 8, 'manual'),
  ('5a000000-0000-4000-8000-000000000222', '5a000000-0000-4000-8000-000000000116', 'mobile', 1, 12, 1, 8, 'auto'),
  ('5a000000-0000-4000-8000-000000000223', '5a000000-0000-4000-8000-000000000117', 'desktop', 1, 6, 10, 40, 'manual'),
  ('5a000000-0000-4000-8000-000000000224', '5a000000-0000-4000-8000-000000000117', 'mobile', 1, 12, 11, 40, 'auto'),
  ('5a000000-0000-4000-8000-000000000225', '5a000000-0000-4000-8000-000000000121', 'desktop', 1, 6, 1, 4, 'manual'),
  ('5a000000-0000-4000-8000-000000000226', '5a000000-0000-4000-8000-000000000121', 'mobile', 1, 12, 1, 4, 'auto'),
  ('5a000000-0000-4000-8000-000000000227', '5a000000-0000-4000-8000-000000000122', 'desktop', 1, 7, 1, 12, 'manual'),
  ('5a000000-0000-4000-8000-000000000228', '5a000000-0000-4000-8000-000000000122', 'mobile', 1, 12, 1, 12, 'auto'),
  ('5a000000-0000-4000-8000-000000000229', '5a000000-0000-4000-8000-000000000104', 'desktop', 1, 12, 1, 3, 'manual'),
  ('5a000000-0000-4000-8000-000000000230', '5a000000-0000-4000-8000-000000000105', 'desktop', 1, 4, 5, 26, 'manual'),
  ('5a000000-0000-4000-8000-000000000231', '5a000000-0000-4000-8000-000000000106', 'desktop', 5, 4, 5, 26, 'manual'),
  ('5a000000-0000-4000-8000-000000000232', '5a000000-0000-4000-8000-000000000107', 'desktop', 9, 4, 5, 26, 'manual'),
  ('5a000000-0000-4000-8000-000000000233', '5a000000-0000-4000-8000-000000000108', 'desktop', 1, 4, 32, 3, 'manual'),
  ('5a000000-0000-4000-8000-000000000234', '5a000000-0000-4000-8000-000000000109', 'desktop', 5, 4, 32, 3, 'manual'),
  ('5a000000-0000-4000-8000-000000000235', '5a000000-0000-4000-8000-000000000110', 'desktop', 9, 4, 32, 3, 'manual'),
  ('5a000000-0000-4000-8000-000000000236', '5a000000-0000-4000-8000-000000000104', 'mobile', 1, 12, 1, 3, 'auto'),
  ('5a000000-0000-4000-8000-000000000237', '5a000000-0000-4000-8000-000000000105', 'mobile', 1, 12, 7, 30, 'auto'),
  ('5a000000-0000-4000-8000-000000000238', '5a000000-0000-4000-8000-000000000108', 'mobile', 1, 12, 40, 3, 'auto'),
  ('5a000000-0000-4000-8000-000000000239', '5a000000-0000-4000-8000-000000000106', 'mobile', 1, 12, 46, 30, 'auto'),
  ('5a000000-0000-4000-8000-000000000240', '5a000000-0000-4000-8000-000000000109', 'mobile', 1, 12, 79, 3, 'auto'),
  ('5a000000-0000-4000-8000-000000000241', '5a000000-0000-4000-8000-000000000107', 'mobile', 1, 12, 85, 30, 'auto'),
  ('5a000000-0000-4000-8000-000000000242', '5a000000-0000-4000-8000-000000000110', 'mobile', 1, 12, 118, 3, 'auto')
on conflict (id) do nothing;

-- Publish Riverton House and North Light. Mara Lind stays a draft.
insert into public.site_publishes (id, site_id, snapshot, published_by)
values
  ('5a000000-0000-4000-8000-000000000061', '5a000000-0000-4000-8000-000000000011', '{"version":1,"pages":[]}'::jsonb, '5a000000-0000-4000-8000-000000000001'),
  ('5a000000-0000-4000-8000-000000000062', '5a000000-0000-4000-8000-000000000012', '{"version":1,"pages":[]}'::jsonb, '5a000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

update public.sites
set
  live_publish_id = '5a000000-0000-4000-8000-000000000061',
  first_published_at = now() - interval '30 days',
  last_published_at = now() - interval '2 hours',
  slug_locked_at = now() - interval '30 days',
  -- Not a real hash, so no password can ever match it locally.
  password_enabled = true,
  password_hash = 'seed-placeholder-not-a-hash'
where id = '5a000000-0000-4000-8000-000000000011';

update public.sites
set
  live_publish_id = '5a000000-0000-4000-8000-000000000062',
  first_published_at = now() - interval '14 days',
  last_published_at = now() - interval '7 days',
  slug_locked_at = now() - interval '14 days'
where id = '5a000000-0000-4000-8000-000000000012';

insert into public.domains (id, site_id, hostname, alias_hostname, status, connected_at, verified_at)
values (
  '5a000000-0000-4000-8000-000000000071',
  '5a000000-0000-4000-8000-000000000011',
  'rivertonhouse.example.com',
  'www.rivertonhouse.example.com',
  'connected',
  now() - interval '20 days',
  now() - interval '20 days'
)
on conflict (id) do nothing;

insert into public.submissions (id, site_id, page_id, name, email, message, created_at, read_at)
values
  (
    '5a000000-0000-4000-8000-000000000081',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    'Hannah Price',
    'hannah.price@example.com',
    'We''ve just bought a Victorian terrace in Harrogate and would love help with the kitchen.',
    now() - interval '1 day',
    null
  ),
  (
    '5a000000-0000-4000-8000-000000000082',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    'Tom Aldridge',
    'tom.aldridge@example.com',
    'Are you taking on commercial work? We''re fitting out a small café in York next spring.',
    now() - interval '4 days',
    null
  ),
  (
    '5a000000-0000-4000-8000-000000000083',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    'Priya Shah',
    'priya.shah@example.com',
    'Could we book a call about a loft conversion? Our budget is around £40k.',
    now() - interval '9 days',
    now() - interval '8 days'
  ),
  (
    '5a000000-0000-4000-8000-000000000084',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    'Jonah Webb',
    'jonah.webb@example.com',
    'Loved the Clifton project. Do you source antique pieces for clients?',
    now() - interval '14 days',
    now() - interval '13 days'
  )
on conflict (id) do nothing;

-- A week of views for Riverton House, today last (still counting).
insert into public.page_views_daily (site_id, day, views)
select
  '5a000000-0000-4000-8000-000000000011',
  current_date - (6 - n),
  (array[48, 61, 55, 72, 39, 66, 12])[n + 1]
from generate_series(0, 6) as n
on conflict (site_id, day) do nothing;

insert into public.page_views_daily (site_id, day, views)
select
  '5a000000-0000-4000-8000-000000000012',
  current_date - (6 - n),
  (array[9, 14, 11, 8, 17, 12, 3])[n + 1]
from generate_series(0, 6) as n
on conflict (site_id, day) do nothing;

-- Home screens: Sam is two days into the 7-day trial (5 days left), and the
-- sites were last edited at different times, as in the sample screens.
-- Relative to now() so a fresh local reset always reads the same way.
update public.profiles
set trial_started_at = now() - interval '2 days'
where id = '5a000000-0000-4000-8000-000000000001';

-- Riverton House reads "Today, hh:mm": a few minutes ago, so it is past the
-- one-minute "Just now".
update public.sites
set draft_updated_at = now() - interval '5 minutes'
where id = '5a000000-0000-4000-8000-000000000011';

update public.sites
set draft_updated_at = now() - interval '9 days'
where id = '5a000000-0000-4000-8000-000000000012';

update public.sites
set draft_updated_at = now() - interval '13 days'
where id = '5a000000-0000-4000-8000-000000000013';

commit;
