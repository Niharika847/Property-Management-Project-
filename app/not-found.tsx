import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Compass className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        That page doesn&apos;t exist, or the property was removed.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
