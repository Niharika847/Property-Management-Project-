"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AskBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-1 items-center gap-2 rounded-(--radius-card) border border-line bg-card px-4 py-2.5 shadow-sm"
    >
      <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask Roost — “log $240 plumbing at Marine Parade” or “what’s my net?”"
        aria-label="Ask Roost"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-(--radius-field) bg-brand px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Ask
      </button>
    </form>
  );
}
