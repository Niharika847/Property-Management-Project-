"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { saveMortgage, deleteMortgage } from "@/app/(app)/properties/mortgage-actions";
import { aud, audCents, ANNUAL_FACTOR } from "@/lib/format";
import { Landmark, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Mortgage {
  id: string;
  lender: string;
  account_ref: string | null;
  original_amount: number | null;
  current_balance: number;
  interest_rate: number;
  rate_type: string;
  repayment_type: string;
  repayment_amount: number;
  frequency: string;
  start_date: string | null;
  offset_balance: number | null;
}

const RATE_LABEL: Record<string, string> = {
  fixed: "Fixed",
  variable: "Variable",
  split: "Split",
};
const REPAY_LABEL: Record<string, string> = {
  principal_interest: "Principal & interest",
  interest_only: "Interest only",
};

export function MortgagePanel({
  propertyId,
  mortgage,
  propertyValue,
  canEdit,
}: {
  propertyId: string;
  mortgage: Mortgage | null;
  propertyValue: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveMortgage(propertyId, mortgage?.id ?? null, new FormData(e.currentTarget));
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function onDelete() {
    if (!mortgage) return;
    setSaving(true);
    await deleteMortgage(mortgage.id, propertyId);
    setSaving(false);
    setConfirming(false);
    router.refresh();
  }

  // Monthly equivalent of whatever repayment cadence the loan uses.
  const perMonth = mortgage
    ? (Number(mortgage.repayment_amount) * (ANNUAL_FACTOR[mortgage.frequency] ?? 12)) / 12
    : 0;
  const annualInterest = mortgage
    ? (Number(mortgage.current_balance) * Number(mortgage.interest_rate)) / 100
    : 0;
  const equity =
    propertyValue != null && mortgage ? propertyValue - Number(mortgage.current_balance) : null;
  const lvr =
    propertyValue && mortgage && propertyValue > 0
      ? (Number(mortgage.current_balance) / propertyValue) * 100
      : null;

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-terra-soft text-terra">
            <Landmark className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Mortgage</h2>
            <p className="text-xs text-muted">
              {mortgage ? `${mortgage.lender}${mortgage.account_ref ? ` · ${mortgage.account_ref}` : ""}` : "Not recorded"}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>
            {mortgage ? <Pencil className="size-3.5" aria-hidden /> : null}
            {mortgage ? "Edit" : "Add mortgage"}
          </Button>
        )}
      </div>

      {mortgage ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Balance owing</dt>
            <dd className="num text-right font-semibold text-ink">{aud(Number(mortgage.current_balance))}</dd>
            <dt className="text-muted">Repayment</dt>
            <dd className="num text-right text-ink">
              {audCents(Number(mortgage.repayment_amount))}/{mortgage.frequency === "monthly" ? "mo" : mortgage.frequency === "weekly" ? "wk" : "fn"}
            </dd>
            <dt className="text-muted">Cost per month</dt>
            <dd className="num text-right font-semibold text-terra">{aud(perMonth)}</dd>
            <dt className="text-muted">Rate</dt>
            <dd className="num text-right text-ink">
              {Number(mortgage.interest_rate).toFixed(2)}% {RATE_LABEL[mortgage.rate_type]}
            </dd>
            <dt className="text-muted">Type</dt>
            <dd className="text-right text-ink">{REPAY_LABEL[mortgage.repayment_type]}</dd>
            <dt className="text-muted">Interest / year</dt>
            <dd className="num text-right text-ink">≈ {aud(annualInterest)}</dd>
            {equity != null && (
              <>
                <dt className="text-muted">Equity</dt>
                <dd className="num text-right font-semibold text-brand">{aud(equity)}</dd>
              </>
            )}
            {lvr != null && (
              <>
                <dt className="text-muted">LVR</dt>
                <dd className="num text-right text-ink">{lvr.toFixed(0)}%</dd>
              </>
            )}
          </dl>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Interest is generally deductible; principal is not. Log repayments as expenses to have
            them counted in cash flow.
          </p>
          {canEdit && (
            <div className="mt-3">
              {confirming ? (
                <div className="flex items-center gap-2">
                  <Button variant="danger" loading={saving} onClick={onDelete} className="h-9 px-3 text-xs">
                    Remove mortgage
                  </Button>
                  <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="text-xs text-muted hover:text-danger"
                >
                  Remove mortgage…
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Add your loan to track equity, LVR and the real cost of holding this property.
        </p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={mortgage ? "Edit mortgage" : "Add mortgage"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Lender" name="lender" defaultValue={mortgage?.lender} placeholder="Westpac" required />
            <Input label="Account ref" name="account_ref" defaultValue={mortgage?.account_ref ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Original amount ($)"
              name="original_amount"
              inputMode="decimal"
              defaultValue={mortgage?.original_amount ?? ""}
            />
            <Input
              label="Balance owing ($)"
              name="current_balance"
              inputMode="decimal"
              defaultValue={mortgage?.current_balance ?? ""}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Interest rate (%)"
              name="interest_rate"
              inputMode="decimal"
              defaultValue={mortgage?.interest_rate ?? ""}
              placeholder="5.9"
            />
            <Select label="Rate type" name="rate_type" defaultValue={mortgage?.rate_type ?? "variable"}>
              {Object.entries(RATE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Repayment ($)"
              name="repayment_amount"
              inputMode="decimal"
              defaultValue={mortgage?.repayment_amount ?? ""}
            />
            <Select label="Frequency" name="frequency" defaultValue={mortgage?.frequency ?? "monthly"}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
          <Select
            label="Repayment type"
            name="repayment_type"
            defaultValue={mortgage?.repayment_type ?? "principal_interest"}
          >
            {Object.entries(REPAY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Loan start" name="start_date" type="date" defaultValue={mortgage?.start_date ?? ""} />
            <Input
              label="Offset balance ($)"
              name="offset_balance"
              inputMode="decimal"
              defaultValue={mortgage?.offset_balance ?? ""}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={saving} className="flex-1">
              {mortgage ? "Save mortgage" : "Add mortgage"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
