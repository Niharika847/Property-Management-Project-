"use client";

import { searchLedger, type SearchHit, type SearchResults } from "@/app/(app)/search/actions";
import { Search, Building2, ArrowUpFromLine, FileText, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const GROUPS: { key: keyof SearchResults; label: string; icon: LucideIcon }[] = [
  { key: "properties", label: "Properties", icon: Building2 },
  { key: "expenses", label: "Expenses", icon: ArrowUpFromLine },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "tenants", label: "Tenants", icon: User },
];

type FlatItem = SearchHit & { icon: LucideIcon; group: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on ⌘K / Ctrl+K, or a custom event from the sidebar trigger.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("roost:open-search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("roost:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults(null);
      setActive(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchLedger(query);
      setResults(r);
      setActive(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const flat: FlatItem[] = useMemo(() => {
    if (!results) return [];
    return GROUPS.flatMap((g) =>
      results[g.key].map((hit) => ({ ...hit, icon: g.icon, group: g.label }))
    );
  }, [results]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].href);
    }
  }

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <button aria-label="Close search" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-(--radius-card) border border-line bg-card shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search properties, expenses, documents, tenants…"
            aria-label="Search query"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              Type at least two characters to search your portfolio.
            </p>
          ) : loading && !results ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Searching…</p>
          ) : flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            GROUPS.map((g) => {
              const hits = results![g.key];
              if (hits.length === 0) return null;
              return (
                <div key={g.key} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[0.68rem] font-semibold tracking-wide text-muted uppercase">
                    {g.label}
                  </div>
                  {hits.map((hit) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={`${g.key}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(hit.href)}
                        className={`flex w-full items-center gap-3 rounded-(--radius-field) px-3 py-2 text-left ${
                          active === idx ? "bg-brand-soft" : "hover:bg-brand-soft/50"
                        }`}
                      >
                        <g.icon className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{hit.label}</span>
                          <span className="block truncate text-xs text-muted">{hit.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
