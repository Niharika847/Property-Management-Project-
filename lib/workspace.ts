import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface Workspace {
  id: string;
  name: string;
  currency: string;
}

/** Returns the user's workspace, creating their personal one on first login.
 *  App-level bootstrap (no DB trigger) so it also heals accounts created
 *  before the workspaces migration. */
export async function ensureWorkspace(
  supabase: SupabaseClient,
  user: User
): Promise<Workspace | null> {
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces ( id, name, currency )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const existing = membership?.workspaces as unknown as Workspace | null;
  if (existing) return existing;

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: "My Portfolio", created_by: user.id })
    .select("id, name, currency")
    .single();
  if (error || !workspace) return null;

  await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  return workspace;
}
