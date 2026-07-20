"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, str, num, type ActionResult } from "@/lib/action-helpers";
import { todayISO } from "@/lib/format";

export async function markRentPaid(chargeId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  const { data: charge } = await ctx.supabase
    .from("rent_charges")
    .select("id, amount, status, due_date, leases ( property_id )")
    .eq("id", chargeId)
    .maybeSingle();
  if (!charge) return fail("That rent charge no longer exists.");
  if (charge.status === "paid") return ok();

  const { error } = await ctx.supabase
    .from("rent_charges")
    .update({
      status: "paid",
      paid_amount: charge.amount,
      paid_at: new Date().toISOString(),
    })
    .eq("id", chargeId);
  if (error) return fail(error.message);

  const propertyId = (charge.leases as unknown as { property_id: string } | null)?.property_id;
  if (propertyId) {
    await ctx.supabase.from("income").insert({
      workspace_id: ctx.workspace.id,
      property_id: propertyId,
      rent_charge_id: chargeId,
      type: "rent",
      date: todayISO(),
      amount: charge.amount,
      description: `Rent due ${charge.due_date}`,
    });
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}

export async function waiveRentCharge(chargeId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase
    .from("rent_charges")
    .update({ status: "waived" })
    .eq("id", chargeId);
  if (error) return fail(error.message);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}

export async function addOtherIncome(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const propertyId = str(form, "property_id");
  const amount = num(form, "amount");
  const description = str(form, "description");
  if (!propertyId) return fail("Pick a property.");
  if (!amount || amount <= 0) return fail("Amount must be greater than zero.");
  if (!description) return fail("Add a short description.");

  const { error } = await ctx.supabase.from("income").insert({
    workspace_id: ctx.workspace.id,
    property_id: propertyId,
    type: "other",
    date: str(form, "date") || todayISO(),
    amount,
    description,
  });
  if (error) return fail(error.message);

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  // If this payment settled a rent charge, reopen the charge.
  const { data: row } = await ctx.supabase
    .from("income")
    .select("rent_charge_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await ctx.supabase.from("income").delete().eq("id", id);
  if (error) return fail(error.message);
  if (row?.rent_charge_id) {
    await ctx.supabase
      .from("rent_charges")
      .update({ status: "expected", paid_amount: null, paid_at: null })
      .eq("id", row.rent_charge_id);
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}
