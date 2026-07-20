import { createClient } from "@/lib/supabase/server";
import { ExpensesView } from "@/components/expenses/expenses-view";
import { fyRange } from "@/lib/format";
import type { Category, Expense, Property } from "@/lib/types";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property } = await searchParams;
  const supabase = await createClient();
  const fy = fyRange();

  let query = supabase
    .from("expenses")
    .select("*, categories ( name ), properties ( address )")
    .order("date", { ascending: false })
    .limit(200);
  if (property) query = query.eq("property_id", property);

  const [{ data: expenses }, { data: properties }, { data: categories }] = await Promise.all([
    query,
    supabase.from("properties").select("id, address").order("address"),
    supabase
      .from("categories")
      .select("id, name, kind, tax_deductible_default, is_capital")
      .eq("kind", "expense")
      .order("name"),
  ]);

  const rows = (expenses ?? []) as Expense[];
  const fyRows = rows.filter((e) => e.date >= fy.start && e.date <= fy.end);
  const totalFY = fyRows.reduce((s, e) => s + Number(e.amount), 0);
  const gstFY = fyRows.reduce((s, e) => s + Number(e.gst_amount), 0);

  return (
    <ExpensesView
      expenses={rows}
      properties={(properties ?? []) as Pick<Property, "id" | "address">[]}
      categories={(categories ?? []) as Category[]}
      totalFY={totalFY}
      gstFY={gstFY}
      fyLabel={fy.label}
      activeProperty={property ?? ""}
    />
  );
}
