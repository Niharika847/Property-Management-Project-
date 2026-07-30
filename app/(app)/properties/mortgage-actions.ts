"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, str, num, type ActionResult } from "@/lib/action-helpers";

function mortgageFields(form: FormData) {
  return {
    lender: str(form, "lender"),
    account_ref: str(form, "account_ref") || null,
    original_amount: num(form, "original_amount"),
    current_balance: num(form, "current_balance") ?? 0,
    interest_rate: num(form, "interest_rate") ?? 0,
    rate_type: str(form, "rate_type") || "variable",
    repayment_type: str(form, "repayment_type") || "principal_interest",
    repayment_amount: num(form, "repayment_amount") ?? 0,
    frequency: str(form, "frequency") || "monthly",
    start_date: str(form, "start_date") || null,
    offset_balance: num(form, "offset_balance"),
  };
}

export async function saveMortgage(
  propertyId: string,
  mortgageId: string | null,
  form: FormData
): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.canEdit) return fail("You have read-only access to this portfolio.");

  const fields = mortgageFields(form);
  if (!fields.lender) return fail("Lender is required.");
  if (fields.interest_rate < 0 || fields.interest_rate > 100)
    return fail("Interest rate looks wrong — enter it as a percentage, e.g. 5.9");

  const { error } = mortgageId
    ? await ctx.supabase.from("mortgages").update(fields).eq("id", mortgageId)
    : await ctx.supabase
        .from("mortgages")
        .insert({ ...fields, workspace_id: ctx.workspace.id, property_id: propertyId });
  if (error) return fail(error.message);

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteMortgage(id: string, propertyId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("mortgages").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/dashboard");
  return ok();
}
