-- Phase 0: multi-tenancy foundation (design spec §7).
-- Every future table hangs off workspaces; members carry roles for RBAC.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Portfolio',
  currency char(3) not null default 'AUD',
  fy_start_month int not null default 7 check (fy_start_month between 1 and 12),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Membership rows: a user manages only their own membership rows.
-- (Kept self-scoped to avoid recursive policies; owner-invites arrive in a later phase
--  via a security-definer function.)
create policy "members: read own" on public.workspace_members
  for select using (auth.uid() = user_id);
create policy "members: join own workspace" on public.workspace_members
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.created_by = auth.uid()
    )
  );

-- Workspaces: visible to members; creatable by the signed-in user for themself.
create policy "workspaces: member read" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );
create policy "workspaces: create own" on public.workspaces
  for insert with check (created_by = auth.uid());
create policy "workspaces: owner update" on public.workspaces
  for update using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );
