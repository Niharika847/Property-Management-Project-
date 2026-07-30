"use client";

import { switchWorkspace } from "@/app/(app)/settings/team-actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { Check, ChevronsUpDown, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface SwitcherItem {
  id: string;
  name: string;
  role: Role;
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: SwitcherItem[];
  activeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  if (!active || workspaces.length < 2) return null;

  async function pick(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setBusy(id);
    await switchWorkspace(id);
    setBusy(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative mx-1 mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-(--radius-field) border border-side-line px-3 py-2 text-left text-sm text-side-ink transition-colors hover:bg-side-active/50"
      >
        <Briefcase className="size-4 shrink-0 text-side-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{active.name}</span>
          <span className="block truncate text-[0.7rem] text-side-muted">
            {ROLE_LABEL[active.role]}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-side-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-(--radius-field) border border-line bg-card p-1 shadow-xl"
        >
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="option"
              aria-selected={w.id === activeId}
              onClick={() => pick(w.id)}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-brand-soft disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{w.name}</span>
                <span className="block truncate text-xs text-muted">{ROLE_LABEL[w.role]}</span>
              </span>
              {w.id === activeId && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
