#!/usr/bin/env bash
# Started by Playwright: reset studiolo_e2e, then run a local PostgREST on
# 127.0.0.1:54398 for the mock Supabase server to proxy /rest/v1 to.
# Needs local Postgres (PGHOST/PGUSER as for db:check) and the PostgREST
# binary on PATH or in POSTGREST_BIN.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
bash "$root/scripts/e2e-db.sh"

bin="${POSTGREST_BIN:-postgrest}"
if ! command -v "$bin" >/dev/null; then
  echo "PostgREST not found. Install it (https://postgrest.org) or set POSTGREST_BIN." >&2
  exit 1
fi

socket_dir="${PGHOST:-/tmp}"
export PGRST_DB_URI="postgresql://authenticator@/studiolo_e2e?host=${socket_dir}"
export PGRST_DB_SCHEMAS="public"
export PGRST_DB_ANON_ROLE="anon"
# Test-only value shared with tests/e2e/mock-auth-server.mjs. Not a secret:
# it signs tokens for a throwaway local database and nothing else.
export PGRST_JWT_SECRET="studiolo-local-e2e-only-jwt-signing-key-0001"
export PGRST_SERVER_HOST="127.0.0.1"
export PGRST_SERVER_PORT="${POSTGREST_PORT:-54398}"
export PGRST_DB_POOL="10"
exec "$bin"
