-- Local seed only. Every email is @example.com. Do not apply this to a hosted database.
-- npm run db:check does not load this file.

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'ada@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'noah@example.com')
on conflict (id) do nothing;

update public.profiles
set display_name = 'Ada Example'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set
  display_name = 'Noah Example',
  notification_email = 'notices@example.com'
where id = '22222222-2222-4222-8222-222222222222';

insert into public.sites (
  id,
  owner_id,
  name,
  slug,
  password_enabled,
  password_hash
)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Example House',
  'example-house',
  true,
  'hash-placeholder-not-a-password'
)
on conflict (id) do nothing;

insert into public.assets (
  id,
  site_id,
  path,
  width,
  height,
  mime,
  bytes,
  blur_data_url
)
values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'example-house/og.png',
  1200,
  630,
  'image/png',
  1024,
  'data:image/png;base64,aaaa'
)
on conflict (id) do nothing;

insert into public.site_publishes (id, site_id, snapshot, published_by)
values (
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  '{"version":1,"pages":[]}'::jsonb,
  '11111111-1111-4111-8111-111111111111'
)
on conflict (id) do nothing;

update public.sites
set
  live_publish_id = '55555555-5555-4555-8555-555555555555',
  og_asset_id = '44444444-4444-4444-8444-444444444444',
  first_published_at = now(),
  last_published_at = now(),
  slug_locked_at = now()
where id = '33333333-3333-4333-8333-333333333333';

insert into public.sites (
  id,
  owner_id,
  name,
  slug,
  deleted_at,
  purge_after
)
values (
  '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222',
  'Old Example',
  'old-example',
  now(),
  now() + interval '30 days'
)
on conflict (id) do nothing;
