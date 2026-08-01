-- The app has been reading workspaces.plan since plan limits were added, but
-- the column was never created: PostgREST returned 42703, the query's data
-- came back null, and `ws?.plan ?? "free"` quietly swallowed it. Every
-- workspace therefore appeared to be on the free plan no matter what.
--
-- This also broke every workspace UPDATE the moment the billing trigger
-- started referencing old.plan, so the column has to exist for renames to work.

alter table public.workspaces
  add column if not exists plan text not null default 'free';

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('free', 'pro', 'portfolio', 'agency'));
