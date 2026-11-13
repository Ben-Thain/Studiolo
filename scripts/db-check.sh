#!/usr/bin/env bash
# Apply the 02a-02c migrations to a local Postgres database, then run the checks.
# Refuses any non-local host. Does not run in CI and does not touch a hosted project.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
url="${LOCAL_DB_URL:-postgresql:///studiolo_check}"

python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
host = parsed.hostname
if host not in (None, "", "localhost", "127.0.0.1", "::1"):
    sys.exit(f"db:check refuses non-local host {host}")
database = parsed.path.lstrip("/")
if database != "studiolo_check":
    sys.exit("db:check only resets the local database named studiolo_check")
PY

if ! psql "$url" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null; then
  echo "Cannot connect to the local studiolo_check database." >&2
  echo "Create it with: createdb studiolo_check" >&2
  echo "Then run: LOCAL_DB_URL=postgresql:///studiolo_check npm run db:check" >&2
  exit 1
fi

echo "Resetting local database studiolo_check"

psql "$url" -q -v ON_ERROR_STOP=1 <<'SQL'
set client_min_messages to warning;
drop schema if exists public cascade;
drop schema if exists auth cascade;
drop schema if exists storage cascade;
create schema public;
create schema auth;
create schema storage;
grant usage on schema public to public;
grant usage on schema auth to public;

create table auth.users (
  id uuid primary key,
  email text
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Match hosted Supabase: new public tables and functions are granted to the
-- API roles by default, so the migrations must revoke what they do not want.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- Minimal stand-in for the Supabase storage schema: buckets, objects with RLS
-- on and full table grants to the API roles (as hosted), and foldername().
create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

create function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
SQL

for file in \
  "$root/supabase/migrations/0001_core.sql" \
  "$root/supabase/migrations/0002_rls.sql" \
  "$root/supabase/migrations/0003_functions.sql" \
  "$root/supabase/migrations/0004_storage.sql"
do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$file"
done

psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/supabase/checks/rls_and_constraints.sql"

psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/supabase/seed.sql"
psql "$url" -q -v ON_ERROR_STOP=1 <<'SQL'
delete from auth.users;
do $$
declare
  leftover bigint;
begin
  select
    (select count(*) from public.profiles)
    + (select count(*) from public.sites)
    + (select count(*) from public.site_publishes)
    + (select count(*) from public.assets)
    + (select count(*) from public.pages)
    + (select count(*) from public.sections)
    + (select count(*) from public.elements)
    + (select count(*) from public.element_layouts)
    + (select count(*) from public.submissions)
    + (select count(*) from public.page_views_daily)
    + (select count(*) from public.domains)
  into leftover;
  if leftover <> 0 then
    raise exception 'seeded account deletion left % row(s)', leftover;
  end if;
end
$$;
SQL
echo "ok: seeded account deletion"

echo "db:check passed"
