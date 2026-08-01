"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ExpenseFormSheet } from "./expense-form-sheet";
import { deleteExpense } from "@/app/(app)/expenses/actions";
import { audCents, fmtDate } from "@/lib/format";
import type { Category, Expense, Property } from "@/lib/types";
import { ArrowUpFromLine, Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExpensesView({
  expenses,
  properties,
  categories,
  totalFY,
  gstFY,
  fyLabel,
  activeProperty,
}: {
  expenses: Expense[];
  properties: Pick<Property, "id" | "address">[];
  categories: Category[];
  totalFY: number;
  gstFY: number;
  fyLabel: string;
  activeProperty: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onDelete(id: string) {
    setDeletingId(id);
    await deleteExpense(id);
    setDeletingId(null);
    router.refresh();
  }

  function onFilter(propertyId: string) {
    router.push(propertyId ? `/expenses?property=${propertyId}` : "/expenses");
  }

  const hasProperties = properties.length > 0;

  return (
    <>
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Expenses</h1>
          <p className="mt-1 text-sm text-muted">
            {fyLabel}: <span className="tabular font-semibold text-ink">{audCents(totalFY)}</span>
            {gstFY > 0 && (
              <>
                {" "}
                · GST <span className="tabular">{audCents(gstFY)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by property"
            value={activeProperty}
            onChange={(e) => onFilter(e.target.value)}
            className="h-10 rounded-(--radius-field) border border-line bg-card px-3 text-sm text-ink"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
          <Button onClick={() => setAdding(true)} disabled={!hasProperties}>
            <Plus className="size-4" aria-hidden /> Add expense
          </Button>
        </div>
      </div>

      {!hasProperties ? (
        <EmptyState
          icon={ArrowUpFromLine}
          title="Add a property first"
          body="Expenses belong to a property — add one on the Properties page, then track costs here."
        />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={ArrowUpFromLine}
          title="No expenses yet"
          body="Track every cost — rates, insurance, repairs — and tax time takes care of itself."
          action={<Button onClick={() => setAdding(true)}>Add your first expense</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-(--radius-card) border border-line bg-card lg:min-h-0 lg:flex-1 lg:overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Property</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">GST</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-brand-soft/30">
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{fmtDate(e.date)}</td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <div className="truncate font-medium text-ink">{e.description}</div>
                    {e.vendor && <div className="truncate text-xs text-muted">{e.vendor}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {e.categories?.name ?? "—"}
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3 text-muted md:table-cell">
                    {e.properties?.address ?? "—"}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold text-ink">
                    {audCents(Number(e.amount))}
                  </td>
                  <td className="tabular hidden px-4 py-3 text-right text-muted sm:table-cell">
                    {Number(e.gst_amount) > 0 ? audCents(Number(e.gst_amount)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={e.payment_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        aria-label={`Edit ${e.description}`}
                        className="rounded p-1.5 text-muted hover:bg-brand-soft hover:text-ink"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(e.id)}
                        disabled={deletingId === e.id}
                        aria-label={`Delete ${e.description}`}
                        className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExpenseFormSheet
        open={adding}
        onClose={() => setAdding(false)}
        properties={properties}
        categories={categories}
      />
      {editing && (
        <ExpenseFormSheet
          open
          onClose={() => setEditing(null)}
          properties={properties}
          categories={categories}
          expense={editing}
        />
      )}
    </>
  );
}
