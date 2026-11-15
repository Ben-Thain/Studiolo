#!/usr/bin/env bash
# Reset the local e2e database: the local stand-in schema, the migrations and
# the seed, plus an `authenticator` login role for a local PostgREST.
# Refuses any non-local host and any database not named studiolo_e2e.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
url="${E2E_DB_URL:-postgresql:///studiolo_e2e}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
host = parsed.hostname
if host not in (None, "", "localhost", "127.0.0.1", "::1"):
    sys.exit(f"e2e-db refuses non-local host {host}")
if parsed.path.lstrip("/") != "studiolo_e2e":
    sys.exit("e2e-db only resets the local database named studiolo_e2e")
PY

admin_url="${url%/studiolo_e2e*}/postgres"
if ! psql "$admin_url" -At -c "select 1" >/dev/null; then
  echo "Cannot connect to local Postgres ($admin_url)." >&2
  exit 1
fi
if [ "$(psql "$admin_url" -At -c "select 1 from pg_database where datname = 'studiolo_e2e'")" != "1" ]; then
  psql "$admin_url" -q -c "create database studiolo_e2e"
fi

psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/scripts/local-stub.sql"
for file in "$root"/supabase/migrations/000[1-4]_*.sql; do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$file"
done
psql "$url" -q -v ON_ERROR_STOP=1 -f "$root/supabase/seed.sql"

# PostgREST connects as authenticator and switches to anon/authenticated
# from the JWT role claim, as on hosted Supabase.
psql "$url" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end
$$;
grant anon, authenticated to authenticator;
SQL
echo "e2e database ready: studiolo_e2e"
