-- 05-fix: is_site_restorable is service_role only (no cross-owner probing).

revoke execute on function public.is_site_restorable(uuid, uuid) from authenticated;
grant execute on function public.is_site_restorable(uuid, uuid) to service_role;