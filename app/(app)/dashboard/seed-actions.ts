"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, type ActionResult } from "@/lib/action-helpers";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthsAgo = (n: number, day = 12) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, day);
};

/** Fills an empty workspace with a realistic demo portfolio so every screen
 *  (dashboard, analytics, reports, search) has something to show. */
export async function seedSampleData(): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");
  const wid = ctx.workspace.id;

  const { count } = await ctx.supabase
    .from("properties")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return fail("You already have properties — sample data is only for an empty portfolio.");

  const { data: cats } = await ctx.supabase
    .from("categories")
    .select("id, name")
    .eq("kind", "expense");
  const catId = (name: string) =>
    cats?.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))?.id ??
    cats?.find((c) => c.name === "Other")?.id ??
    null;

  // ── Properties ────────────────────────────────────────────────────────
  const { data: properties, error: pErr } = await ctx.supabase
    .from("properties")
    .insert([
      {
        workspace_id: wid,
        address: "42 Marine Parade",
        suburb: "St Kilda",
        state: "VIC",
        postcode: "3182",
        status: "rental",
        property_type: "apartment",
        bedrooms: 2,
        bathrooms: 1,
        parking: 1,
        purchase_price: 720000,
        purchase_date: "2021-03-18",
        current_value: 865000,
        valued_at: iso(new Date()),
      },
      {
        workspace_id: wid,
        address: "18 Ashwood Grove",
        suburb: "Burwood",
        state: "VIC",
        postcode: "3125",
        status: "rental",
        property_type: "house",
        bedrooms: 3,
        bathrooms: 2,
        parking: 2,
        purchase_price: 640000,
        purchase_date: "2019-09-02",
        current_value: 812000,
        valued_at: iso(new Date()),
      },
      {
        workspace_id: wid,
        address: "7/210 Barkly Street",
        suburb: "Footscray",
        state: "VIC",
        postcode: "3011",
        status: "vacant",
        property_type: "unit",
        bedrooms: 1,
        bathrooms: 1,
        parking: 0,
        purchase_price: 415000,
        purchase_date: "2022-11-25",
        current_value: 452000,
        valued_at: iso(new Date()),
      },
    ])
    .select("id, address");
  if (pErr || !properties) return fail(pErr?.message ?? "Couldn't create sample properties.");

  const byAddress = (a: string) => properties.find((p) => p.address === a)!.id;
  const marine = byAddress("42 Marine Parade");
  const ashwood = byAddress("18 Ashwood Grove");
  const barkly = byAddress("7/210 Barkly Street");

  // ── Tenants + leases ──────────────────────────────────────────────────
  const { data: tenants } = await ctx.supabase
    .from("tenants")
    .insert([
      { workspace_id: wid, full_name: "Jordan Blake", email: "jordan.blake@example.com" },
      { workspace_id: wid, full_name: "Priya Raman", email: "priya.raman@example.com" },
    ])
    .select("id, full_name");

  const tenantId = (n: string) => tenants?.find((t) => t.full_name === n)?.id ?? null;

  const { data: leases } = await ctx.supabase
    .from("leases")
    .insert([
      {
        workspace_id: wid,
        property_id: marine,
        tenant_id: tenantId("Jordan Blake"),
        rent_amount: 650,
        frequency: "weekly",
        start_date: iso(monthsAgo(14, 1)),
        bond_amount: 2600,
        status: "active",
      },
      {
        workspace_id: wid,
        property_id: ashwood,
        tenant_id: tenantId("Priya Raman"),
        rent_amount: 520,
        frequency: "weekly",
        start_date: iso(monthsAgo(9, 1)),
        bond_amount: 2080,
        status: "active",
      },
    ])
    .select("id, property_id");

  for (const l of leases ?? []) {
    await ctx.supabase.rpc("generate_rent_charges", { p_lease_id: l.id });
  }

  // ── Income: 6 months of rent received ─────────────────────────────────
  const incomeRows: Record<string, unknown>[] = [];
  for (let m = 5; m >= 0; m--) {
    incomeRows.push({
      workspace_id: wid,
      property_id: marine,
      type: "rent",
      date: iso(monthsAgo(m, 3)),
      amount: 2817,
      description: "Monthly rent — 42 Marine Parade",
    });
    incomeRows.push({
      workspace_id: wid,
      property_id: ashwood,
      type: "rent",
      date: iso(monthsAgo(m, 5)),
      amount: 2253,
      description: "Monthly rent — 18 Ashwood Grove",
    });
  }
  await ctx.supabase.from("income").insert(incomeRows);

  // ── Expenses: spread across categories and months ─────────────────────
  const e = (
    property_id: string,
    m: number,
    day: number,
    amount: number,
    category: string,
    description: string,
    vendor: string,
    gst = true
  ) => ({
    workspace_id: wid,
    property_id,
    date: iso(monthsAgo(m, day)),
    amount,
    gst_amount: gst ? Number((amount / 11).toFixed(2)) : 0,
    category_id: catId(category),
    vendor,
    description,
    payment_status: "paid",
    is_tax_deductible: true,
    source: "manual",
  });

  await ctx.supabase.from("expenses").insert([
    e(marine, 5, 8, 486, "Council rates", "Quarterly council rates", "Port Phillip Council", false),
    e(marine, 4, 14, 240, "Repairs", "Leaking kitchen tap", "Reece Plumbing"),
    e(marine, 3, 21, 132, "Body corporate", "Owners corporation levy", "Strata Plus", false),
    e(marine, 2, 9, 118, "Insurance", "Landlord insurance instalment", "EBM RentCover", false),
    e(marine, 1, 17, 320, "Cleaning", "End of lease clean", "Sparkle Co"),
    e(marine, 0, 6, 410, "Council rates", "Quarterly council rates", "Port Phillip Council", false),
    e(ashwood, 5, 11, 189, "Gardening", "Lawn and hedge maintenance", "GreenLeaf Gardens"),
    e(ashwood, 4, 19, 1450, "Repairs", "Hot water system replacement", "Metro Plumbing"),
    e(ashwood, 3, 7, 96, "Water", "Water usage charge", "Yarra Valley Water", false),
    e(ashwood, 2, 23, 275, "Property agent", "Monthly management fee", "Ray White"),
    e(ashwood, 1, 12, 640, "Insurance", "Building insurance", "Allianz", false),
    e(ashwood, 0, 15, 189, "Gardening", "Lawn and hedge maintenance", "GreenLeaf Gardens"),
    e(barkly, 3, 16, 310, "Repairs", "Repaint hallway before listing", "Coat & Co"),
    e(barkly, 1, 4, 220, "Advertising", "Rental listing campaign", "realestate.com.au"),
    e(barkly, 0, 10, 145, "Body corporate", "Owners corporation levy", "Strata Plus", false),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/expenses");
  revalidatePath("/income");
  revalidatePath("/analytics");
  revalidatePath("/reports");
  return ok();
}
