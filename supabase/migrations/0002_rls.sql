-- Studiolo 02a: enable RLS only. Prompt 02c adds the policies.

alter table public.profiles enable row level security;
alter table public.reserved_slugs enable row level security;
alter table public.sites enable row level security;
alter table public.site_publishes enable row level security;
alter table public.assets enable row level security;

-- site_publishes is insert-only history. No UPDATE grant for the API roles.
revoke all on table public.site_publishes from public, anon, authenticated, service_role;
grant select, insert on table public.site_publishes to authenticated;
grant select, insert, delete on table public.site_publishes to service_role;

grant select, insert, update, delete on table public.profiles to authenticated, service_role;
grant select on table public.reserved_slugs to authenticated, service_role;
grant select, insert, update, delete on table public.sites to authenticated, service_role;
grant select, insert, update, delete on table public.assets to authenticated, service_role;
