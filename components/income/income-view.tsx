"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import {
  markRentPaid,
  waiveRentCharge,
  addOtherIncome,
  deleteIncome,
} from "@/app/(app)/income/actions";
import { audCents, fmtDate, todayISO } from "@/lib/format";
import type { Income, Property, RentCharge } from "@/lib/types";
import { ArrowDownToLine, Check, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function chargeLabel(c: RentCharge): string {
  const address = c.leases?.properties?.address ?? "Property";
  const tenant = c.leases?.tenants?.full_name;
  return tenant ? `${address} · ${tenant}` : address;
}

export function IncomeView({
  overdue,
  upcoming,
  history,
  properties,
  fyTotal,
  fyLabel,
  outstanding,
}: {
  overdue: RentCharge[];
  upcoming: RentCharge[];
  history: Income[];
  properties: Pick<Property, "id" | "address">[];
  fyTotal: number;
  fyLabel: string;
  outstanding: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id);
    await fn(id);
    setBusyId(null);
    router.refresh();
  }

  async function onAddOther(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addOtherIncome(new FormData(e.currentTarget));
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    setAdding(false);
    router.refresh();
  }

  const noData = overdue.length === 0 && upcoming.length === 0 && history.length === 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Income</h1>
          <p className="mt-1 text-sm text-muted">
            {fyLabel}: <span className="tabular font-semibold text-ink">{audCents(fyTotal)}</span>
            {outstanding > 0 && (
              <>
                {" "}
                · outstanding{" "}
                <span className="tabular font-semibold text-danger">{audCents(outstanding)}</span>
              </>
            )}
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={properties.length === 0}>
          <Plus className="size-4" aria-hidden /> Other income
        </Button>
      </div>

      {noData ? (
        <EmptyState
          icon={ArrowDownToLine}
          title="No income tracked yet"
          body="Add a lease to a rental property and its rent schedule appears here automatically."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {overdue.length > 0 && (
            <section className="rounded-(--radius-card) border border-danger/40 bg-card p-5">
              <h2 className="text-sm font-semibold text-danger">Overdue rent</h2>
              <ul className="mt-2 divide-y divide-line">
                {overdue.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{chargeLabel(c)}</div>
                      <div className="text-xs text-muted">Due {fmtDate(c.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-ink">
                        {audCents(Number(c.amount))}
                      </span>
                      <StatusPill value="late" label="Late" />
                      <Button
                        variant="secondary"
                        loading={busyId === c.id}
                        onClick={() => act(c.id, markRentPaid)}
                        className="h-8 px-3 text-xs"
                      >
                        <Check className="size-3.5" aria-hidden /> Mark paid
                      </Button>
                      <button
                        type="button"
                        onClick={() => act(c.id, waiveRentCharge)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Waive
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="rounded-(--radius-card) border border-line bg-card p-5">
              <h2 className="text-sm font-semibold text-ink">Upcoming rent</h2>
              <ul className="mt-2 divide-y divide-line">
                {upcoming.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{chargeLabel(c)}</div>
                      <div className="text-xs text-muted">Due {fmtDate(c.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-ink">
                        {audCents(Number(c.amount))}
                      </span>
                      <Button
                        variant="ghost"
                        loading={busyId === c.id}
                        onClick={() => act(c.id, markRentPaid)}
                        className="h-8 px-3 text-xs"
                      >
                        <Check className="size-3.5" aria-hidden /> Mark paid
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-(--radius-card) border border-line bg-card p-5">
            <h2 className="text-sm font-semibold text-ink">Payment history</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">
                        {r.type === "rent" ? "Rent" : (r.description ?? "Income")} ·{" "}
                        {r.properties?.address ?? ""}
                      </div>
                      <div className="text-xs text-muted">{fmtDate(r.date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-brand">
                        +{audCents(Number(r.amount))}
                      </span>
                      <button
                        type="button"
                        onClick={() => act(r.id, deleteIncome)}
                        disabled={busyId === r.id}
                        aria-label="Delete payment"
                        className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Record other income">
        <form onSubmit={onAddOther} className="flex flex-col gap-4">
          <Select label="Property" name="property_id" defaultValue={properties[0]?.id}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount ($)" name="amount" inputMode="decimal" required />
            <Input label="Date" name="date" type="date" defaultValue={todayISO()} />
          </div>
          <Input
            label="Description"
            name="description"
            placeholder="e.g. Insurance payout, bond claim"
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={saving} className="flex-1">
              Record income
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
