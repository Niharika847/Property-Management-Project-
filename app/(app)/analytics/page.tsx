import { createClient } from "@/lib/supabase/server";
import { CashflowChart, type MonthPoint } from "@/components/dashboard/cashflow-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { aud, audCents, annualRent, fyRange } from "@/lib/format";
import { LineChart, TrendingUp, TrendingDown } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const fy = fyRange();

  // 12-month window
  const now = new Date();
  const buckets: (MonthPoint & { key: string; net: number })[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      income: 0,
      expenses: 0,
      net: 0,
    });
  }
  const windowStart = `${buckets[0].key}-01`;

  const [{ data: properties }, { data: leases }, { data: income }, { data: expenses }] =
    await Promise.all([
      supabase.from("properties").select("id, address, suburb, status, current_value"),
      supabase.from("leases").select("property_id, rent_amount, frequency").eq("status", "active"),
      supabase.from("income").select("date, amount, property_id").gte("date", windowStart),
      supabase
        .from("expenses")
        .select("date, amount, gst_amount, is_tax_deductible, property_id, categories ( name )")
        .gte("date", windowStart),
    ]);

  const props = properties ?? [];
  if (props.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header fyLabel={fy.label} />
        <EmptyState
          icon={LineChart}
          title="Nothing to analyze yet"
          body="Add a property and start tracking income and expenses — your trends, comparisons and forecasts appear here."
        />
      </div>
    );
  }

  const incomeRows = income ?? [];
  const expenseRows = expenses ?? [];

  // 12-month buckets
  for (const r of incomeRows) {
    const b = buckets.find((x) => x.key === (r.date as string).slice(0, 7));
    if (b) b.income += Number(r.amount);
  }
  for (const r of expenseRows) {
    const b = buckets.find((x) => x.key === (r.date as string).slice(0, 7));
    if (b) b.expenses += Number(r.amount);
  }
  for (const b of buckets) b.net = b.income - b.expenses;

  // FY figures
  const inFy = (d: string) => d >= fy.start && d <= fy.end;
  const fyIncomeRows = incomeRows.filter((r) => inFy(r.date as string));
  const fyExpenseRows = expenseRows.filter((r) => inFy(r.date as string));
  const fyIncome = fyIncomeRows.reduce((s, r) => s + Number(r.amount), 0);
  const fyExpenses = fyExpenseRows.reduce((s, r) => s + Number(r.amount), 0);
  const fyGst = fyExpenseRows.reduce((s, r) => s + Number(r.gst_amount), 0);
  const fyDeductible = fyExpenseRows
    .filter((r) => r.is_tax_deductible)
    .reduce((s, r) => s + Number(r.amount), 0);
  const monthsElapsed = buckets.filter((b) => b.key >= fy.start.slice(0, 7)).length || 1;
  const avgMonthly = (fyIncome - fyExpenses) / monthsElapsed;

  const stats = [
    { label: `Income ${fy.label}`, value: audCents(fyIncome), tone: "text-ink" },
    { label: `Expenses ${fy.label}`, value: audCents(fyExpenses), tone: "text-ink" },
    {
      label: `Net ${fy.label}`,
      value: audCents(fyIncome - fyExpenses),
      tone: fyIncome - fyExpenses >= 0 ? "text-brand" : "text-terra",
    },
    { label: "Avg cash flow / mo", value: audCents(avgMonthly), tone: avgMonthly >= 0 ? "text-brand" : "text-terra" },
    { label: `GST paid ${fy.label}`, value: audCents(fyGst), tone: "text-ink" },
    { label: "Tax deductible", value: audCents(fyDeductible), tone: "text-ink" },
  ];

  // Expense categories FYTD
  const byCategory = new Map<string, number>();
  for (const r of fyExpenseRows) {
    const name = (r.categories as unknown as { name: string } | null)?.name ?? "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(r.amount));
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryMax = Math.max(1, ...categoryRows.map(([, v]) => v));

  // Per-property performance FYTD
  const leaseBy = new Map((leases ?? []).map((l) => [l.property_id, l]));
  const incBy = new Map<string, number>();
  for (const r of fyIncomeRows) incBy.set(r.property_id as string, (incBy.get(r.property_id as string) ?? 0) + Number(r.amount));
  const expBy = new Map<string, number>();
  for (const r of fyExpenseRows) {
    const pid = r.property_id as string | null;
    if (pid) expBy.set(pid, (expBy.get(pid) ?? 0) + Number(r.amount));
  }
  const perf = props
    .map((p) => {
      const lease = leaseBy.get(p.id);
      const fyInc = incBy.get(p.id) ?? 0;
      const fyExp = expBy.get(p.id) ?? 0;
      const grossYield =
        lease && p.current_value
          ? (annualRent(Number(lease.rent_amount), lease.frequency) / Number(p.current_value)) * 100
          : null;
      return { ...p, fyInc, fyExp, net: fyInc - fyExp, grossYield };
    })
    .sort((a, b) => b.net - a.net);
  const best = perf.length > 1 ? perf[0] : null;
  const worst = perf.length > 1 ? perf[perf.length - 1] : null;
  const netMax = Math.max(1, ...perf.map((p) => Math.abs(p.net)));

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <Header fyLabel={fy.label} />

      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-(--radius-card) border border-line bg-card p-3">
            <div className="text-xs text-muted">{s.label}</div>
            <div className={`num mt-1 text-lg font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <div className="mb-3 flex shrink-0 items-baseline justify-between">
          <h2 className="text-base font-semibold text-ink">Cash flow — last 12 months</h2>
          <span className="text-xs text-muted">rent in vs expenses out</span>
        </div>
        <CashflowChart data={buckets} />
      </section>

      <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
        <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-4 lg:min-h-0 lg:overflow-hidden">
          <div className="mb-3 flex shrink-0 items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Expense categories</h2>
            <span className="text-xs text-muted">{fy.label}</span>
          </div>
          {categoryRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No expenses this financial year yet.</p>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto lg:min-h-0 lg:flex-1">
              {categoryRows.map(([name, value]) => (
                <div key={name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink">{name}</span>
                    <span className="num text-ink">
                      {audCents(value)}
                      <span className="ml-2 text-xs text-muted">
                        {Math.round((value / fyExpenses) * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-code-bg">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(value / categoryMax) * 100}%`, background: "var(--terra)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-4 lg:min-h-0 lg:overflow-hidden">
          <div className="mb-3 flex shrink-0 items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Property performance</h2>
            <span className="text-xs text-muted">net {fy.label}</span>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto lg:min-h-0 lg:flex-1">
            {perf.map((p) => (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-ink">{p.address}</span>
                    {best && p.id === best.id && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand">
                        <TrendingUp className="size-3" aria-hidden /> Top
                      </span>
                    )}
                    {worst && p.id === worst.id && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-terra-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-terra">
                        <TrendingDown className="size-3" aria-hidden /> Lowest
                      </span>
                    )}
                  </div>
                  <span className={`num shrink-0 font-semibold ${p.net >= 0 ? "text-brand" : "text-terra"}`}>
                    {p.net >= 0 ? aud(p.net) : `-${aud(Math.abs(p.net))}`}
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 items-center gap-2">
                  <div className="h-full flex-1 overflow-hidden rounded-full bg-code-bg">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Math.abs(p.net) / netMax) * 100}%`,
                        background: p.net >= 0 ? "var(--brand)" : "var(--terra)",
                      }}
                    />
                  </div>
                  <span className="num w-12 shrink-0 text-right text-xs text-muted">
                    {p.grossYield != null ? `${p.grossYield.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({ fyLabel }: { fyLabel: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Trends, comparisons and performance across your portfolio · {fyLabel}
      </p>
    </div>
  );
}
