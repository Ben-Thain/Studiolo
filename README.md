# Studiolo

Freeform personal-site editor. One account owns many sites; each site has its own pages, slug, settings, password, domain, submissions, and stats. Desktop and Mobile layouts share content and store position, size, and hidden per layout.

This repository is the Next.js app for the existing Vercel project `studiolo` in team `ben-thain-s-projects`. Prompt 00 is the scaffold: placeholder page, env readers, and test runners. No auth, schema, or editor UI yet.

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
```

`npm run dev` serves [http://localhost:3000](http://localhost:3000). Public env defaults to that origin when the variables are unset outside production.

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
