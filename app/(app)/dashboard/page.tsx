import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import {
  aud,
  audCents,
  annualRent,
  fmtDate,
  fyRange,
  monthRange,
  todayISO,
} from "@/lib/format";
import { AlertTriangle, Building2 } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const fy = fyRange();
  const month = monthRange();
  const today = todayISO();

  const [
    { data: properties },
    { data: leases },
    { data: incomeRows },
    { data: expenseRows },
    { data: overdueCharges },
  ] = await Promise.all([
    supabase.from("properties").select("id, address, status, current_value"),
    supabase.from("leases").select("rent_amount, frequency").eq("status", "active"),
    supabase
      .from("income")
      .select("id, date, amount, type, description, properties ( address )")
      .gte("date", fy.start)
      .order("date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, date, amount, description, properties ( address )")
      .gte("date", fy.start)
      .order("date", { ascending: false }),
    supabase
      .from("rent_charges")
      .select("id, due_date, amount, leases ( properties ( address ) )")
      .eq("status", "expected")
      .lte("due_date", today)
      .order("due_date"),
  ]);

  const props = properties ?? [];
  if (props.length === 0) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Your portfolio at a glance — value, cash flow, and what needs attention.
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title="Add your first property"
          body="Your dashboard lights up once there's a property to track — value, rent, expenses, and insights all start there."
          action={
            <Link
              href="/properties"
              className="rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to Properties
            </Link>
          }
        />
      </>
    );
  }

  const portfolioValue = props.reduce((s, p) => s + Number(p.current_value ?? 0), 0);
  const activeLeases = leases ?? [];
  const annualRentTotal = activeLeases.reduce(
    (s, l) => s + annualRent(Number(l.rent_amount), l.frequency),
    0
  );
  const monthlyRent = annualRentTotal / 12;
  const weeklyRent = annualRentTotal / 52;

  const income = incomeRows ?? [];
  const expenses = expenseRows ?? [];
  const incomeFY = income.reduce((s, r) => s + Number(r.amount), 0);
  const expensesFY = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const incomeMonth = income
    .filter((r) => r.date >= month.start && r.date <= month.end)
    .reduce((s, r) => s + Number(r.amount), 0);
  const expensesMonth = expenses
    .filter((r) => r.date >= month.start && r.date <= month.end)
    .reduce((s, r) => s + Number(r.amount), 0);
  const cashFlowMonth = incomeMonth - expensesMonth;

  const overdue = overdueCharges ?? [];
  const outstanding = overdue.reduce((s, c) => s + Number(c.amount), 0);

  const occupied = props.filter((p) => p.status === "rental").length;
  const vacant = props.filter((p) => p.status === "vacant").length;
  const valuedProps = props.filter((p) => Number(p.current_value ?? 0) > 0);
  const grossYield =
    portfolioValue > 0 && annualRentTotal > 0 && valuedProps.length > 0
      ? (annualRentTotal / portfolioValue) * 100
      : null;

  const kpis = [
    {
      label: "Portfolio value",
      value: portfolioValue ? aud(portfolioValue) : "—",
      hint: valuedProps.length < props.length ? "Some properties have no valuation" : `${props.length} properties`,
      tone: "text-ink",
    },
    {
      label: "Cash flow this month",
      value: audCents(cashFlowMonth),
      hint: `${audCents(incomeMonth)} in · ${audCents(expensesMonth)} out`,
      tone: cashFlowMonth >= 0 ? "text-brand" : "text-danger",
    },
    {
      label: "Rental income",
      value: monthlyRent ? `${aud(monthlyRent)}/mo` : "—",
      hint: monthlyRent
        ? `${aud(weeklyRent)}/wk · ${aud(annualRentTotal)}/yr expected`
        : "No active leases",
      tone: "text-ink",
    },
    {
      label: "Outstanding rent",
      value: outstanding ? audCents(outstanding) : "$0.00",
      hint: outstanding ? `${overdue.length} payment${overdue.length === 1 ? "" : "s"} late` : "All rent collected",
      tone: outstanding ? "text-danger" : "text-ink",
    },
  ];

  const stats = [
    ["Occupied", String(occupied)],
    ["Vacant", String(vacant)],
    [`Income ${fy.label}`, audCents(incomeFY)],
    [`Expenses ${fy.label}`, audCents(expensesFY)],
    [`Net ${fy.label}`, audCents(incomeFY - expensesFY)],
    ["Gross yield", grossYield ? `${grossYield.toFixed(1)}%` : "—"],
  ];

  const attention: Array<{ id: string; text: string; href: string }> = [
    ...overdue.slice(0, 4).map((c) => ({
      id: `late-${c.id}`,
      text: `Rent ${audCents(Number(c.amount))} late — ${
        ((c.leases as unknown as { properties: { address: string } | null } | null)?.properties)
          ?.address ?? "property"
      } (due ${fmtDate(c.due_date)})`,
      href: "/income",
    })),
    ...props
      .filter((p) => p.status === "vacant")
      .slice(0, 3)
      .map((p) => ({
        id: `vacant-${p.id}`,
        text: `${p.address} is vacant — no rent coming in`,
        href: `/properties/${p.id}`,
      })),
  ];

  const transactions = [
    ...income.map((r) => ({
      id: `i-${r.id}`,
      date: r.date as string,
      label: `${r.type === "rent" ? "Rent" : (r.description ?? "Income")} · ${
        (r.properties as unknown as { address: string } | null)?.address ?? ""
      }`,
      amount: Number(r.amount),
    })),
    ...expenses.map((r) => ({
      id: `e-${r.id}`,
      date: r.date as string,
      label: `${r.description} · ${
        (r.properties as unknown as { address: string } | null)?.address ?? ""
      }`,
      amount: -Number(r.amount),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Your portfolio at a glance — value, cash flow, and what needs attention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-(--radius-card) border border-line bg-card p-5">
            <div className="text-xs font-semibold tracking-wide text-muted uppercase">
              {kpi.label}
            </div>
            <div className={`tabular mt-2 text-2xl font-bold ${kpi.tone}`}>{kpi.value}</div>
            <div className="mt-1 text-xs text-muted">{kpi.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-card) border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-card p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-(--radius-card) border border-line bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertTriangle className="size-4 text-warn" aria-hidden /> Needs attention
          </h2>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing needs you right now. 🎉</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block py-2.5 text-sm text-ink hover:text-brand"
                  >
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-ink">Recent transactions</h2>
          {transactions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No transactions yet — add an expense or record rent to get moving.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">{t.label}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">{fmtDate(t.date)}</span>
                    <span
                      className={`tabular w-24 text-right font-semibold ${
                        t.amount >= 0 ? "text-brand" : "text-ink"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : "−"}
                      {audCents(Math.abs(t.amount))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
