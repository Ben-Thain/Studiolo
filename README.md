# Studiolo

Freeform personal-site editor. One account owns many sites; each site has its own pages, slug, settings, password, domain, submissions, and stats. Desktop and Mobile layouts share content and store position, size, and hidden per layout.

This repository is the Next.js app for the existing Vercel project `studiolo` in team `ben-thain-s-projects`. Prompt 00 is the scaffold. Prompts 02a–02c add the database schema, functions, row level security, column grants, the private `site-assets` storage bucket and the local seed. There is no auth UI or editor UI yet.

## Scripts

```bash
npm install
cp .env.example .env.local
npm run dev
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
npm run db:check
```

`npm run dev` serves [http://localhost:3000](http://localhost:3000). Public env defaults to that origin when the variables are unset outside production.

`npm run db:check` resets the local database named `studiolo_check`, applies `supabase/migrations`, and runs `supabase/checks/rls_and_constraints.sql`. It refuses any host other than localhost. It does not run in CI and it does not connect to a hosted Supabase project. Create the database once with `createdb studiolo_check`. The default URL is `postgresql:///studiolo_check`; override it with `LOCAL_DB_URL` when the socket needs a host, for example `LOCAL_DB_URL=postgresql://127.0.0.1/studiolo_check`. Without the Supabase CLI, the script creates a stub `auth.users` table and the `anon`, `authenticated`, and `service_role` roles. `supabase/seed.sql` is local sample data (`@example.com` only): Sam Carter (`sam@example.com`) with Riverton House (live, password on, custom domain, five pages, four submissions, a week of views), North Light (live) and Mara Lind (draft). It runs in one transaction and refuses to run when any non-`@example.com` account exists. After the checks, `db:check` loads that seed and runs `delete from auth.users`. `profiles`, `sites`, `site_publishes`, `assets`, `pages`, `sections`, `elements`, `element_layouts`, `submissions`, `page_views_daily`, and `domains` must be empty afterwards.

The stub also mirrors two hosted-Supabase behaviours so the checks are honest: default privileges grant every new public table and function to `anon`, `authenticated` and `service_role` (the migrations revoke what each role must not have), and a minimal `storage` schema (`buckets`, `objects` with RLS on, `foldername()`) stands in for Supabase Storage. The checks then run as the real API roles (`set role anon` / `authenticated` / `service_role` with `request.jwt.claim.sub`) and assert every policy and grant.

### Database access rules (02c)

- Every table has RLS on. `anon` can read `reserved_slugs` and nothing else; live sites are rendered by the server with the service role.
- The signed-in owner can read every `sites` column except `password_hash`, so `select("*")` on `sites` fails for them. Use `SITE_OWNER_SELECT` from `src/types/database.ts`. Owners may update only `SITE_OWNER_UPDATE_COLUMNS`; draft columns change through `save_draft`; publish, password, lock and delete columns are written by server actions with the service role after an ownership check.
- A soft-deleted site stays visible to its owner (Recently deleted) but cannot be updated, and its pages, elements, submissions, assets, stats and storage objects are not readable until `restore_site` runs.
- `site-assets` is private (8 MB, webp/avif/jpeg/png). Owners read and write `{site_id}/…` for their own non-deleted sites; `anon` has no access.

### Before prompt 03 (Ben)

This environment cannot reach Supabase, so the checks were run against local Postgres 17 with the stub above. Before prompt 03 is accepted, run them once against the real Supabase stack:

```bash
supabase db reset
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/checks/rls_and_constraints.sql
```

Every line must print `ok:` and the script must exit 0. `$DB_URL` is the local Supabase CLI database URL (`supabase status`), never the hosted project.

## Manual steps

- Create a Git repo and connect it to the existing Vercel project `studiolo` (`npx vercel link --yes --project studiolo --scope ben-thain-s-projects`).
- Add the Supabase integration from the Vercel Marketplace so Supabase env vars sync to `studiolo`.
- After prompt 02: apply migrations and run `supabase/checks/rls_and_constraints.sql`.
- Before prompt 03: enable Google OAuth in Supabase; add site URL + redirect URLs (local and production).
- Before prompt 10: generate `SITE_GATE_SECRET` and `IP_HASH_SALT` (`openssl rand -base64 32`) as server-only env vars.
- Before prompt 11: create a Vercel access token scoped to the team and set `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (server-only); set `CRON_SECRET`.
- Optional: set `RESEND_API_KEY` and `RESEND_FROM` (a verified sender) to email submissions to owners.
- Optional, later: if Ben buys `studiolo.page` himself, add the apex and `*.studiolo.page` to the project and set `NEXT_PUBLIC_ROOT_DOMAIN=studiolo.page`. The coder never buys or registers a domain.
- Check Deployment Protection on `studiolo`: production must not put a Vercel login wall in front of live sites (tenant subdomains, custom domains, `/s/<slug>`).

Every variable is documented in [docs/ENV.md](docs/ENV.md). `.env.local` is gitignored. Do not commit secrets, create a second Vercel or Supabase project, deploy from this scaffold, or register a domain.
