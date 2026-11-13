-- Studiolo 02a: triggers and slug_is_free.
-- Function bodies must not mention the dormant profiles column.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create trigger sites_set_updated_at
  before update on public.sites
  for each row
  execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create function public.slug_is_free(s text, for_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    s ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
    and not exists (
      select 1
      from public.reserved_slugs as reserved
      where reserved.slug = s
    )
    and not exists (
      select 1
      from public.sites as active_site
      where active_site.slug = s
        and active_site.deleted_at is null
    )
    and not exists (
      select 1
      from public.sites as held
      where held.slug = s
        and held.deleted_at is not null
        and held.owner_id is distinct from for_owner
    ),
    false
  );
$$;

alter function public.slug_is_free(text, uuid) owner to postgres;

revoke all on function public.slug_is_free(text, uuid) from public, anon;
grant execute on function public.slug_is_free(text, uuid) to authenticated, service_role;

-- Reject a slug held by another owner's soft-deleted site.
-- SQLSTATE ST001, message "address taken".

create function public.sites_slug_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.sites as held
    where held.slug = new.slug
      and held.deleted_at is not null
      and held.owner_id is distinct from new.owner_id
      and held.id is distinct from new.id
  ) then
    raise exception 'address taken'
      using errcode = 'ST001';
  end if;
  return new;
end;
$$;

alter function public.sites_slug_available() owner to postgres;

create trigger sites_slug_available
  before insert or update of slug on public.sites
  for each row
  execute function public.sites_slug_available();

-- Reject reserved addresses, and reject a change once the address is locked,
-- unless this transaction set studiolo.restoring. Reserved addresses stay
-- rejected while restoring.
-- SQLSTATE ST003, message "address reserved".
-- SQLSTATE ST002, message "address locked".

create function public.sites_lock_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    if exists (
      select 1
      from public.reserved_slugs as reserved
      where reserved.slug = new.slug
    ) then
      raise exception 'address reserved'
        using errcode = 'ST003';
    end if;
  end if;

  -- Only restore_site (02b) may set studiolo.restoring, and only with
  -- set_config('studiolo.restoring', 'on', true) so is_local is true and the
  -- bypass ends when that transaction commits. A session-wide SET would also
  -- match this read; restore_site must not use one.
  if tg_op = 'UPDATE'
    and new.slug is distinct from old.slug
    and old.slug_locked_at is not null
    and coalesce(current_setting('studiolo.restoring', true), '') <> 'on'
  then
    raise exception 'address locked'
      using errcode = 'ST002';
  end if;

  return new;
end;
$$;

alter function public.sites_lock_slug() owner to postgres;

create trigger sites_lock_slug
  before insert or update of slug on public.sites
  for each row
  execute function public.sites_lock_slug();

-- Insert-only publish history, including for the table owner and service_role.

create function public.reject_site_publish_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published_by is null and old.published_by is not null
     and (to_jsonb(new) - 'published_by') = (to_jsonb(old) - 'published_by') then
    return new;
  end if;
  raise exception 'site_publishes is insert-only'
    using errcode = 'ST004';
end;
$$;

create trigger site_publishes_immutable
  before update on public.site_publishes
  for each row
  execute function public.reject_site_publish_update();

revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.sites_slug_available() from public, anon;
revoke all on function public.sites_lock_slug() from public, anon;
revoke all on function public.reject_site_publish_update() from public, anon;
