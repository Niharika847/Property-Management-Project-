"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PeriodToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const period = params.get("period") === "week" ? "week" : "month";

  function set(next: "week" | "month") {
    const q = new URLSearchParams(params);
    q.set("period", next);
    router.push(`/dashboard?${q.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-(--radius-field) border border-line bg-card p-1">
      {(["week", "month"] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => set(p)}
          aria-pressed={period === p}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            period === p ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"
          }`}
        >
          Per {p}
        </button>
      ))}
    </div>
  );
}
