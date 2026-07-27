"use server";

import { actionContext } from "@/lib/action-helpers";

export interface SearchHit {
  label: string;
  sub: string;
  href: string;
}
export interface SearchResults {
  properties: SearchHit[];
  expenses: SearchHit[];
  documents: SearchHit[];
  tenants: SearchHit[];
}

const EMPTY: SearchResults = { properties: [], expenses: [], documents: [], tenants: [] };

export async function searchLedger(qRaw: string): Promise<SearchResults> {
  // Strip characters that would break the PostgREST .or() filter grammar.
  const q = qRaw.replace(/[%,()]/g, " ").trim();
  const ctx = await actionContext();
  if (!ctx || q.length < 2) return EMPTY;

  const wid = ctx.workspace.id;
  const like = `%${q}%`;

  const [props, exps, docs, tenants] = await Promise.all([
    ctx.supabase
      .from("properties")
      .select("id, address, suburb, status")
      .eq("workspace_id", wid)
      .or(`address.ilike.${like},suburb.ilike.${like}`)
      .limit(6),
    ctx.supabase
      .from("expenses")
      .select("id, description, vendor, properties ( address )")
      .eq("workspace_id", wid)
      .or(`description.ilike.${like},vendor.ilike.${like}`)
      .order("date", { ascending: false })
      .limit(6),
    ctx.supabase
      .from("documents")
      .select("id, file_name, type")
      .eq("workspace_id", wid)
      .ilike("file_name", like)
      .limit(6),
    ctx.supabase
      .from("tenants")
      .select("id, full_name, email")
      .eq("workspace_id", wid)
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(6),
  ]);

  return {
    properties: (props.data ?? []).map((p) => ({
      label: p.address,
      sub: [p.suburb, p.status].filter(Boolean).join(" · "),
      href: `/properties/${p.id}`,
    })),
    expenses: (exps.data ?? []).map((e) => ({
      label: e.description,
      sub:
        [e.vendor, (e.properties as unknown as { address: string } | null)?.address]
          .filter(Boolean)
          .join(" · ") || "Expense",
      href: "/expenses",
    })),
    documents: (docs.data ?? []).map((d) => ({
      label: d.file_name,
      sub: d.type,
      href: "/documents",
    })),
    tenants: (tenants.data ?? []).map((t) => ({
      label: t.full_name,
      sub: t.email || "Tenant",
      href: "/income",
    })),
  };
}
