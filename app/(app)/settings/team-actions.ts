"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actionContext, fail, ok, type ActionResult } from "@/lib/action-helpers";
import { WORKSPACE_COOKIE, type Role } from "@/lib/workspace";

const APP_PATHS = [
  "/dashboard",
  "/properties",
  "/income",
  "/expenses",
  "/documents",
  "/reports",
  "/analytics",
  "/calendar",
  "/notifications",
  "/settings",
];
const revalidateApp = () => APP_PATHS.forEach((p) => revalidatePath(p));

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export async function inviteMember(email: string, role: Role): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.canEdit) return fail("Only an owner or manager can invite people.");
  if (role === "owner") return fail("You can't invite someone as an owner.");

  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return fail("Enter a valid email address.");
  if (clean === ctx.user.email?.toLowerCase()) return fail("That's your own address.");

  const { error } = await ctx.supabase.from("workspace_invites").insert({
    workspace_id: ctx.workspace.id,
    email: clean,
    role,
    invited_by: ctx.user.id,
  });
  if (error) {
    return fail(
      error.code === "23505" || error.message.includes("duplicate")
        ? "There's already a pending invite for that email."
        : error.message
    );
  }

  revalidatePath("/settings");
  return ok();
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("workspace_invites").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/settings");
  return ok();
}

export async function acceptInvite(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  const { data, error } = await ctx.supabase.rpc("accept_workspace_invite", {
    p_invite_id: id,
  });
  if (error) return fail(error.message);

  if (typeof data === "string") {
    (await cookies()).set(WORKSPACE_COOKIE, data, COOKIE_OPTS);
  }
  revalidateApp();
  return ok();
}

export async function switchWorkspace(workspaceId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  const { data: membership } = await ctx.supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!membership) return fail("You don't have access to that workspace.");

  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, COOKIE_OPTS);
  revalidateApp();
  return ok();
}

export async function changeMemberRole(userId: string, role: Role): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.isOwner) return fail("Only the owner can change roles.");
  if (userId === ctx.user.id) return fail("You can't change your own role.");

  const { error } = await ctx.supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", userId);
  if (error) return fail(error.message);
  revalidatePath("/settings");
  return ok();
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.isOwner) return fail("Only the owner can remove people.");
  if (userId === ctx.user.id) return fail("You can't remove yourself — use Leave instead.");

  const { error } = await ctx.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", userId);
  if (error) return fail(error.message);
  revalidatePath("/settings");
  return ok();
}

/** Leave a workspace you were invited to. Owners can't leave their own. */
export async function leaveWorkspace(): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (ctx.workspace.isOwner) return fail("You own this workspace, so you can't leave it.");

  const { error } = await ctx.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", ctx.user.id);
  if (error) return fail(error.message);

  (await cookies()).delete(WORKSPACE_COOKIE);
  revalidateApp();
  return ok();
}
