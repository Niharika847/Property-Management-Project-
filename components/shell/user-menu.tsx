"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = (email[0] ?? "?").toUpperCase();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-(--radius-card) border border-line bg-card p-2 shadow-lg"
        >
          <div className="truncate px-3 py-2 text-xs text-muted">{email}</div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-(--radius-field) px-3 py-2 text-left text-sm text-ink hover:bg-brand-soft/50"
          >
            <LogOut className="size-4" aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
