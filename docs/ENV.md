# Environment variables

Public variables are `NEXT_PUBLIC_*` only. Every other key is server-only and must never be imported into a client component. Read public keys from `src/lib/env.ts`. Read server keys from `src/lib/env.server.ts`, which starts with `import "server-only"`.

Copy `.env.example` to `.env.local`. Leave secrets empty in git. Supabase keys arrive from the Vercel Marketplace integration on the existing `studiolo` project — do not create a second Supabase project.

- `NEXT_PUBLIC_APP_URL` — Absolute origin of this app. Until a root domain exists, live sites are `{NEXT_PUBLIC_APP_URL}/s/<slug>`. Scope: public. Required from prompt 00.
- `NEXT_PUBLIC_ROOT_DOMAIN` — Bare host for tenant sites (`localhost:3000` until an apex exists). Where the wildcard is configured, live sites are also `<slug>.{NEXT_PUBLIC_ROOT_DOMAIN}`. Scope: public. Required from prompt 00.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL, synced by the Vercel Marketplace integration. Scope: public. Required from prompt 02.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key used by the browser client. Scope: public. Required from prompt 02.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key. Scope: server. Required from prompt 02.
- `RESEND_API_KEY` — Resend API key for emailing form submissions to site owners. Scope: server. Optional from prompt 12.
- `RESEND_FROM` — Verified sender address for Resend. Scope: server. Optional from prompt 12.
- `VERCEL_TOKEN` — Vercel access token scoped to team `ben-thain-s-projects`. Scope: server. Required from prompt 11.
- `VERCEL_PROJECT_ID` — Id of the existing Vercel project `studiolo`. Scope: server. Required from prompt 11.
- `VERCEL_TEAM_ID` — Team id for `ben-thain-s-projects` (`team_TY2Xm6yiqDCVZY42ETSFbHPX`). Scope: server. Required from prompt 11.
- `SITE_GATE_SECRET` — Secret for site password gates. Generate with `openssl rand -base64 32`. Scope: server. Required from prompt 10.
- `IP_HASH_SALT` — Salt for hashing visitor IPs in stats. Generate with `openssl rand -base64 32`. Scope: server. Required from prompt 10.
- `CRON_SECRET` — Shared secret presented by Vercel cron routes. Scope: server. Required from prompt 11.
- `NEXT_PUBLIC_WILDCARD_READY` — Set to `1` only once `*.<root>` is attached to the project; leave unset until then. Scope: public. Optional from prompt 04.
- `DOMAINS_DRY_RUN` — Dev and test only. `1` uses a mock Vercel domains adapter. Must be unset in production. Scope: server. Optional from prompt 11.
