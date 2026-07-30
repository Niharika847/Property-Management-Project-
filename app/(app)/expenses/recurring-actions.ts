"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, str, num, type ActionResult } from "@/lib/action-helpers";
import { todayISO } from "@/lib/format";

export async function createRecurringRule(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.canEdit) return fail("You have read-only access to this portfolio.");

  const amount = num(form, "amount");
  const fields = {
    workspace_id: ctx.workspace.id,
    property_id: str(form, "property_id"),
    category_id: str(form, "category_id"),
    description: str(form, "description"),
    vendor: str(form, "vendor") || null,
    amount,
    gst_amount: num(form, "gst_amount") ?? 0,
    is_tax_deductible: form.get("is_tax_deductible") === "on",
    frequency: str(form, "frequency") || "monthly",
    next_run_date: str(form, "next_run_date") || todayISO(),
    end_date: str(form, "end_date") || null,
  };

  if (!fields.property_id) return fail("Pick a property.");
  if (!fields.category_id) return fail("Pick a category.");
  if (!fields.description) return fail("Add a short description.");
  if (!amount || amount <= 0) return fail("Amount must be greater than zero.");

  const { error } = await ctx.supabase.from("recurring_rules").insert(fields);
  if (error) return fail(error.message);

  revalidatePath("/expenses");
  return ok();
}

export async function toggleRecurringRule(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("recurring_rules").update({ active }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/expenses");
  return ok();
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("recurring_rules").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/expenses");
  return ok();
}
