-- Phase 1: the core ledger (design spec §7).
-- Upgrades prototype tables to the workspace-scoped model, adds tenancy +
-- income tracking, seeds AU-oriented categories, and ports existing data.

-- ── 0. Helper: workspace membership check (security definer avoids RLS recursion)
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- ── 1. Categories (workspace_id null = system-wide)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  tax_deductible_default boolean not null default true,
  is_capital boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_system_name_key
  on public.categories (name, kind) where workspace_id is null;

insert into public.categories (name, kind, tax_deductible_default, is_capital) values
  ('Advertising for tenants', 'expense', true,  false),
  ('Body corporate fees',     'expense', true,  false),
  ('Borrowing expenses',      'expense', true,  false),
  ('Cleaning',                'expense', true,  false),
  ('Council rates',           'expense', true,  false),
  ('Gardening & lawns',       'expense', true,  false),
  ('Insurance',               'expense', true,  false),
  ('Interest on loan',        'expense', true,  false),
  ('Land tax',                'expense', true,  false),
  ('Legal expenses',          'expense', true,  false),
  ('Pest control',            'expense', true,  false),
  ('Property agent fees',     'expense', true,  false),
  ('Repairs & maintenance',   'expense', true,  false),
  ('Capital works & renovations', 'expense', false, true),
  ('Stationery, phone & postage', 'expense', true, false),
  ('Travel',                  'expense', false, false),
  ('Utilities',               'expense', true,  false),
  ('Water charges',           'expense', true,  false),
  ('Other',                   'expense', false, false),
  ('Rent',                    'income',  false, false),
  ('Other income',            'income',  false, false)
on conflict do nothing;

-- ── 2. Tenants
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists tenants_workspace_idx on public.tenants (workspace_id);

-- ── 3. Properties: upgrade in place, then port data
alter table public.properties
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists state text,
  add column if not exists postcode text,
  add column if not exists property_type text not null default 'house'
    check (property_type in ('house', 'apartment', 'townhouse', 'unit', 'land', 'commercial')),
  add column if not exists bedrooms int,
  add column if not exists bathrooms int,
  add column if not exists parking int,
  add column if not exists purchase_price numeric(12,2),
  add column if not exists purchase_date date,
  add column if not exists current_value numeric(12,2),
  add column if not exists valued_at date,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Workspaces for prototype users that predate the workspace model
insert into public.workspaces (name, created_by)
select distinct 'My Portfolio', u.user_id
from (
  select user_id from public.properties
  union
  select user_id from public.expenses
) u
left join public.workspace_members m on m.user_id = u.user_id
where m.user_id is null;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
left join public.workspace_members m
  on m.workspace_id = w.id and m.user_id = w.created_by
where m.user_id is null;

update public.properties p
set workspace_id = (
  select m.workspace_id from public.workspace_members m
  where m.user_id = p.user_id
  order by m.created_at limit 1
)
where p.workspace_id is null;

-- Old status vocabulary → spec vocabulary
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.properties'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute format('alter table public.properties drop constraint %I', c);
  end if;
end $$;

update public.properties set status = 'rental' where status = 'rented';
update public.properties set status = 'owner_occupied' where status = 'owner';
alter table public.properties add constraint properties_status_check
  check (status in ('rental', 'owner_occupied', 'vacant', 'under_construction', 'sold'));

-- ── 4. Leases (tenant optional so rent tracking works without tenant details)
create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  rent_amount numeric(12,2) not null check (rent_amount > 0),
  frequency text not null default 'weekly' check (frequency in ('weekly', 'fortnightly', 'monthly')),
  start_date date not null,
  end_date date,
  bond_amount numeric(12,2),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);
create index if not exists leases_property_idx on public.leases (property_id, status);
create index if not exists leases_workspace_idx on public.leases (workspace_id);

-- Port prototype rent fields into leases (schedule starts today, not backdated)
insert into public.leases (workspace_id, property_id, rent_amount, frequency, start_date, status)
select p.workspace_id, p.id, p.rent,
       case when p.period = 'week' then 'weekly' else 'monthly' end,
       current_date, 'active'
from public.properties p
where p.status = 'rental' and p.rent > 0 and p.workspace_id is not null;

alter table public.properties drop column if exists rent;
alter table public.properties drop column if exists period;
alter table public.properties alter column workspace_id set not null;
alter table public.properties alter column user_id drop not null;

-- ── 5. Rent charges (money expected; income = money realized)
create table if not exists public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lease_id uuid not null references public.leases (id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null,
  status text not null default 'expected' check (status in ('expected', 'paid', 'waived')),
  paid_amount numeric(12,2),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lease_id, due_date)
);
create index if not exists rent_charges_lease_idx on public.rent_charges (lease_id, due_date);
create index if not exists rent_charges_due_idx on public.rent_charges (workspace_id, status, due_date);

