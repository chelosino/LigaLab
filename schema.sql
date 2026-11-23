-- LigaLab: shared league configuration only. No predictions or simulations are stored.
create schema if not exists ligalab_private;
revoke all on schema ligalab_private from public;
grant usage on schema ligalab_private to authenticated;
create table ligalab_private.admins (email text primary key check(email = lower(email)));
alter table ligalab_private.admins enable row level security;
revoke all on ligalab_private.admins from anon, authenticated;

-- Definer is necessary only to read the private allowlist and verified Auth identity.
create function ligalab_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join ligalab_private.admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
  );
$$;
revoke all on function ligalab_private.is_admin() from public;
grant execute on function ligalab_private.is_admin() to authenticated;
create function public.ligalab_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select ligalab_private.is_admin();
$$;
revoke all on function public.ligalab_is_admin() from public, anon;
grant execute on function public.ligalab_is_admin() to authenticated;

create table public.ligalab_leagues (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  config jsonb not null check (jsonb_typeof(config) = 'object' and config->>'id' = id
    and jsonb_typeof(config->'enabled') = 'boolean'),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.ligalab_leagues enable row level security;
revoke all on public.ligalab_leagues from anon, authenticated;
grant select on public.ligalab_leagues to anon, authenticated;
grant insert(id,config), update(config) on public.ligalab_leagues to authenticated;
create policy published_read on public.ligalab_leagues for select to anon, authenticated
  using (config->>'enabled' = 'true');
create policy admin_read on public.ligalab_leagues for select to authenticated
  using ((select ligalab_private.is_admin()));
create policy admin_insert on public.ligalab_leagues for insert to authenticated
  with check ((select ligalab_private.is_admin()));
create policy admin_update on public.ligalab_leagues for update to authenticated
  using ((select ligalab_private.is_admin())) with check ((select ligalab_private.is_admin()));

create table ligalab_private.audit (
  id bigint generated always as identity primary key,
  league_id text not null, changed_at timestamptz not null default now(),
  changed_by uuid, old_config jsonb, new_config jsonb not null
);
alter table ligalab_private.audit enable row level security;
revoke all on ligalab_private.audit from anon, authenticated;
create function ligalab_private.track_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.revision := case when TG_OP = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := now(); new.updated_by := auth.uid();
  insert into ligalab_private.audit(league_id,changed_by,old_config,new_config)
    values(new.id, auth.uid(), case when TG_OP = 'UPDATE' then old.config else null end, new.config);
  return new;
end;
$$;
revoke all on function ligalab_private.track_change() from public, anon, authenticated;
create trigger ligalab_change before insert or update on public.ligalab_leagues
  for each row execute function ligalab_private.track_change();
