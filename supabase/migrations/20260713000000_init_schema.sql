-- Roost: properties & expenses, scoped per user via Supabase Auth (anonymous sign-ins).
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  address text not null,
  suburb text not null default '—',
  status text not null default 'vacant' check (status in ('rented', 'vacant', 'owner')),
  rent numeric not null default 0 check (rent >= 0),
  period text not null default 'week' check (period in ('week', 'month')),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  category text not null default 'General',
  label text not null,
  amount numeric not null check (amount > 0),
  recurring boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists expenses_property_id_idx on public.expenses (property_id);
create index if not exists properties_user_id_idx on public.properties (user_id);
create index if not exists expenses_user_id_idx on public.expenses (user_id);

alter table public.properties enable row level security;
alter table public.expenses enable row level security;

create policy "properties: owner read" on public.properties
  for select using (auth.uid() = user_id);
create policy "properties: owner insert" on public.properties
  for insert with check (auth.uid() = user_id);
create policy "properties: owner update" on public.properties
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "properties: owner delete" on public.properties
  for delete using (auth.uid() = user_id);

create policy "expenses: owner read" on public.expenses
  for select using (auth.uid() = user_id);
create policy "expenses: owner insert" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "expenses: owner update" on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses: owner delete" on public.expenses
  for delete using (auth.uid() = user_id);