-- ── 6. Income
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  rent_charge_id uuid references public.rent_charges (id) on delete set null,
  type text not null default 'rent' check (type in ('rent', 'other')),
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);
create index if not exists income_workspace_date_idx on public.income (workspace_id, date desc);
create index if not exists income_property_idx on public.income (property_id, date desc);

-- ── 7. Expenses: upgrade in place, then port data
alter table public.expenses
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists date date,
  add column if not exists gst_amount numeric(12,2) not null default 0,
  add column if not exists category_id uuid references public.categories (id),
  add column if not exists vendor text,
  add column if not exists description text,
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('paid', 'unpaid', 'scheduled')),
  add column if not exists is_tax_deductible boolean not null default true,
  add column if not exists notes text,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'receipt_ai', 'recurring', 'import'));

update public.expenses e
set workspace_id = (
  select m.workspace_id from public.workspace_members m
  where m.user_id = e.user_id
  order by m.created_at limit 1
)
where e.workspace_id is null;

update public.expenses set date = occurred_at::date where date is null;
update public.expenses set description = label where description is null;

update public.expenses e
set category_id = c.id
from public.categories c
where e.category_id is null
  and c.workspace_id is null and c.kind = 'expense'
  and lower(c.name) = lower(e.category);

update public.expenses e
set category_id = (
  select id from public.categories
  where workspace_id is null and kind = 'expense' and name = 'Other'
)
where e.category_id is null;

alter table public.expenses alter column workspace_id set not null;
alter table public.expenses alter column date set not null;
alter table public.expenses alter column description set not null;
alter table public.expenses alter column category_id set not null;
alter table public.expenses alter column user_id drop not null;
alter table public.expenses drop column if exists label;
alter table public.expenses drop column if exists category;
alter table public.expenses drop column if exists occurred_at;
alter table public.expenses drop column if exists recurring;
create index if not exists expenses_workspace_date_idx on public.expenses (workspace_id, date desc);
create index if not exists expenses_category_idx on public.expenses (category_id);

-- ── 8. Rent charge generation (called after lease create + on page loads)
create or replace function public.generate_rent_charges(
  p_lease_id uuid,
  p_until date default (current_date + 60)
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  l public.leases%rowtype;
  d date;
  step interval;
begin
  select * into l from public.leases where id = p_lease_id;
  if l.id is null or l.status <> 'active' then return; end if;
  if auth.uid() is not null and not public.is_workspace_member(l.workspace_id) then
    raise exception 'not a member of this workspace';
  end if;

  step := case l.frequency
    when 'weekly' then interval '7 days'
    when 'fortnightly' then interval '14 days'
    else interval '1 month'
  end;

  select coalesce((max(due_date) + step)::date, l.start_date)
    into d from public.rent_charges where lease_id = p_lease_id;

  while d <= p_until and (l.end_date is null or d <= l.end_date) loop
    insert into public.rent_charges (workspace_id, lease_id, due_date, amount)
    values (l.workspace_id, p_lease_id, d, l.rent_amount)
    on conflict (lease_id, due_date) do nothing;
    d := (d + step)::date;
  end loop;
end;
$$;
grant execute on function public.generate_rent_charges(uuid, date) to authenticated;

-- Seed charges for leases ported from the prototype
select public.generate_rent_charges(id) from public.leases where status = 'active';

-- ── 9. RLS: replace per-user policies with workspace-member policies
alter table public.categories enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_charges enable row level security;
alter table public.income enable row level security;

drop policy if exists "properties: owner read" on public.properties;
drop policy if exists "properties: owner insert" on public.properties;
drop policy if exists "properties: owner update" on public.properties;
drop policy if exists "properties: owner delete" on public.properties;
drop policy if exists "expenses: owner read" on public.expenses;
drop policy if exists "expenses: owner insert" on public.expenses;
drop policy if exists "expenses: owner update" on public.expenses;
drop policy if exists "expenses: owner delete" on public.expenses;

create policy "properties: member all" on public.properties
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "expenses: member all" on public.expenses
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "categories: read system or own" on public.categories
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));
create policy "categories: member write" on public.categories
  for insert with check (workspace_id is not null and public.is_workspace_member(workspace_id));
create policy "categories: member update" on public.categories
  for update using (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "tenants: member all" on public.tenants
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "leases: member all" on public.leases
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "rent_charges: member all" on public.rent_charges
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "income: member all" on public.income
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
