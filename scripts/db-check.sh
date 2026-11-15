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

psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/scripts/local-stub.sql"

for file in "$root"/supabase/migrations/[0-9][0-9][0-9][0-9]_*.sql
do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$file"
done

checks="$root/supabase/checks/rls_and_constraints.sql"

echo "== checks on the freshly migrated database"
psql "$url" -q -v ON_ERROR_STOP=1 -f "$checks"

echo "== seed"
psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/supabase/seed.sql"

# The documented order (migrations, then seed, then checks) and a second run
# in a row must both pass: the checks clean up every fixture they create.
echo "== checks after seeding"
psql "$url" -q -v ON_ERROR_STOP=1 -f "$checks"
echo "== checks again (re-runnable)"
psql "$url" -q -v ON_ERROR_STOP=1 -f "$checks"

psql "$url" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from public.sites where slug = 'north-light' and deleted_at is null) then
    raise exception 'the checks removed seeded data';
  end if;
end
$$;
SQL
echo "ok: checks leave the seeded account in place"
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
