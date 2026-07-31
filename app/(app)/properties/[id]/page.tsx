import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { PropertyActions } from "@/components/properties/property-actions";
import { LeasePanel } from "@/components/properties/lease-panel";
import { MortgagePanel, type Mortgage } from "@/components/properties/mortgage-panel";
import { StatusPill } from "@/components/ui/status-pill";
import {
  aud,
  audCents,
  annualRent,
  fmtDate,
  fyRange,
  STATUS_LABEL,
} from "@/lib/format";
import type { Lease, Property } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const fy = fyRange();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = user ? await ensureWorkspace(supabase, user) : null;
  const canEdit = workspace?.canEdit ?? false;

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!property) notFound();
  const p = property as Property;

  const [{ data: lease }, { data: incomeRows }, { data: expenseRows }, { data: mortgage }] =
    await Promise.all([
    supabase
      .from("leases")
      .select("*, tenants ( full_name )")
      .eq("property_id", id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("income")
      .select("id, date, amount, type, description")
      .eq("property_id", id)
      .gte("date", fy.start)
      .order("date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, date, amount, description, categories ( name )")
      .eq("property_id", id)
      .gte("date", fy.start)
      .order("date", { ascending: false }),
    supabase.from("mortgages").select("*").eq("property_id", id).maybeSingle(),
  ]);

  const incomeFY = (incomeRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const expensesFY = (expenseRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const activeLease = lease as Lease | null;
  const grossYield =
    activeLease && p.current_value
      ? (annualRent(activeLease.rent_amount, activeLease.frequency) / p.current_value) * 100
      : null;
  const capitalGrowth =
    p.current_value && p.purchase_price ? p.current_value - p.purchase_price : null;

  const transactions = [
    ...(incomeRows ?? []).map((r) => ({
      id: `i-${r.id}`,
      date: r.date as string,
      label: r.type === "rent" ? "Rent received" : (r.description ?? "Income"),
      amount: Number(r.amount),
    })),
    ...(expenseRows ?? []).map((r) => ({
      id: `e-${r.id}`,
      date: r.date as string,
      label: `${(r.categories as unknown as { name: string } | null)?.name ?? "Expense"} — ${r.description}`,
      amount: -Number(r.amount),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const facts: Array<[string, string]> = [
    ["Type", p.property_type.charAt(0).toUpperCase() + p.property_type.slice(1)],
    ["Purchased", p.purchase_price ? `${aud(p.purchase_price)} · ${p.purchase_date ? fmtDate(p.purchase_date) : "date unknown"}` : "—"],
    ["Current value", p.current_value ? aud(p.current_value) : "—"],
    ["Capital growth", capitalGrowth != null ? `${capitalGrowth >= 0 ? "+" : ""}${aud(capitalGrowth)}` : "—"],
  ];

  const kpis: Array<[string, string]> = [
    [`Income ${fy.label}`, incomeFY ? audCents(incomeFY) : "$0.00"],
    [`Expenses ${fy.label}`, expensesFY ? audCents(expensesFY) : "$0.00"],
    ["Cash flow", audCents(incomeFY - expensesFY)],
    ["Gross yield", grossYield ? `${grossYield.toFixed(1)}%` : "—"],
  ];

  return (
    <>
      <Link
        href="/properties"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> All properties
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{p.address}</h1>
            <StatusPill value={p.status} label={STATUS_LABEL[p.status]} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {[p.suburb, p.state, p.postcode].filter(Boolean).join(" ")}
          </p>
        </div>
        <PropertyActions property={p} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-(--radius-card) border border-line bg-card p-4">
            <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
            <div className="tabular mt-1 text-xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-(--radius-card) border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="tabular text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {p.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">{p.notes}</p>}
        </section>

        <LeasePanel propertyId={p.id} lease={activeLease} />
      </div>

      <div className="mt-4">
        <MortgagePanel
          propertyId={p.id}
          mortgage={(mortgage as Mortgage | null) ?? null}
          propertyValue={p.current_value}
          canEdit={canEdit}
        />
      </div>

      <section className="mt-4 rounded-(--radius-card) border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Transactions · {fy.label}</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/expenses" className="text-brand hover:underline">
              Add expense
            </Link>
            <Link href="/income" className="text-brand hover:underline">
              Record rent
            </Link>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No transactions this financial year yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-ink">{t.label}</span>
                <span className="flex shrink-0 items-center gap-4">
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
    </>
  );
}
