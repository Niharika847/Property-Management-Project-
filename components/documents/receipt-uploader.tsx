"use client";

import { createClient } from "@/lib/supabase/client";
import { ingestReceipt } from "@/app/(app)/documents/actions";
import { ExpenseFormSheet, type ExpensePrefill } from "@/components/expenses/expense-form-sheet";
import type { Category, Property } from "@/lib/types";
import { UploadCloud, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "uploading" | "reading";

export function ReceiptUploader({
  workspaceId,
  properties,
  categories,
}: {
  workspaceId: string;
  properties: Pick<Property, "id" | "address">[];
  categories: Category[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [review, setReview] = useState<null | {
    documentId: string;
    initial: ExpensePrefill;
    confidence: number | null;
    note: string | null;
  }>(null);

  async function onFile(file: File) {
    setError(null);
    if (!workspaceId) {
      setError("Workspace not ready — refresh and try again.");
      return;
    }
    if (properties.length === 0) {
      setError("Add a property first, then upload receipts.");
      return;
    }
    setStatus("uploading");
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("receipts")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) {
      setStatus("idle");
      setError(upErr.message);
      return;
    }

    setStatus("reading");
    const res = await ingestReceipt({
      path,
      fileName: file.name,
      mime: file.type || null,
      size: file.size,
    });
    setStatus("idle");
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const ex = res.data.extraction;
    setReview({
      documentId: res.data.documentId,
      confidence: ex?.confidence ?? null,
      note: res.data.message,
      initial: ex
        ? {
            date: ex.date,
            amount: ex.amount,
            gst_amount: ex.gst_amount,
            category_id: ex.category_id,
            vendor: ex.vendor,
            description: ex.description,
          }
        : {},
    });
  }

  const busy = status !== "idle";

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`relative flex flex-col items-center justify-center rounded-(--radius-card) border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-brand bg-brand-soft/50" : "border-line bg-card/60"
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
          {busy ? (
            <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
          ) : (
            <UploadCloud className="size-6 text-brand" aria-hidden />
          )}
        </div>
        <p className="mt-3 font-semibold text-ink">
          {status === "uploading"
            ? "Uploading…"
            : status === "reading"
              ? "Reading your receipt…"
              : "Drop a receipt or invoice here"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5 text-brand" aria-hidden /> AI is extracting the vendor,
              amount, GST and category.
            </span>
          ) : (
            "Photos (JPG, PNG, WebP) are read automatically by AI. PDFs upload for manual entry."
          )}
        </p>
        {!busy && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Choose file
          </button>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {review && (
        <ExpenseFormSheet
          open
          onClose={() => {
            setReview(null);
            router.refresh();
          }}
          properties={properties}
          categories={categories}
          initial={review.initial}
          documentId={review.documentId}
          aiConfidence={review.confidence}
        />
      )}
    </>
  );
}
