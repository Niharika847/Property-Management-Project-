-- Fixes a first-login race: the app layout and the page render concurrently,
-- so both could see "no membership" and each create a personal workspace,
-- leaving the user with two. Creation now happens once, inside the database,
-- guarded by a per-user advisory lock.

create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select workspace_id into ws
  from public.workspace_members
  where user_id = auth.uid()
  order by created_at, workspace_id
  limit 1;
  if ws is not null then
    return ws;
  end if;

  -- Serialise concurrent first-login requests for this user.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select workspace_id into ws
  from public.workspace_members
  where user_id = auth.uid()
  order by created_at, workspace_id
  limit 1;
  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name, created_by)
  values ('My Portfolio', auth.uid())
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, auth.uid(), 'owner');

  return ws;
end;
$$;

grant execute on function public.ensure_personal_workspace() to authenticated;

-- An owner may delete a workspace they own (used to clean up strays).
create policy "workspaces: owner delete" on public.workspaces
  for delete using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );
