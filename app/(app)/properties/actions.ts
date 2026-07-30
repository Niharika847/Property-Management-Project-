"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, str, num, type ActionResult } from "@/lib/action-helpers";
import { todayISO } from "@/lib/format";
import { planFor, propertyLimitMessage } from "@/lib/plans";

function propertyFields(form: FormData) {
  return {
    address: str(form, "address"),
    suburb: str(form, "suburb") || "—",
    state: str(form, "state") || null,
    postcode: str(form, "postcode") || null,
    status: str(form, "status"),
    property_type: str(form, "property_type") || "house",
    bedrooms: num(form, "bedrooms"),
    bathrooms: num(form, "bathrooms"),
    parking: num(form, "parking"),
    purchase_price: num(form, "purchase_price"),
    purchase_date: str(form, "purchase_date") || null,
    current_value: num(form, "current_value"),
    valued_at: num(form, "current_value") ? todayISO() : null,
    notes: str(form, "notes") || null,
  };
}

export async function createProperty(form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  if (!ctx.workspace.canEdit) return fail("You have read-only access to this portfolio.");
  const fields = propertyFields(form);
  if (!fields.address) return fail("Address is required.");

  // Plan limit is enforced server-side, not just hidden in the UI.
  const [{ data: ws }, { count }] = await Promise.all([
    ctx.supabase.from("workspaces").select("plan").eq("id", ctx.workspace.id).maybeSingle(),
    ctx.supabase.from("properties").select("id", { count: "exact", head: true }),
  ]);
  const limit = propertyLimitMessage(planFor(ws?.plan as string | undefined), count ?? 0);
  if (limit) return fail(limit);

  const { data: property, error } = await ctx.supabase
    .from("properties")
    .insert({ ...fields, workspace_id: ctx.workspace.id })
    .select("id")
    .single();
  if (error || !property) return fail(error?.message ?? "Couldn't save the property.");

  // Optional lease at creation time (rental properties)
  const rent = num(form, "rent_amount");
  if (fields.status === "rental" && rent && rent > 0) {
    let tenantId: string | null = null;
    const tenantName = str(form, "tenant_name");
    if (tenantName) {
      const { data: tenant } = await ctx.supabase
        .from("tenants")
        .insert({ workspace_id: ctx.workspace.id, full_name: tenantName })
        .select("id")
        .single();
      tenantId = tenant?.id ?? null;
    }
    const { data: lease, error: leaseError } = await ctx.supabase
      .from("leases")
      .insert({
        workspace_id: ctx.workspace.id,
        property_id: property.id,
        tenant_id: tenantId,
        rent_amount: rent,
        frequency: str(form, "frequency") || "weekly",
        start_date: str(form, "lease_start") || todayISO(),
        bond_amount: num(form, "bond_amount"),
      })
      .select("id")
      .single();
    if (!leaseError && lease) {
      await ctx.supabase.rpc("generate_rent_charges", { p_lease_id: lease.id });
    }
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  return ok();
}

export async function updateProperty(id: string, form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const fields = propertyFields(form);
  if (!fields.address) return fail("Address is required.");

  // Don't clobber an existing valuation date unless the value changed
  const { data: current } = await ctx.supabase
    .from("properties")
    .select("current_value, valued_at")
    .eq("id", id)
    .single();
  if (current && current.current_value === fields.current_value) {
    fields.valued_at = current.valued_at;
  }

  const { error } = await ctx.supabase.from("properties").update(fields).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const { error } = await ctx.supabase.from("properties").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  return ok();
}

export async function addLease(propertyId: string, form: FormData): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const rent = num(form, "rent_amount");
  if (!rent || rent <= 0) return fail("Rent amount is required.");

  let tenantId: string | null = null;
  const tenantName = str(form, "tenant_name");
  if (tenantName) {
    const { data: tenant } = await ctx.supabase
      .from("tenants")
      .insert({ workspace_id: ctx.workspace.id, full_name: tenantName })
      .select("id")
      .single();
    tenantId = tenant?.id ?? null;
  }

  const { data: lease, error } = await ctx.supabase
    .from("leases")
    .insert({
      workspace_id: ctx.workspace.id,
      property_id: propertyId,
      tenant_id: tenantId,
      rent_amount: rent,
      frequency: str(form, "frequency") || "weekly",
      start_date: str(form, "lease_start") || todayISO(),
      bond_amount: num(form, "bond_amount"),
    })
    .select("id")
    .single();
  if (error || !lease) return fail(error?.message ?? "Couldn't create the lease.");

  await ctx.supabase.rpc("generate_rent_charges", { p_lease_id: lease.id });
  await ctx.supabase.from("properties").update({ status: "rental" }).eq("id", propertyId);

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}

export async function endLease(leaseId: string, propertyId: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  const { error } = await ctx.supabase
    .from("leases")
    .update({ status: "ended", end_date: todayISO() })
    .eq("id", leaseId);
  if (error) return fail(error.message);

  // Future expected charges no longer apply; history stays.
  await ctx.supabase
    .from("rent_charges")
    .delete()
    .eq("lease_id", leaseId)
    .eq("status", "expected")
    .gt("due_date", todayISO());
  await ctx.supabase.from("properties").update({ status: "vacant" }).eq("id", propertyId);

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return ok();
}
