-- Soft-delete a site with database timestamps and remove its domain row (04b-fix).

create function public.soft_delete_site(p_site uuid, p_owner uuid)
returns table (site_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
begin
  update public.sites
  set
    deleted_at = now(),
    purge_after = now() + interval '30 days',
    live_publish_id = null,
    updated_at = now()
  where id = p_site
    and owner_id = p_owner
    and deleted_at is null
  returning name into n;

  if n is null then
    raise exception 'site_gone' using errcode = 'ST001';
  end if;

  delete from public.domains where site_id = p_site;

  return query select n;
end;
$$;

create function public.is_site_restorable(p_site uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = p_site
      and s.owner_id = p_owner
      and s.deleted_at is not null
      and s.purge_after > now()
  );
$$;

alter function public.soft_delete_site(uuid, uuid) owner to postgres;
alter function public.is_site_restorable(uuid, uuid) owner to postgres;
revoke all on function public.soft_delete_site(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_site_restorable(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_site(uuid, uuid) to service_role;
grant execute on function public.is_site_restorable(uuid, uuid) to authenticated, service_role;