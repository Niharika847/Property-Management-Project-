-- Billing columns on workspaces. The plan column already exists; these link a
-- workspace to its Stripe customer/subscription so the webhook can keep the
-- plan in sync without guessing from email addresses.

alter table public.workspaces
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text;

-- One Stripe customer maps to exactly one workspace.
create unique index if not exists workspaces_stripe_customer_id_key
  on public.workspaces (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists workspaces_stripe_subscription_id_key
  on public.workspaces (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- The "workspaces: owner update" policy permits an owner to update ANY column,
-- which would let anyone grant themselves a paid plan straight from the browser
-- with their own anon session — the plan limits are enforced against this
-- column, so that is a real billing bypass, not a theoretical one.
--
-- RLS is per-row, not per-column, so the fix is a trigger: billing fields are
-- pinned to their previous values for every caller except service_role, which
-- is what the Stripe webhook uses. Owners keep full control of the name and
-- currency; nobody can promote themselves.
create or replace function public.protect_workspace_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.plan := old.plan;
    new.plan_status := old.plan_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_workspace_billing on public.workspaces;
create trigger protect_workspace_billing
  before update on public.workspaces
  for each row execute function public.protect_workspace_billing();
