import type { SupabaseClient } from "@supabase/supabase-js";
import { fyRange, monthRange, annualRent, todayISO } from "@/lib/format";

/** Whitelisted, workspace-scoped tools the assistant may call. The model never
 *  writes SQL — it picks a tool and parameters; we run the parameterized query
 *  against the user's own (RLS-protected) ledger. Design spec §9. */
export const ASSISTANT_TOOLS = [
  {
    name: "get_overview",
    description:
      "Portfolio-wide snapshot: property counts by status, total value, rent per week/month/year, and this financial year's income, expenses, net cash flow, and outstanding rent. Use for questions about overall position, cash flow, or 'how am I doing'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_properties",
    description:
      "Per-property breakdown: address, status, current value, monthly rent, and this financial year's income, expenses and net. Use to compare properties (best/worst performer, which costs the most, which is vacant).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sum_expenses",
    description:
      "Total expenses for a period, with a breakdown by category and the tax-deductible portion. Use for questions like 'how much did I spend on maintenance this year' or 'what are my expenses this month'.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "last_month", "this_fy", "last_fy", "all"],
          description: "Time window. Australian financial year runs 1 July–30 June. Defaults to this_fy.",
        },
        category: { type: "string", description: "Optional category filter, matched loosely (e.g. 'maintenance', 'insurance')." },
        property_address: { type: "string", description: "Optional property filter, matched loosely against the address." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "sum_income",
    description: "Total income (rent + other) for a period, optionally for one property.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["this_month", "last_month", "this_fy", "last_fy", "all"] },
        property_address: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "rent_status",
    description:
      "Current rent collection status: total outstanding, the list of overdue payments (property, tenant, amount, due date), and how many upcoming charges are scheduled.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

export const TOOL_LABELS: Record<string, string> = {
  get_overview: "Portfolio overview",
  list_properties: "All properties",
  sum_expenses: "Expenses",
  sum_income: "Income",
  rent_status: "Rent status",
};

interface Range {
  start: string;
  end: string;
  label: string;
}

function periodRange(period?: string): Range {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { ...monthRange(now), label: "this month" };
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { ...monthRange(d), label: "last month" };
    }
    case "last_fy": {
      const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const r = fyRange(d);
      return { start: r.start, end: r.end, label: r.label };
    }
    case "all":
      return { start: "1900-01-01", end: "2999-12-31", label: "all time" };
    default: {
      const r = fyRange(now);
      return { start: r.start, end: r.end, label: r.label };
    }
  }
}

const like = (hay: string | null | undefined, needle: string) =>
  (hay ?? "").toLowerCase().includes(needle.toLowerCase());

type Input = Record<string, unknown>;

