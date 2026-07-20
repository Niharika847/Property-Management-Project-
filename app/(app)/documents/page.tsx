import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { DocumentsView } from "@/components/documents/documents-view";
import type { Category, DocumentRow, Property } from "@/lib/types";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = user ? await ensureWorkspace(supabase, user) : null;

  const [{ data: documents }, { data: properties }, { data: categories }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, type, ocr_status, extracted, expense_id, created_at, properties ( address )")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("properties").select("id, address").order("address"),
    supabase
      .from("categories")
      .select("id, name, kind, tax_deductible_default, is_capital")
      .eq("kind", "expense")
      .order("name"),
  ]);

  return (
    <DocumentsView
      workspaceId={workspace?.id ?? ""}
      documents={(documents ?? []) as unknown as DocumentRow[]}
      properties={(properties ?? []) as Pick<Property, "id" | "address">[]}
      categories={(categories ?? []) as Category[]}
    />
  );
}
