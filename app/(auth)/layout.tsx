export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-3xl" aria-hidden>
            🪺
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Roost</h1>
          <p className="mt-1 text-sm text-muted">Property finances that organize themselves</p>
        </div>
        <div className="rounded-(--radius-card) border border-line bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
