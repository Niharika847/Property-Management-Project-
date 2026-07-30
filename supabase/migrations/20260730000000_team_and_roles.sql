-- Phase 4: team collaboration + role-based access (design spec §14 RBAC).
-- Roles: owner/manager can edit; accountant/viewer are read-only.

-- ── 1. Can the caller edit this workspace? (security definer avoids recursion)
create or replace function public.can_edit_workspace(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

-- ── 2. Invites ────────────────────────────────────────────────────────────
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'accountant'
    check (role in ('manager', 'accountant', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- One outstanding invite per email per workspace.
create unique index if not exists workspace_invites_pending_key
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;
create index if not exists workspace_invites_email_idx
  on public.workspace_invites (lower(email))
  where accepted_at is null;

alter table public.workspace_invites enable row level security;

-- Editors manage invites for their own workspace…
create policy "invites: editor read" on public.workspace_invites
  for select using (public.is_workspace_member(workspace_id));
create policy "invites: editor create" on public.workspace_invites
  for insert with check (public.can_edit_workspace(workspace_id));
create policy "invites: editor delete" on public.workspace_invites
  for delete using (public.can_edit_workspace(workspace_id));

-- …and the invited person can see invites addressed to them.
create policy "invites: invitee read" on public.workspace_invites
  for select using (
    accepted_at is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ── 3. Accepting an invite joins the workspace ─────────────────────────────
create or replace function public.accept_workspace_invite(p_invite_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv public.workspace_invites%rowtype;
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.workspace_invites where id = p_invite_id;
  if inv.id is null then
    raise exception 'invite not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite already used';
  end if;
  if lower(inv.email) <> caller_email then
    raise exception 'this invite was sent to a different email';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.workspace_invites
    set accepted_at = now()
    where id = p_invite_id;

  return inv.workspace_id;
end;
$$;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

-- ── 4. Members: whole-workspace visibility + owner management ──────────────
drop policy if exists "members: read own" on public.workspace_members;
create policy "members: read workspace" on public.workspace_members
  for select using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

create policy "members: owner update role" on public.workspace_members
  for update using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- An owner can remove others; anyone can remove their own membership (leave).
create policy "members: remove" on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- ── 5. Split data policies: read = any member, write = owner/manager ───────
do $$
declare
  t text;
begin
  foreach t in array array[
    'properties', 'expenses', 'income', 'leases', 'tenants', 'rent_charges', 'documents'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || ': member all', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))',
      t || ': member read', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_edit_workspace(workspace_id))',
      t || ': editor insert', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id))',
      t || ': editor update', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.can_edit_workspace(workspace_id))',
      t || ': editor delete', t
    );
  end loop;
end $$;

-- Workspace-owned categories follow the same rule.
drop policy if exists "categories: member write" on public.categories;
drop policy if exists "categories: member update" on public.categories;
create policy "categories: editor insert" on public.categories
  for insert with check (workspace_id is not null and public.can_edit_workspace(workspace_id));
create policy "categories: editor update" on public.categories
  for update using (workspace_id is not null and public.can_edit_workspace(workspace_id));
