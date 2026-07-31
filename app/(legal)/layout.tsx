import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            🪺
          </span>
          <span className="wordmark text-2xl font-bold text-ink">Roost</span>
        </Link>
        <article className="prose mt-8 text-ink">{children}</article>
        <footer className="mt-12 flex gap-4 border-t border-line pt-6 text-sm text-muted">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
