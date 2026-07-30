-- Recurring expenses and mortgages (design spec §7).
-- Council rates, insurance and body corporate repeat on a schedule; mortgages
-- are usually the largest outgoing and were missing from cash flow entirely.

-- ── Recurring expense rules ───────────────────────────────────────────────
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  description text not null,
  vendor text,
  amount numeric(12,2) not null check (amount > 0),
  gst_amount numeric(12,2) not null default 0,
  is_tax_deductible boolean not null default true,
  frequency text not null
    check (frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  next_run_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recurring_rules_due_idx
  on public.recurring_rules (workspace_id, active, next_run_date);

alter table public.expenses
  add column if not exists recurring_rule_id uuid
    references public.recurring_rules (id) on delete set null;

-- ── Mortgages ─────────────────────────────────────────────────────────────
create table if not exists public.mortgages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  lender text not null,
  account_ref text,
  original_amount numeric(12,2),
  current_balance numeric(12,2) not null default 0,
  interest_rate numeric(6,3) not null default 0,
  rate_type text not null default 'variable'
    check (rate_type in ('fixed', 'variable', 'split')),
  repayment_type text not null default 'principal_interest'
    check (repayment_type in ('principal_interest', 'interest_only')),
  repayment_amount numeric(12,2) not null default 0,
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'fortnightly', 'monthly')),
  start_date date,
  term_months int,
  offset_balance numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists mortgages_property_idx on public.mortgages (property_id);

-- ── RLS: read = any member, write = owner/manager ─────────────────────────
alter table public.recurring_rules enable row level security;
alter table public.mortgages enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recurring_rules', 'mortgages'] loop
    execute format(
      'create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))',
      t || ': member read', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.can_edit_workspace(workspace_id))',
      t || ': editor insert', t);
    execute format(
      'create policy %I on public.%I for update using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id))',
      t || ': editor update', t);
    execute format(
      'create policy %I on public.%I for delete using (public.can_edit_workspace(workspace_id))',
      t || ': editor delete', t);
  end loop;
end $$;

-- ── Generate any due recurring expenses ───────────────────────────────────
-- Called when the expenses page loads; catches up rules that fell behind and
-- is safe to call repeatedly (each run only advances past dates already due).
create or replace function public.run_recurring_rules(p_workspace uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  r public.recurring_rules%rowtype;
  step interval;
  created integer := 0;
  guard integer;
begin
  if not public.can_edit_workspace(p_workspace) then
    return 0;
  end if;

  for r in
    select * from public.recurring_rules
    where workspace_id = p_workspace and active and next_run_date <= current_date
  loop
    step := case r.frequency
      when 'weekly' then interval '7 days'
      when 'fortnightly' then interval '14 days'
      when 'monthly' then interval '1 month'
      when 'quarterly' then interval '3 months'
      else interval '1 year'
    end;

    guard := 0;
    while r.next_run_date <= current_date
          and (r.end_date is null or r.next_run_date <= r.end_date)
          and guard < 60
    loop
      insert into public.expenses (
        workspace_id, property_id, date, amount, gst_amount, category_id,
        vendor, description, payment_status, is_tax_deductible, source,
        recurring_rule_id
      )
      values (
        r.workspace_id, r.property_id, r.next_run_date, r.amount, r.gst_amount,
        r.category_id, r.vendor, r.description, 'unpaid', r.is_tax_deductible,
        'recurring', r.id
      );
      created := created + 1;
      r.next_run_date := (r.next_run_date + step)::date;
      guard := guard + 1;
    end loop;

    update public.recurring_rules
      set next_run_date = r.next_run_date,
          active = case
            when r.end_date is not null and r.next_run_date > r.end_date then false
            else active
          end
      where id = r.id;
  end loop;

  return created;
end;
$$;
grant execute on function public.run_recurring_rules(uuid) to authenticated;
