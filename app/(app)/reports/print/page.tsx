import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { resolvePeriod, audCents, fmtDate } from "@/lib/format";
import { fetchReport, summarize } from "@/lib/reports";
import { PrintButton } from "@/components/reports/print-button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; period?: string; property?: string }>;
}) {
  const { report = "tax", period = "this_fy", property = "all" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = user ? await ensureWorkspace(supabase, user) : null;
  const range = resolvePeriod(period);
  const data = workspace
    ? await fetchReport(supabase, workspace.id, range, property)
    : { expenses: [], income: [] };
  const s = summarize(data);

  const isTax = report === "tax";
  const title = isTax ? "Tax summary" : "Transaction ledger";

  const ledger = [
    ...data.income.map((r) => ({
      date: r.date,
      type: "Income",
      property: r.property,
      detail: r.type === "rent" ? "Rent" : (r.description ?? "Income"),
      amount: r.amount,
    })),
    ...data.expenses.map((e) => ({
      date: e.date,
      type: "Expense",
      property: e.property,
      detail: `${e.category} — ${e.description}`,
      amount: -e.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ color: "#1b231f" }} className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Back to reports
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-(--radius-card) border border-line bg-white p-8" style={{ color: "#1b231f" }}>
        <div className="mb-6 flex items-start justify-between border-b border-neutral-200 pb-4">
          <div>
            <div className="text-xl font-bold">🪺 Roost</div>
            <div className="mt-1 text-lg font-semibold">{title}</div>
            <div className="text-sm text-neutral-500">
              {workspace?.name ?? "Portfolio"} · {range.label}
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            Generated {fmtDate(new Date())}
            <br />
            All amounts in AUD
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Income", audCents(s.incomeTotal)],
            ["Expenses", audCents(s.expenseTotal)],
            ["Net", audCents(s.net)],
            ["GST paid", audCents(s.gstTotal)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="tabular mt-0.5 font-bold">{value}</div>
            </div>
          ))}
        </div>

        {isTax ? (
          <>
            <h2 className="mb-2 text-sm font-semibold">Expenses by category</h2>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500 uppercase">
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">GST</th>
                  <th className="py-2 text-right">Deductible</th>
                </tr>
              </thead>
              <tbody>
                {s.categories.map((c) => (
                  <tr key={c.category} className="border-b border-neutral-200">
                    <td className="py-2">{c.category}</td>
                    <td className="tabular py-2 text-right">{audCents(c.total)}</td>
                    <td className="tabular py-2 text-right">{audCents(c.gst)}</td>
                    <td className="tabular py-2 text-right">{audCents(c.deductible)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="tabular py-2 text-right">{audCents(s.expenseTotal)}</td>
                  <td className="tabular py-2 text-right">{audCents(s.gstTotal)}</td>
                  <td className="tabular py-2 text-right">{audCents(s.deductibleTotal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-neutral-500">
              Prepared by Roost from your records. Tax-deductibility is indicative — confirm with your
              accountant before lodging.
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-semibold">Transactions ({ledger.length})</h2>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500 uppercase">
                  <th className="py-2">Date</th>
                  <th className="py-2">Property</th>
                  <th className="py-2">Detail</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={i} className="border-b border-neutral-200">
                    <td className="py-1.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-1.5">{r.property}</td>
                    <td className="py-1.5">{r.detail}</td>
                    <td className="tabular py-1.5 text-right">
                      {r.amount >= 0 ? "+" : "−"}
                      {audCents(Math.abs(r.amount))}
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-neutral-500">
                      No transactions in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
