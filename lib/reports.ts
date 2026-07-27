import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportExpense {
  date: string;
  amount: number;
  gst_amount: number;
  is_tax_deductible: boolean;
  description: string;
  vendor: string | null;
  category: string;
  property: string;
}

export interface ReportIncome {
  date: string;
  amount: number;
  type: string;
  description: string | null;
  property: string;
}

export interface ReportData {
  expenses: ReportExpense[];
  income: ReportIncome[];
}

/** Fetches the income + expense rows for a report selection, workspace-scoped. */
export async function fetchReport(
  supabase: SupabaseClient,
  workspaceId: string,
  range: { start: string; end: string },
  propertyId?: string
): Promise<ReportData> {
  let expQ = supabase
    .from("expenses")
    .select("date, amount, gst_amount, is_tax_deductible, description, vendor, categories ( name ), properties ( address )")
    .eq("workspace_id", workspaceId)
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date");
  let incQ = supabase
    .from("income")
    .select("date, amount, type, description, properties ( address )")
    .eq("workspace_id", workspaceId)
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date");

  if (propertyId && propertyId !== "all") {
    expQ = expQ.eq("property_id", propertyId);
    incQ = incQ.eq("property_id", propertyId);
  }

  const [{ data: exp }, { data: inc }] = await Promise.all([expQ, incQ]);

  const expenses: ReportExpense[] = (exp ?? []).map((e) => ({
    date: e.date as string,
    amount: Number(e.amount),
    gst_amount: Number(e.gst_amount),
    is_tax_deductible: !!e.is_tax_deductible,
    description: (e.description as string) ?? "",
    vendor: (e.vendor as string) ?? null,
    category: (e.categories as unknown as { name: string } | null)?.name ?? "Other",
    property: (e.properties as unknown as { address: string } | null)?.address ?? "—",
  }));
  const income: ReportIncome[] = (inc ?? []).map((r) => ({
    date: r.date as string,
    amount: Number(r.amount),
    type: (r.type as string) ?? "other",
    description: (r.description as string) ?? null,
    property: (r.properties as unknown as { address: string } | null)?.address ?? "—",
  }));

  return { expenses, income };
}

export interface CategoryTotal {
  category: string;
  total: number;
  gst: number;
  deductible: number;
}

export function summarize(data: ReportData) {
  const incomeTotal = data.income.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = data.expenses.reduce((s, r) => s + r.amount, 0);
  const gstTotal = data.expenses.reduce((s, r) => s + r.gst_amount, 0);
  const deductibleTotal = data.expenses
    .filter((e) => e.is_tax_deductible)
    .reduce((s, r) => s + r.amount, 0);

  const byCat = new Map<string, CategoryTotal>();
  for (const e of data.expenses) {
    const c = byCat.get(e.category) ?? { category: e.category, total: 0, gst: 0, deductible: 0 };
    c.total += e.amount;
    c.gst += e.gst_amount;
    if (e.is_tax_deductible) c.deductible += e.amount;
    byCat.set(e.category, c);
  }
  const categories = [...byCat.values()].sort((a, b) => b.total - a.total);

  return { incomeTotal, expenseTotal, gstTotal, deductibleTotal, net: incomeTotal - expenseTotal, categories };
}
