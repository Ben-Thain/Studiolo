-- Studiolo 02a: extensions, tables, and indexes.
-- site_publishes and assets are created before the three sites foreign keys.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  notification_email text,
  trial_started_at timestamptz not null default now(),
  plan text not null default 'unlocked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.plan is
  'Dormant. No policy, view, or function may read this column.';

-- reserved addresses. Seeded here, not in seed.sql. ----------------------

create table public.reserved_slugs (
  slug text primary key
);

insert into public.reserved_slugs (slug)
values
  ('www'),
  ('app'),
  ('api'),
  ('admin'),
  ('s'),
  ('gate'),
  ('assets'),
  ('static'),
  ('cdn'),
  ('mail'),
  ('email'),
  ('support'),
  ('help'),
  ('login'),
  ('signup'),
  ('auth'),
  ('sites'),
  ('account'),
  ('plan'),
  ('dashboard'),
  ('editor'),
  ('preview'),
  ('settings'),
  ('studiolo'),
  ('studio'),
  ('vercel'),
  ('localhost'),
  ('status'),
  ('blog'),
  ('docs');

-- sites ---------------------------------------------------------------------
-- live_publish_id, og_asset_id, and favicon_asset_id are plain uuids until
-- site_publishes and assets exist. The foreign keys are added below.

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  slug_locked_at timestamptz,
  draft_revision integer not null default 0,
  draft_updated_at timestamptz not null default now(),
  live_publish_id uuid,
  first_published_at timestamptz,
  last_published_at timestamptz,
  password_enabled boolean not null default false,
  password_hash text,
  gate_version integer not null default 1,
  seo_title text,
  seo_description text,
  og_asset_id uuid,
  favicon_asset_id uuid,
  desktop_layout_seen_at timestamptz,
  mobile_layout_seen_at timestamptz,
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_name_length check (char_length(name) between 1 and 60),
  constraint sites_slug_format check (
    slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
  ),
  constraint sites_password_hash_required check (
    password_enabled = false or password_hash is not null
  ),
  constraint sites_seo_title_length check (char_length(seo_title) <= 70),
  constraint sites_seo_description_length check (
    char_length(seo_description) <= 200
  )
);

create unique index sites_slug_active_key
  on public.sites (slug)
  where deleted_at is null;

-- site_publishes ------------------------------------------------------------

create table public.site_publishes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  snapshot jsonb not null,
  published_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- assets --------------------------------------------------------------------
-- Column list shared with prompt 02b so that prompt does not recreate this table.
-- No updated_at: an upload is insert-only history of a file.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  path text not null,
  width integer,
  height integer,
  mime text not null,
  bytes integer not null,
  blur_data_url text,
  created_at timestamptz not null default now(),
  constraint assets_path_present check (char_length(path) between 1 and 1024),
  constraint assets_width_positive check (width is null or width > 0),
  constraint assets_height_positive check (height is null or height > 0),
  constraint assets_mime_present check (char_length(mime) between 1 and 255),
  constraint assets_bytes_positive check (bytes > 0),
  constraint assets_blur_data_url_length check (
    blur_data_url is null or char_length(blur_data_url) <= 16384
  ),
  constraint assets_site_path_key unique (site_id, path)
);

-- foreign keys that close the cycle ----------------------------------------

alter table public.sites
  add constraint sites_live_publish_id_fkey
  foreign key (live_publish_id) references public.site_publishes (id)
  on delete set null;

alter table public.sites
  add constraint sites_og_asset_id_fkey
  foreign key (og_asset_id) references public.assets (id)
  on delete set null;

alter table public.sites
  add constraint sites_favicon_asset_id_fkey
  foreign key (favicon_asset_id) references public.assets (id)
  on delete set null;