export async function runAssistantTool(
  name: string,
  input: Input,
  supabase: SupabaseClient,
  workspaceId: string
): Promise<unknown> {
  const fy = fyRange();

  if (name === "get_overview") {
    const [{ data: properties }, { data: leases }, { data: income }, { data: expenses }, { data: overdue }] =
      await Promise.all([
        supabase.from("properties").select("status, current_value").eq("workspace_id", workspaceId),
        supabase.from("leases").select("rent_amount, frequency").eq("workspace_id", workspaceId).eq("status", "active"),
        supabase.from("income").select("amount").eq("workspace_id", workspaceId).gte("date", fy.start).lte("date", fy.end),
        supabase.from("expenses").select("amount").eq("workspace_id", workspaceId).gte("date", fy.start).lte("date", fy.end),
        supabase.from("rent_charges").select("amount").eq("workspace_id", workspaceId).eq("status", "expected").lte("due_date", todayISO()),
      ]);
    const props = properties ?? [];
    const annualRentTotal = (leases ?? []).reduce((s, l) => s + annualRent(Number(l.rent_amount), l.frequency), 0);
    const fyIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const fyExpenses = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const countBy = (st: string) => props.filter((p) => p.status === st).length;
    return {
      currency: "AUD",
      financial_year: fy.label,
      properties: {
        total: props.length,
        rented: countBy("rental"),
        vacant: countBy("vacant"),
        owner_occupied: countBy("owner_occupied"),
        sold: countBy("sold"),
      },
      portfolio_value: props.reduce((s, p) => s + Number(p.current_value ?? 0), 0),
      rent_per_week: Math.round(annualRentTotal / 52),
      rent_per_month: Math.round(annualRentTotal / 12),
      rent_per_year: annualRentTotal,
      fy_income: fyIncome,
      fy_expenses: fyExpenses,
      fy_net_cashflow: fyIncome - fyExpenses,
      outstanding_rent: (overdue ?? []).reduce((s, r) => s + Number(r.amount), 0),
    };
  }

  if (name === "list_properties") {
    const [{ data: properties }, { data: leases }, { data: income }, { data: expenses }] = await Promise.all([
      supabase.from("properties").select("id, address, suburb, status, current_value, purchase_price").eq("workspace_id", workspaceId),
      supabase.from("leases").select("property_id, rent_amount, frequency").eq("workspace_id", workspaceId).eq("status", "active"),
      supabase.from("income").select("property_id, amount").eq("workspace_id", workspaceId).gte("date", fy.start).lte("date", fy.end),
      supabase.from("expenses").select("property_id, amount").eq("workspace_id", workspaceId).gte("date", fy.start).lte("date", fy.end),
    ]);
    const leaseBy = new Map((leases ?? []).map((l) => [l.property_id, l]));
    const incBy = new Map<string, number>();
    for (const r of income ?? []) incBy.set(r.property_id, (incBy.get(r.property_id) ?? 0) + Number(r.amount));
    const expBy = new Map<string, number>();
    for (const r of expenses ?? []) if (r.property_id) expBy.set(r.property_id, (expBy.get(r.property_id) ?? 0) + Number(r.amount));
    return {
      currency: "AUD",
      financial_year: fy.label,
      properties: (properties ?? []).map((p) => {
        const lease = leaseBy.get(p.id);
        const fyInc = incBy.get(p.id) ?? 0;
        const fyExp = expBy.get(p.id) ?? 0;
        return {
          address: p.address,
          suburb: p.suburb,
          status: p.status,
          current_value: p.current_value,
          purchase_price: p.purchase_price,
          rent_per_month: lease ? Math.round(annualRent(Number(lease.rent_amount), lease.frequency) / 12) : 0,
          fy_income: fyInc,
          fy_expenses: fyExp,
          fy_net: fyInc - fyExp,
        };
      }),
    };
  }

  if (name === "sum_expenses") {
    const range = periodRange(input.period as string | undefined);
    const { data } = await supabase
      .from("expenses")
      .select("amount, gst_amount, is_tax_deductible, categories ( name ), properties ( address )")
      .eq("workspace_id", workspaceId)
      .gte("date", range.start)
      .lte("date", range.end);
    let rows = (data ?? []) as unknown as {
      amount: number;
      gst_amount: number;
      is_tax_deductible: boolean;
      categories: { name: string } | null;
      properties: { address: string } | null;
    }[];
    if (input.category) rows = rows.filter((r) => like(r.categories?.name, input.category as string));
    if (input.property_address) rows = rows.filter((r) => like(r.properties?.address, input.property_address as string));
    const byCat = new Map<string, number>();
    for (const r of rows) byCat.set(r.categories?.name ?? "Other", (byCat.get(r.categories?.name ?? "Other") ?? 0) + Number(r.amount));
    return {
      currency: "AUD",
      period: range.label,
      total: rows.reduce((s, r) => s + Number(r.amount), 0),
      count: rows.length,
      gst_total: rows.reduce((s, r) => s + Number(r.gst_amount), 0),
      deductible_total: rows.filter((r) => r.is_tax_deductible).reduce((s, r) => s + Number(r.amount), 0),
      by_category: [...byCat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
    };
  }

  if (name === "sum_income") {
    const range = periodRange(input.period as string | undefined);
    const { data } = await supabase
      .from("income")
      .select("amount, type, properties ( address )")
      .eq("workspace_id", workspaceId)
      .gte("date", range.start)
      .lte("date", range.end);
    let rows = (data ?? []) as unknown as { amount: number; type: string; properties: { address: string } | null }[];
    if (input.property_address) rows = rows.filter((r) => like(r.properties?.address, input.property_address as string));
    return {
      currency: "AUD",
      period: range.label,
      total: rows.reduce((s, r) => s + Number(r.amount), 0),
      count: rows.length,
      rent_total: rows.filter((r) => r.type === "rent").reduce((s, r) => s + Number(r.amount), 0),
    };
  }

  if (name === "rent_status") {
    const { data } = await supabase
      .from("rent_charges")
      .select("amount, due_date, leases ( properties ( address ), tenants ( full_name ) )")
      .eq("workspace_id", workspaceId)
      .eq("status", "expected")
      .lte("due_date", todayISO())
      .order("due_date");
    const overdue = ((data ?? []) as unknown as {
      amount: number;
      due_date: string;
      leases: { properties: { address: string } | null; tenants: { full_name: string } | null } | null;
    }[]).map((c) => ({
      property: c.leases?.properties?.address ?? "Unknown",
      tenant: c.leases?.tenants?.full_name ?? null,
      amount: Number(c.amount),
      due_date: c.due_date,
    }));
    const { count: upcoming } = await supabase
      .from("rent_charges")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "expected")
      .gt("due_date", todayISO());
    return {
      currency: "AUD",
      outstanding_total: overdue.reduce((s, o) => s + o.amount, 0),
      overdue,
      upcoming_scheduled: upcoming ?? 0,
    };
  }

  return { error: `Unknown tool: ${name}` };
}
