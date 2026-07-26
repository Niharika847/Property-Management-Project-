"use server";

import { revalidatePath } from "next/cache";
import { actionContext, fail, ok, type ActionResult } from "@/lib/action-helpers";
import {
  aiConfigured,
  isVisionType,
  extractReceipt,
  friendlyAiError,
  type ReceiptExtraction,
} from "@/lib/anthropic";

export interface IngestResult {
  documentId: string;
  extraction: (ReceiptExtraction & { category_id: string | null }) | null;
  message: string | null;
}

/** Records an uploaded receipt and, when possible, reads it with AI.
 *  The file is already in storage at `path`; we only receive the pointer. */
export async function ingestReceipt(input: {
  path: string;
  fileName: string;
  mime: string | null;
  size: number | null;
}): Promise<{ ok: true; data: IngestResult } | { ok: false; error: string }> {
  const ctx = await actionContext();
  if (!ctx) return { ok: false, error: "You're signed out — log in again." };

  const { data: doc, error } = await ctx.supabase
    .from("documents")
    .insert({
      workspace_id: ctx.workspace.id,
      type: "receipt",
      file_name: input.fileName,
      storage_path: input.path,
      mime: input.mime,
      size_bytes: input.size,
      ocr_status: "processing",
    })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: error?.message ?? "Couldn't save the document." };

  revalidatePath("/documents");

  if (!aiConfigured()) {
    await ctx.supabase.from("documents").update({ ocr_status: "pending" }).eq("id", doc.id);
    return {
      ok: true,
      data: { documentId: doc.id, extraction: null, message: "AI reading is off — add ANTHROPIC_API_KEY to enable it. Enter the details manually." },
    };
  }
  if (!isVisionType(input.mime)) {
    await ctx.supabase.from("documents").update({ ocr_status: "pending" }).eq("id", doc.id);
    return {
      ok: true,
      data: { documentId: doc.id, extraction: null, message: "AI reading supports photos (JPG/PNG/WebP). Enter the details manually." },
    };
  }

  try {
    const { data: file, error: dlError } = await ctx.supabase.storage
      .from("receipts")
      .download(input.path);
    if (dlError || !file) throw new Error("Couldn't read the uploaded file.");
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const { data: cats } = await ctx.supabase
      .from("categories")
      .select("id, name")
      .eq("kind", "expense");
    const categories = cats ?? [];

    const extraction = await extractReceipt({
      base64,
      mediaType: input.mime as string,
      categories: categories.map((c) => c.name),
    });

    const match = extraction.category
      ? categories.find((c) => c.name.toLowerCase() === extraction.category!.toLowerCase())
      : undefined;

    await ctx.supabase
      .from("documents")
      .update({ ocr_status: "done", extracted: extraction })
      .eq("id", doc.id);

    revalidatePath("/documents");
    return {
      ok: true,
      data: { documentId: doc.id, extraction: { ...extraction, category_id: match?.id ?? null }, message: null },
    };
  } catch (e) {
    await ctx.supabase.from("documents").update({ ocr_status: "failed" }).eq("id", doc.id);
    return {
      ok: true,
      data: {
        documentId: doc.id,
        extraction: null,
        message: friendlyAiError(e),
      },
    };
  }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx) return fail("You're signed out — log in again.");

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (doc?.storage_path) {
    await ctx.supabase.storage.from("receipts").remove([doc.storage_path]);
  }
  const { error } = await ctx.supabase.from("documents").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/documents");
  return ok();
}
