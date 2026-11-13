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
    '{"text":"Interiors and renovation for period homes."}'::jsonb,
    0
  ),
  (
    '5a000000-0000-4000-8000-000000000043',
    '5a000000-0000-4000-8000-000000000011',
    '5a000000-0000-4000-8000-000000000024',
    '5a000000-0000-4000-8000-000000000033',
    'form',
    'Contact form',
    '{}'::jsonb,
    0
  )
on conflict (id) do nothing;

insert into public.element_layouts (
  id, element_id, breakpoint, col_start, col_span, row_start, row_span, placement_source
)
values
  ('5a000000-0000-4000-8000-000000000051', '5a000000-0000-4000-8000-000000000041', 'desktop', 1, 12, 1, 6, 'manual'),
  ('5a000000-0000-4000-8000-000000000052', '5a000000-0000-4000-8000-000000000041', 'mobile', 1, 12, 1, 6, 'auto'),
  ('5a000000-0000-4000-8000-000000000053', '5a000000-0000-4000-8000-000000000042', 'desktop', 2, 7, 1, 12, 'manual'),
  ('5a000000-0000-4000-8000-000000000054', '5a000000-0000-4000-8000-000000000042', 'mobile', 1, 12, 1, 16, 'auto'),
  ('5a000000-0000-4000-8000-000000000055', '5a000000-0000-4000-8000-000000000043', 'desktop', 2, 6, 1, 30, 'manual'),
  ('5a000000-0000-4000-8000-000000000056', '5a000000-0000-4000-8000-000000000043', 'mobile', 1, 12, 1, 40, 'auto')
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

commit;
