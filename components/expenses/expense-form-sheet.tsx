"use client";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, updateExpense } from "@/app/(app)/expenses/actions";
import { todayISO } from "@/lib/format";
import type { Category, Expense, Property } from "@/lib/types";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface ExpensePrefill {
  property_id?: string | null;
  date?: string | null;
  amount?: number | null;
  gst_amount?: number | null;
  category_id?: string | null;
  vendor?: string | null;
  description?: string | null;
}

export function ExpenseFormSheet({
  open,
  onClose,
  properties,
  categories,
  expense,
  initial,
  documentId,
  aiConfidence,
}: {
  open: boolean;
  onClose: () => void;
  properties: Pick<Property, "id" | "address">[];
  categories: Category[];
  expense?: Expense;
  initial?: ExpensePrefill;
  documentId?: string;
  aiConfidence?: number | null;
}) {
  const router = useRouter();
  const editing = !!expense;
  const src = expense ?? initial;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const gstRef = useRef<HTMLInputElement>(null);
  const [deductible, setDeductible] = useState(expense?.is_tax_deductible ?? true);

  function autoGst() {
    const amount = Number(amountRef.current?.value ?? 0);
    if (gstRef.current && amount > 0) {
      // GST-inclusive price: GST component is 1/11th of the total.
      gstRef.current.value = (amount / 11).toFixed(2);
    }
  }

  function onCategoryChange(id: string) {
    const category = categories.find((c) => c.id === id);
    if (category) setDeductible(category.tax_deductible_default);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = editing ? await updateExpense(expense.id, form) : await createExpense(form);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  const title = editing ? "Edit expense" : documentId ? "Review expense" : "Add expense";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {documentId && (
          <div className="flex items-start gap-2 rounded-(--radius-field) border border-brand/30 bg-brand-soft px-3 py-2.5 text-xs text-brand">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Extracted from your receipt by AI
              {aiConfidence != null ? ` · ${Math.round(aiConfidence * 100)}% confident` : ""}. Check
              the details before filing.
            </span>
          </div>
        )}
        {documentId && <input type="hidden" name="document_id" value={documentId} />}

        <Select
          label="Property"
          name="property_id"
          defaultValue={src?.property_id ?? properties[0]?.id}
          required
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            name="date"
            type="date"
            defaultValue={src?.date ?? todayISO()}
            required
          />
          <Select
            label="Category"
            name="category_id"
            defaultValue={src?.category_id ?? undefined}
            onChange={(e) => onCategoryChange(e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            ref={amountRef}
            label="Amount ($, incl. GST)"
            name="amount"
            inputMode="decimal"
            defaultValue={src?.amount ?? ""}
            required
          />
          <div className="relative">
            <Input
              ref={gstRef}
              label="GST ($)"
              name="gst_amount"
              inputMode="decimal"
              defaultValue={src?.gst_amount ?? ""}
            />
            <button
              type="button"
              onClick={autoGst}
              className="absolute top-8 right-2 rounded px-1.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand-soft"
            >
              1/11
            </button>
          </div>
        </div>
        <Input
          label="Vendor"
          name="vendor"
          defaultValue={src?.vendor ?? ""}
          placeholder="e.g. Reece Plumbing"
        />
        <Input
          label="Description"
          name="description"
          defaultValue={src?.description ?? ""}
          placeholder="What was this for?"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Payment status"
            name="payment_status"
            defaultValue={expense?.payment_status ?? "paid"}
          >
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="scheduled">Scheduled</option>
          </Select>
          <label className="mt-7 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="is_tax_deductible"
              checked={deductible}
              onChange={(e) => setDeductible(e.target.checked)}
              className="size-4 accent-(--brand)"
            />
            Tax deductible
          </label>
        </div>
        <Textarea label="Notes" name="notes" defaultValue={expense?.notes ?? ""} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={saving} className="flex-1">
            {editing ? "Save changes" : documentId ? "File expense" : "Add expense"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
