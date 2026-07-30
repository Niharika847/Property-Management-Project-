-- Phase 4: public profiles mirror, so teammates can be shown by name/email.
-- auth.users isn't reachable from the client, so we keep a synced projection.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Do two users share any workspace? (security definer: bypasses member RLS)
create or replace function public.shares_workspace(other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
grant execute on function public.shares_workspace(uuid) to authenticated;

create policy "profiles: self or teammate read" on public.profiles
  for select using (id = auth.uid() or public.shares_workspace(id));

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Keep it in sync with auth.users ───────────────────────────────────────
create or replace function public.sync_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, updated_at)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved
  after insert or update on auth.users
  for each row execute function public.sync_profile();

-- Backfill everyone who already exists.
insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);
