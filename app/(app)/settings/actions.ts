"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, type ActionResult } from "@/lib/action-helpers";

/** Deletes every property, tenant and document in the caller's own workspace.
 *  Properties cascade to leases, rent charges, income and expenses.
 *  Requires an explicit confirmation string from the UI. */
export async function resetWorkspaceData(confirm: string): Promise<ActionResult> {
  if (confirm !== "RESET") return fail('Type RESET to confirm.');
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const wid = ctx.workspace.id;

  const { data: docs } = await ctx.supabase
    .from("documents")
    .select("storage_path")
    .eq("workspace_id", wid);
  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length > 0) await ctx.supabase.storage.from("receipts").remove(paths);

  for (const table of ["documents", "properties", "tenants"] as const) {
    const { error } = await ctx.supabase.from(table).delete().eq("workspace_id", wid);
    if (error) return fail(`Couldn't clear ${table}: ${error.message}`);
  }

  for (const p of ["/dashboard", "/properties", "/expenses", "/income", "/documents", "/analytics", "/reports", "/notifications", "/settings"]) {
    revalidatePath(p);
  }
  return ok();
}
