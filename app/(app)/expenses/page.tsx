import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { ExpensesView } from "@/components/expenses/expenses-view";
import { RecurringPanel, type RecurringRule } from "@/components/expenses/recurring-panel";
import { fyRange } from "@/lib/format";
import type { Category, Expense, Property } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await ensureWorkspace(supabase, user);
  const fy = fyRange();

  // Catch up any recurring bills that have fallen due since the last visit.
  let generated = 0;
  if (workspace?.canEdit) {
    const { data } = await supabase.rpc("run_recurring_rules", { p_workspace: workspace.id });
    generated = typeof data === "number" ? data : 0;
  }

  let query = supabase
    .from("expenses")
    .select("*, categories ( name ), properties ( address )")
    .order("date", { ascending: false })
    .limit(200);
  if (property) query = query.eq("property_id", property);

  const [{ data: expenses }, { data: properties }, { data: categories }, { data: rules }] =
    await Promise.all([
      query,
      supabase.from("properties").select("id, address").order("address"),
      supabase
        .from("categories")
        .select("id, name, kind, tax_deductible_default, is_capital")
        .eq("kind", "expense")
        .order("name"),
      supabase
        .from("recurring_rules")
        .select("id, description, vendor, amount, frequency, next_run_date, active, categories ( name ), properties ( address )")
        .order("next_run_date"),
    ]);

  const rows = (expenses ?? []) as Expense[];
  const fyRows = rows.filter((e) => e.date >= fy.start && e.date <= fy.end);
  const totalFY = fyRows.reduce((s, e) => s + Number(e.amount), 0);
  const gstFY = fyRows.reduce((s, e) => s + Number(e.gst_amount), 0);
  const propertyList = (properties ?? []) as Pick<Property, "id" | "address">[];
  const categoryList = (categories ?? []) as Category[];

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <ExpensesView
        expenses={rows}
        properties={propertyList}
        categories={categoryList}
        totalFY={totalFY}
        gstFY={gstFY}
        fyLabel={fy.label}
        activeProperty={property ?? ""}
      />
      <RecurringPanel
        rules={(rules ?? []) as unknown as RecurringRule[]}
        properties={propertyList}
        categories={categoryList}
        canEdit={workspace?.canEdit ?? false}
        generated={generated}
      />
    </div>
  );
}
