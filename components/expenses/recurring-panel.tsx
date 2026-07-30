"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  createRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
} from "@/app/(app)/expenses/recurring-actions";
import { aud, fmtDate, todayISO } from "@/lib/format";
import type { Category, Property } from "@/lib/types";
import { Repeat, Plus, Trash2, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface RecurringRule {
  id: string;
  description: string;
  vendor: string | null;
  amount: number;
  frequency: string;
  next_run_date: string;
  active: boolean;
  categories?: { name: string } | null;
  properties?: { address: string } | null;
}

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RecurringPanel({
  rules,
  properties,
  categories,
  canEdit,
  generated,
}: {
  rules: RecurringRule[];
  properties: Pick<Property, "id" | "address">[];
  categories: Category[];
  canEdit: boolean;
  generated: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const gstRef = useRef<HTMLInputElement>(null);

  function autoGst() {
    const amount = Number(amountRef.current?.value ?? 0);
    if (gstRef.current && amount > 0) gstRef.current.value = (amount / 11).toFixed(2);
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (await run("create", () => createRecurringRule(form))) setAdding(false);
  }

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Repeat className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Recurring bills</h2>
            <p className="text-sm text-muted">
              Rates, insurance, body corporate — entered once, created automatically when due.
            </p>
          </div>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> New rule
          </Button>
        )}
      </div>

      {generated > 0 && (
        <p className="mb-3 rounded-(--radius-field) bg-brand-soft px-3 py-2 text-sm text-brand">
          {generated} recurring {generated === 1 ? "bill was" : "bills were"} just added to your
          ledger as unpaid.
        </p>
      )}

      {rules.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No recurring bills yet. Add one and Roost will keep creating it on schedule.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">
                  {r.description}
                  {!r.active && (
                    <span className="ml-2 rounded-full bg-code-bg px-2 py-0.5 text-xs text-muted">
                      Paused
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted">
                  {[r.categories?.name, r.properties?.address, r.vendor].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="num text-sm font-semibold text-ink">{aud(Number(r.amount))}</div>
                  <div className="text-xs text-muted">
                    {FREQ_LABEL[r.frequency] ?? r.frequency} · next {fmtDate(r.next_run_date)}
                  </div>
                </div>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => run(`t-${r.id}`, () => toggleRecurringRule(r.id, !r.active))}
                      disabled={busy === `t-${r.id}`}
                      aria-label={r.active ? `Pause ${r.description}` : `Resume ${r.description}`}
                      className="rounded p-1.5 text-muted hover:bg-brand-soft hover:text-ink disabled:opacity-50"
                    >
                      {r.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => run(`d-${r.id}`, () => deleteRecurringRule(r.id))}
                      disabled={busy === `d-${r.id}`}
                      aria-label={`Delete ${r.description}`}
                      className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New recurring bill">
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <Select label="Property" name="property_id" defaultValue={properties[0]?.id} required>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </Select>
          <Select label="Category" name="category_id" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="Description" name="description" placeholder="Quarterly council rates" required />
          <Input label="Vendor" name="vendor" placeholder="e.g. Port Phillip Council" />
          <div className="grid grid-cols-2 gap-3">
            <Input ref={amountRef} label="Amount ($)" name="amount" inputMode="decimal" required />
            <div className="relative">
              <Input ref={gstRef} label="GST ($)" name="gst_amount" inputMode="decimal" />
              <button
                type="button"
                onClick={autoGst}
                className="absolute top-8 right-2 rounded px-1.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand-soft"
              >
                1/11
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Frequency" name="frequency" defaultValue="quarterly">
              {Object.entries(FREQ_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Input label="Next due" name="next_run_date" type="date" defaultValue={todayISO()} />
          </div>
          <Input label="Stop after (optional)" name="end_date" type="date" />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="is_tax_deductible" defaultChecked className="size-4 accent-(--brand)" />
            Tax deductible
          </label>
          <p className="text-xs text-muted">
            Bills are added as <strong>unpaid</strong> on their due date, so they show up in your
            calendar and notifications until you mark them paid.
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={busy === "create"} className="flex-1">
              Create rule
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
