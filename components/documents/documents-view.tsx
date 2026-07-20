"use client";

import { ReceiptUploader } from "./receipt-uploader";
import { deleteDocument } from "@/app/(app)/documents/actions";
import { StatusPill } from "@/components/ui/status-pill";
import { aud, fmtDate } from "@/lib/format";
import type { Category, DocumentRow, Property } from "@/lib/types";
import { FileText, Receipt, Trash2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS: Record<string, { label: string; tone: string }> = {
  done: { label: "Read by AI", tone: "paid" },
  processing: { label: "Reading", tone: "scheduled" },
  pending: { label: "Manual", tone: "upcoming" },
  failed: { label: "Unreadable", tone: "late" },
};

export function DocumentsView({
  workspaceId,
  documents,
  properties,
  categories,
}: {
  workspaceId: string;
  documents: DocumentRow[];
  properties: Pick<Property, "id" | "address">[];
  categories: Category[];
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onDelete(id: string) {
    setDeletingId(id);
    await deleteDocument(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Documents</h1>
        <p className="mt-1 text-sm text-muted">
          Snap a receipt and AI files it — vendor, amount, GST and category, linked to the right
          property.
        </p>
      </div>

      <ReceiptUploader workspaceId={workspaceId} properties={properties} categories={categories} />

      <section className="rounded-(--radius-card) border border-line bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Library{documents.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{documents.length}</span>}
        </h2>
        {documents.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand-soft">
              <FileText className="size-5 text-brand" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-ink">No documents yet</p>
            <p className="mt-1 text-sm text-muted">Upload a receipt above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {documents.map((d) => {
              const status = STATUS[d.ocr_status] ?? STATUS.pending;
              const summary =
                d.extracted?.vendor || d.extracted?.amount != null
                  ? [d.extracted?.vendor, d.extracted?.amount != null ? aud(Number(d.extracted.amount)) : null]
                      .filter(Boolean)
                      .join(" · ")
                  : null;
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-terra-soft text-terra">
                      <Receipt className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{d.file_name}</div>
                      <div className="truncate text-xs text-muted">
                        {summary ?? d.type} · {fmtDate(d.created_at.slice(0, 10))}
                        {d.properties?.address ? ` · ${d.properties.address}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {d.expense_id ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand">
                        <CheckCircle2 className="size-4" aria-hidden /> Filed
                      </span>
                    ) : (
                      <StatusPill value={status.tone} label={status.label} />
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      disabled={deletingId === d.id}
                      aria-label={`Delete ${d.file_name}`}
                      className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
