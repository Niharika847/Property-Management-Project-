"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, str, num, type ActionResult } from "@/lib/action-helpers";

function expenseFields(form: FormData) {
  return {
    property_id: str(form, "property_id") || null,
    date: str(form, "date"),
    amount: num(form, "amount"),
    gst_amount: num(form, "gst_amount") ?? 0,
    category_id: str(form, "category_id"),
    vendor: str(form, "vendor") || null,
    description: str(form, "description"),
    payment_status: str(form, "payment_status") || "paid",
    is_tax_deductible: form.get("is_tax_deductible") === "on",
    notes: str(form, "notes") || null,
  };
}

function validate(f: ReturnType<typeof expenseFields>): string | null {
  if (!f.property_id) return "Pick a property.";
  if (!f.date) return "Date is required.";
  if (!f.amount || f.amount <= 0) return "Amount must be greater than zero.";
  if (!f.category_id) return "Pick a category.";
  if (!f.description) return "Add a short description.";
  if (f.gst_amount < 0 || f.gst_amount > f.amount)
    return "GST can't be negative or larger than the amount.";
  return null;
}

export async function createExpense(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const fields = expenseFields(form);
  const invalid = validate(fields);
  if (invalid) return fail(invalid);

  const documentId = str(form, "document_id") || null;

  const { data: expense, error } = await ctx.supabase
    .from("expenses")
    .insert({
      ...fields,
      workspace_id: ctx.workspace.id,
      source: documentId ? "receipt_ai" : "manual",
    })
    .select("id")
    .single();
  if (error || !expense) return fail(error?.message ?? "Couldn't save the expense.");

  // Link the source receipt to the expense it produced.
  if (documentId) {
    await ctx.supabase
      .from("documents")
      .update({ expense_id: expense.id, property_id: fields.property_id })
      .eq("id", documentId);
    revalidatePath("/documents");
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  if (fields.property_id) revalidatePath(`/properties/${fields.property_id}`);
  return ok();
}

export async function updateExpense(id: string, form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const fields = expenseFields(form);
  const invalid = validate(fields);
  if (invalid) return fail(invalid);

  const { error } = await ctx.supabase.from("expenses").update(fields).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  if (fields.property_id) revalidatePath(`/properties/${fields.property_id}`);
  return ok();
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("expenses").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return ok();
}
