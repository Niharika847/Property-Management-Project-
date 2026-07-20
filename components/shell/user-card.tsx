"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function UserCard({ email, propertyCount }: { email: string; propertyCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const ref = useRef<HTMLDivElement>(null);

  const name = nameFromEmail(email);
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("roost-theme", next);
    setTheme(next);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-full rounded-(--radius-field) border border-line bg-card p-1.5 shadow-xl"
        >
          <div className="truncate px-3 py-2 text-xs text-muted">{email}</div>
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-brand-soft"
          >
            {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-brand-soft"
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-(--radius-field) border border-side-line px-3 py-2.5 text-left transition-colors hover:bg-side-active/60"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "var(--amber)" }}
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-side-ink">{name}</span>
          <span className="block truncate text-xs text-side-muted">
            {propertyCount} propert{propertyCount === 1 ? "y" : "ies"}
          </span>
        </span>
      </button>
    </div>
  );
}
