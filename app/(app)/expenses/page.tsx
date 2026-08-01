import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { ExpensesView } from "@/components/expenses/expenses-view";
import { RecurringPanel, type RecurringRule } from "@/components/expenses/recurring-panel";
import { fyRange } from "@/lib/format";
import { pageInfo, parsePage } from "@/lib/pagination";
import type { Category, Expense, Property } from "@/lib/types";
import { redirect } from "next/navigation";

/** Rows per page. The ledger has to stay complete for tax time, so the list
 *  pages through the whole history rather than truncating it. */
const PAGE_SIZE = 50;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; page?: string }>;
}) {
  const { property, page: pageParam } = await searchParams;
  const requestedPage = parsePage(pageParam);
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

  // Count first so an out-of-range ?page= clamps to the last real page
  // instead of rendering an empty table.
  let countQuery = supabase.from("expenses").select("id", { count: "exact", head: true });
  if (property) countQuery = countQuery.eq("property_id", property);
  const { count: totalCount } = await countQuery;
  const { page, pageCount, from, to } = pageInfo(requestedPage, PAGE_SIZE, totalCount ?? 0);

  let query = supabase
    .from("expenses")
    .select("*, categories ( name ), properties ( address )")
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (property) query = query.eq("property_id", property);

  // Financial-year totals have to cover every expense in the year, not just the
  // page on screen, so they are summed from a separate lightweight query.
  let totalsQuery = supabase
    .from("expenses")
    .select("amount, gst_amount")
    .gte("date", fy.start)
    .lte("date", fy.end);
  if (property) totalsQuery = totalsQuery.eq("property_id", property);

  const [
    { data: expenses },
    { data: fyRows },
    { data: properties },
    { data: categories },
    { data: rules },
  ] = await Promise.all([
      query,
      totalsQuery,
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
  const totals = (fyRows ?? []) as Pick<Expense, "amount" | "gst_amount">[];
  const totalFY = totals.reduce((s, e) => s + Number(e.amount), 0);
  const gstFY = totals.reduce((s, e) => s + Number(e.gst_amount), 0);
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
        page={page}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        totalCount={totalCount ?? rows.length}
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
