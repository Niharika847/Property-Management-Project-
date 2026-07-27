"use client";

import { seedSampleData } from "@/app/(app)/dashboard/seed-actions";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await seedSampleData();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 rounded-(--radius-field) border border-line bg-card px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4 text-brand" aria-hidden />
        )}
        {loading ? "Loading sample portfolio…" : "Load a sample portfolio"}
      </button>
      <span className="text-xs text-muted">3 properties with 6 months of rent and expenses</span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
