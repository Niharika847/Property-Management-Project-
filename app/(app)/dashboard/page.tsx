import { createClient } from "@/lib/supabase/server";
import { AskBar } from "@/components/dashboard/ask-bar";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { CashflowChart, type MonthPoint } from "@/components/dashboard/cashflow-chart";
import { SeedButton } from "@/components/dashboard/seed-button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  aud,
  audCents,
  annualRent,
  fmtDate,
  monthRange,
  FREQUENCY_LABEL,
  ANNUAL_FACTOR,
} from "@/lib/format";
import {
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Home,
  Plus,
} from "lucide-react";
import Link from "next/link";

const WEEKS_PER_MONTH = 52 / 12;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam === "week" ? "week" : "month";
  const supabase = await createClient();
  const month = monthRange();

  // Six-month window
  const now = new Date();
  const buckets: (MonthPoint & { key: string })[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      income: 0,
      expenses: 0,
    });
  }
  const windowStart = `${buckets[0].key}-01`;

  const [
    { data: properties },
    { data: leases },
    { data: incomeRows },
    { data: expenseRows },
    { data: mortgages },
  ] = await Promise.all([
    supabase.from("properties").select("id, address, suburb, status, current_value").order("created_at"),
    supabase.from("leases").select("property_id, rent_amount, frequency").eq("status", "active"),
    supabase.from("income").select("date, amount, property_id").gte("date", windowStart),
    supabase
      .from("expenses")
      .select("date, amount, property_id, description, categories ( name ), properties ( address )")
      .gte("date", windowStart)
      .order("date", { ascending: false }),
    supabase.from("mortgages").select("property_id, repayment_amount, frequency"),
  ]);

  const props = properties ?? [];
  const activeLeases = leases ?? [];
  const income = incomeRows ?? [];
  const expenses = expenseRows ?? [];

  // Bucket the 6-month series
  for (const r of income) {
    const b = buckets.find((x) => x.key === (r.date as string).slice(0, 7));
    if (b) b.income += Number(r.amount);
  }
  for (const r of expenses) {
    const b = buckets.find((x) => x.key === (r.date as string).slice(0, 7));
    if (b) b.expenses += Number(r.amount);
  }

  // KPIs
  const annualRentTotal = activeLeases.reduce(
    (s, l) => s + annualRent(Number(l.rent_amount), l.frequency),
    0
  );
  const rentPerPeriod = period === "week" ? annualRentTotal / 52 : annualRentTotal / 12;
  const tenanted = activeLeases.length;

  const monthExpenses = expenses
    .filter((r) => (r.date as string) >= month.start && (r.date as string) <= month.end)
    .reduce((s, r) => s + Number(r.amount), 0);
  const monthExpenseCount = expenses.filter(
    (r) => (r.date as string) >= month.start && (r.date as string) <= month.end
  ).length;
  const expensesPerPeriod = period === "week" ? monthExpenses / WEEKS_PER_MONTH : monthExpenses;

  // Loan repayments are real cash out even though only the interest portion is a
  // deductible expense, so the headline cash flow must include them.
  const mortgageMonthly = (mortgages ?? []).reduce(
    (s, m) => s + (Number(m.repayment_amount) * (ANNUAL_FACTOR[m.frequency] ?? 12)) / 12,
    0
  );
  const mortgagePerPeriod = period === "week" ? mortgageMonthly / WEEKS_PER_MONTH : mortgageMonthly;
  const net = rentPerPeriod - expensesPerPeriod - mortgagePerPeriod;
  const rented = props.filter((p) => p.status === "rental").length;
  const vacant = props.filter((p) => p.status === "vacant").length;

  const periodWord = period === "week" ? "week" : "month";

  const kpis = [
    {
      label: "Rent income",
      value: aud(rentPerPeriod),
      sub: `per ${periodWord} · ${tenanted} tenanted`,
      icon: ArrowUpRight,
      tint: "bg-brand-soft text-brand",
    },
    {
      label: "Expenses",
      value: aud(monthExpenses),
      sub: `${monthExpenseCount} ${monthExpenseCount === 1 ? "entry" : "entries"} this month`,
      icon: ArrowDownRight,
      tint: "bg-terra-soft text-terra",
    },
    {
      label: "Net cashflow",
      value: aud(net),
      sub:
        mortgageMonthly > 0
          ? `${net >= 0 ? "surplus" : "shortfall"} · after ${aud(mortgagePerPeriod)} loan`
          : `${net >= 0 ? "surplus" : "shortfall"} · per ${periodWord}`,
      icon: Sparkles,
      tint: "bg-brand-soft text-brand",
      accent: net >= 0 ? "text-brand" : "text-terra",
    },
    {
      label: "Portfolio",
      value: String(props.length),
      sub: `${rented} rented · ${vacant} vacant`,
      icon: Home,
      tint: "bg-card-2 text-muted",
    },
  ];

  // Per-property rent + net (this month)
  const leaseByProp = new Map(activeLeases.map((l) => [l.property_id, l]));
  const monthExpenseByProp = new Map<string, number>();
  for (const r of expenses) {
    if ((r.date as string) < month.start || (r.date as string) > month.end) continue;
    const pid = r.property_id as string | null;
    if (!pid) continue;
    monthExpenseByProp.set(pid, (monthExpenseByProp.get(pid) ?? 0) + Number(r.amount));
  }
  const mortgageByProp = new Map<string, number>();
  for (const m of mortgages ?? []) {
    const monthly = (Number(m.repayment_amount) * (ANNUAL_FACTOR[m.frequency] ?? 12)) / 12;
    mortgageByProp.set(m.property_id, (mortgageByProp.get(m.property_id) ?? 0) + monthly);
  }
  const propertyRows = props.slice(0, 5).map((p) => {
    const lease = leaseByProp.get(p.id);
    const rentMo = lease ? annualRent(Number(lease.rent_amount), lease.frequency) / 12 : 0;
    const net = rentMo - (monthExpenseByProp.get(p.id) ?? 0) - (mortgageByProp.get(p.id) ?? 0);
    return { ...p, lease, rentMo, net };
  });

  // Where it goes — this month by category
  const byCategory = new Map<string, number>();
  for (const r of expenses) {
    if ((r.date as string) < month.start || (r.date as string) > month.end) continue;
    const name = (r.categories as unknown as { name: string } | null)?.name ?? "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(r.amount));
  }
  const categoryRows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const categoryMax = Math.max(1, ...categoryRows.map(([, v]) => v));

  const recentExpenses = expenses.slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {/* Command row */}
      <div className="flex flex-wrap items-center gap-3">
        <AskBar />
        <PeriodToggle />
        <Link
          href="/properties"
          className="flex items-center gap-1.5 rounded-(--radius-field) bg-ink px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden /> Add property
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-(--radius-card) border border-line bg-card p-5">
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted">{kpi.label}</span>
              <span className={`flex size-8 items-center justify-center rounded-lg ${kpi.tint}`}>
                <kpi.icon className="size-4" aria-hidden />
              </span>
            </div>
            <div className={`num mt-3 text-3xl font-bold ${kpi.accent ?? "text-ink"}`}>{kpi.value}</div>
            <div className="mt-2 text-xs text-muted">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + properties */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-(--radius-card) border border-line bg-card p-6 lg:col-span-2">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Cashflow — last 6 months</h2>
            <span className="text-xs text-muted">rent in vs expenses out</span>
          </div>
          <CashflowChart data={buckets} />
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Properties</h2>
            <span className="text-xs text-muted">rent &amp; net per property</span>
          </div>
          {propertyRows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div>
                <p className="font-semibold text-ink">No properties yet</p>
                <p className="mt-1 text-sm text-muted">
                  Add your first property to start tracking rent and expenses.
                </p>
              </div>
              <Link
                href="/properties"
                className="rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Add a property
              </Link>
              <span className="text-xs text-muted">or, to see how Roost works</span>
              <SeedButton />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] tracking-wide text-muted uppercase">
                  <th className="pb-2 font-semibold">Property</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Rent</th>
                  <th className="pb-2 text-right font-semibold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {propertyRows.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-2">
                      <Link href={`/properties/${p.id}`} className="block hover:text-brand">
                        <span className="block truncate font-medium text-ink">{p.address}</span>
                        <span className="block truncate text-xs text-muted">{p.suburb}</span>
                      </Link>
                    </td>
                    <td className="py-3">
                      <StatusPill value={p.status} />
                    </td>
                    <td className="num py-3 text-right text-ink">
                      {p.lease ? `${aud(p.rentMo)}/mo` : "—"}
                    </td>
                    <td className={`num py-3 text-right font-semibold ${p.net >= 0 ? "text-brand" : "text-terra"}`}>
                      {p.net >= 0 ? aud(p.net) : `-${aud(Math.abs(p.net))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Recent expenses + where it goes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-(--radius-card) border border-line bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Recent expenses</h2>
            <Link
              href="/expenses"
              className="flex items-center gap-1.5 rounded-(--radius-field) bg-ink px-3.5 py-2 text-xs font-semibold text-bg transition-opacity hover:opacity-90"
            >
              <Plus className="size-3.5" aria-hidden /> Add
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-semibold text-ink">No expenses logged</p>
              <p className="mt-1 text-sm text-muted">
                Use “Add” or the command bar to record your first expense.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentExpenses.map((e, i) => {
                const cat = (e.categories as unknown as { name: string } | null)?.name ?? "Expense";
                const addr = (e.properties as unknown as { address: string } | null)?.address ?? "";
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-terra-soft text-xs font-semibold text-terra">
                        {cat.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">
                          {cat} — {e.description}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {addr} · {fmtDate(e.date as string)}
                        </div>
                      </div>
                    </div>
                    <span className="num shrink-0 font-semibold text-terra">
                      -{audCents(Number(e.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Where it goes</h2>
            <span className="text-xs text-muted">this month</span>
          </div>
          {categoryRows.length === 0 ? (
            <p className="flex-1 py-10 text-center text-sm text-muted">
              Nothing spent yet this month.
            </p>
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              {categoryRows.map(([name, value]) => (
                <div key={name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink">{name}</span>
                    <span className="num text-ink">{audCents(value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-code-bg">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(value / categoryMax) * 100}%`, background: "var(--terra)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <span className="font-semibold text-ink">Total out</span>
            <span className="num font-bold text-terra">
              {monthExpenses > 0 ? `-${audCents(monthExpenses)}` : "$0"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
