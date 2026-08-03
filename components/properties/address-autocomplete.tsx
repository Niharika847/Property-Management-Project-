"use client";

import type { AddressDetail, PropertyAttributes } from "@/lib/address/types";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface AddressPick {
  detail: AddressDetail;
  attributes: PropertyAttributes | null;
  attributesAvailable: boolean;
}

/** Address field with suggestions. Stays a plain text input at heart: the user
 *  can ignore the dropdown entirely and type whatever they like, because
 *  address data never has full coverage and a form that refuses unlisted
 *  addresses is worse than one with no autocomplete at all. */
export function AddressAutocomplete({
  name,
  label,
  defaultValue,
  onPick,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  onPick: (pick: AddressPick) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<{ id: string; label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  // Guards against a slow earlier request overwriting a newer one's results.
  const requestSeq = useRef(0);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 4) {
      setSuggestions([]);
      return;
    }
    // Debounced: one request per pause in typing, not one per keystroke.
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/address?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== requestSeq.current) return;
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
        setActive(-1);
      } catch {
        if (seq === requestSeq.current) setSuggestions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function choose(suggestion: { id: string; label: string }) {
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/address?id=${encodeURIComponent(suggestion.id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as AddressPick;
      // Show the street line in this field; the rest fans out to its own input.
      skipNextSearch.current = true;
      setValue(data.detail.street || suggestion.label);
      onPick(data);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // Only intercept Enter while a suggestion is highlighted, so Enter still
      // submits the form normally.
      e.preventDefault();
      void choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={`${listId}-input`}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Start typing an address…"
          required
          className="h-10 w-full rounded-(--radius-field) border border-line bg-card px-3 pr-9 text-sm text-ink outline-none focus:border-brand"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <MapPin className="size-4" aria-hidden />
          )}
        </span>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-(--radius-field) border border-line bg-card shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-brand-soft text-ink" : "text-muted hover:bg-brand-soft/50"
                }`}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
