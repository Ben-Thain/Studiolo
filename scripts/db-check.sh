#!/usr/bin/env bash
# Apply the 02a migrations to a local Postgres database, then run the checks.
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
create schema public;
create schema auth;
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
  into leftover;
  if leftover <> 0 then
    raise exception 'seeded account deletion left % row(s)', leftover;
  end if;
end
$$;
SQL
echo "ok: seeded account deletion"

echo "db:check passed"
