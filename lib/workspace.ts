import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { WORKSPACE_COOKIE, type Role } from "@/lib/roles";

export { WORKSPACE_COOKIE, ROLE_LABEL, ROLE_BLURB, type Role } from "@/lib/roles";

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  role: Role;
  canEdit: boolean;
  isOwner: boolean;
}

interface MembershipRow {
  role: Role;
  workspaces: { id: string; name: string; currency: string } | null;
}

const toWorkspace = (row: MembershipRow): Workspace | null => {
  if (!row.workspaces) return null;
  return {
    id: row.workspaces.id,
    name: row.workspaces.name,
    currency: row.workspaces.currency,
    role: row.role,
    canEdit: row.role === "owner" || row.role === "manager",
    isOwner: row.role === "owner",
  };
};

/** Every workspace the user belongs to, oldest membership first. */
export async function listMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<Workspace[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces ( id, name, currency )")
    .eq("user_id", userId)
    // Deterministic tiebreak: same-millisecond rows must order identically
    // for every concurrent render, or different pages disagree on "active".
    .order("created_at")
    .order("workspace_id");
  return ((data ?? []) as unknown as MembershipRow[])
    .map(toWorkspace)
    .filter((w): w is Workspace => w !== null);
}

/** The workspace the user is currently working in.
 *  Honours the `roost-workspace` cookie when it points at a real membership,
 *  and creates a personal workspace the first time someone signs in. */
export async function ensureWorkspace(
  supabase: SupabaseClient,
  user: User
): Promise<Workspace | null> {
  const memberships = await listMemberships(supabase, user.id);

  if (memberships.length > 0) {
    let selected: string | undefined;
    try {
      selected = (await cookies()).get(WORKSPACE_COOKIE)?.value;
    } catch {
      // Called outside a request scope — fall back to the default membership.
    }
    return memberships.find((w) => w.id === selected) ?? memberships[0];
  }

  // Race-free: concurrent first-login renders all resolve to one workspace.
  const { data: workspaceId, error } = await supabase.rpc("ensure_personal_workspace");
  if (error || typeof workspaceId !== "string") return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, currency")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return null;

  return {
    id: workspace.id,
    name: workspace.name,
    currency: workspace.currency,
    role: "owner",
    canEdit: true,
    isOwner: true,
  };
}
