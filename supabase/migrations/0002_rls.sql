-- Studiolo 02a and 02b: enable RLS only. Prompt 02c adds the policies.

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

-- 02b tables. Policies arrive in 02c.

alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.elements enable row level security;
alter table public.element_layouts enable row level security;
alter table public.submissions enable row level security;
alter table public.page_views_daily enable row level security;
alter table public.rate_limits enable row level security;
alter table public.domains enable row level security;

grant select, insert, update, delete on table public.pages to authenticated, service_role;
grant select, insert, update, delete on table public.sections to authenticated, service_role;
grant select, insert, update, delete on table public.elements to authenticated, service_role;
grant select, insert, update, delete on table public.element_layouts to authenticated, service_role;
grant select, insert, update, delete on table public.submissions to authenticated, service_role;
grant select, insert, update, delete on table public.domains to authenticated, service_role;
grant select on table public.page_views_daily to authenticated;
grant select, insert, update, delete on table public.page_views_daily to service_role;
grant select, insert, update, delete on table public.rate_limits to service_role;
