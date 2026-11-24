/** Local throwaway database for e2e (scripts/e2e-db.sh). */
export function e2eDbUrl() {
  if (process.env.E2E_DB_URL) return process.env.E2E_DB_URL;
  const host = process.env.PGHOST ?? "/var/run/postgresql";
  return `postgresql:///studiolo_e2e?host=${encodeURIComponent(host)}`;
}
