-- Someone holding a pending invite needs to see which portfolio they're joining.
-- Scoped tightly: only workspaces that have an outstanding invite for their email.
create policy "workspaces: pending invitee read" on public.workspaces
  for select using (
    exists (
      select 1
      from public.workspace_invites i
      where i.workspace_id = workspaces.id
        and i.accepted_at is null
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
