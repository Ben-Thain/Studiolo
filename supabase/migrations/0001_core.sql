-- Studiolo 02a and 02b: extensions, tables, and indexes.
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
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- assets --------------------------------------------------------------------
-- 02b's assets definition is already satisfied here. 02b must not
-- create table assets again. The required assets (site_id) index is the
-- leading column of assets_site_path_key.
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
  constraint assets_mime_allowed check (
    mime in ('image/webp', 'image/avif', 'image/jpeg', 'image/png')
  ),
  constraint assets_bytes_range check (bytes > 0 and bytes <= 8388608),
  constraint assets_blur_data_url_length check (
    blur_data_url is null or char_length(blur_data_url) <= 16384
  ),
  constraint assets_site_path_key unique (site_id, path)
);

comment on table public.assets is
  '02b assets definition is already satisfied by 0001. Do not create this table again. The assets (site_id) index is the leading column of assets_site_path_key.';

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

-- 02b tables ----------------------------------------------------------------

create index sites_owner_active_updated_idx
  on public.sites (owner_id, updated_at desc)
  where deleted_at is null;

create index sites_owner_deleted_idx
  on public.sites (owner_id, deleted_at desc)
  where deleted_at is not null;

create index sites_purge_after_idx
  on public.sites (purge_after)
  where deleted_at is not null;

create index site_publishes_site_created_idx
  on public.site_publishes (site_id, created_at desc);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null,
  slug text not null,
  sort_order integer not null,
  in_nav boolean not null default true,
  is_home boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_title_length check (char_length(title) between 1 and 60),
  constraint pages_slug_format check (
    slug = ''
    or slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'
  ),
  constraint pages_site_slug_key unique (site_id, slug)
);

create unique index one_home_per_site
  on public.pages (site_id)
  where is_home;

create index pages_site_sort_idx
  on public.pages (site_id, sort_order);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  page_id uuid references public.pages (id) on delete cascade,
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create index sections_page_sort_idx
  on public.sections (page_id, sort_order);

create table public.elements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  page_id uuid references public.pages (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  type text not null,
  name text not null,
  content jsonb not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elements_type_allowed check (type in ('text', 'image', 'nav', 'form'))
);

create index elements_page_sort_idx
  on public.elements (page_id, sort_order);

create index elements_site_id_idx
  on public.elements (site_id);

create table public.element_layouts (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.elements (id) on delete cascade,
  breakpoint text not null,
  col_start integer not null,
  col_span integer not null,
  row_start integer not null,
  row_span integer not null,
  hidden boolean not null default false,
  placement_source text not null default 'auto',
  constraint element_layouts_breakpoint check (breakpoint in ('desktop', 'mobile')),
  constraint element_layouts_col_start check (col_start between 1 and 12),
  constraint element_layouts_col_span check (col_span between 1 and 12),
  constraint element_layouts_row_start check (row_start >= 1),
  constraint element_layouts_row_span check (row_span >= 1),
  constraint element_layouts_columns_fit check (col_start + col_span - 1 <= 12),
  constraint element_layouts_placement_source check (placement_source in ('auto', 'manual')),
  constraint element_layouts_element_breakpoint_key unique (element_id, breakpoint)
);

create index element_layouts_element_id_idx
  on public.element_layouts (element_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint submissions_name_length check (char_length(name) between 1 and 120),
  constraint submissions_email_length check (char_length(email) <= 254),
  constraint submissions_message_length check (char_length(message) between 1 and 5000)
);

create index submissions_site_created_idx
  on public.submissions (site_id, created_at desc);

create index submissions_site_unread_idx
  on public.submissions (site_id)
  where read_at is null;

create table public.page_views_daily (
  site_id uuid not null references public.sites (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (site_id, day)
);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.sites (id) on delete cascade,
  hostname text not null unique,
  alias_hostname text unique,
  status text not null default 'pending',
  verification jsonb,
  dns_records jsonb,
  misconfigured boolean,
  error_code text,
  error_message text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domains_status check (status in ('pending', 'connected', 'error')),
  constraint domains_hostname_lowercase check (hostname = lower(hostname)),
  constraint domains_alias_lowercase check (
    alias_hostname is null or alias_hostname = lower(alias_hostname)
  )
);

create index domains_pending_idx
  on public.domains (status)
  where status = 'pending';
