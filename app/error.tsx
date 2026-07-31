"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console and, for server errors, in Vercel logs
    // alongside the matching digest.
    console.error(
      JSON.stringify({ level: "error", event: "client.render_error", message: error.message, digest: error.digest })
    );
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        This page didn&apos;t load properly. Your data is safe — nothing was changed.
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted">Reference: {error.digest}</p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-(--radius-field) border border-line bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-soft/50"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
