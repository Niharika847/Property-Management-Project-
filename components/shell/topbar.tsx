import { Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar({ email }: { email: string }) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-card px-4 md:px-6">
      <span className="text-xl md:hidden" aria-hidden>
        🪺
      </span>
      <div className="flex h-10 flex-1 items-center gap-2 rounded-(--radius-field) border border-line bg-bg px-3 text-sm text-muted">
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search properties, expenses, tenants…</span>
        <span className="sm:hidden">Search…</span>
        <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] md:inline">
          ⌘K
        </kbd>
      </div>
      <ThemeToggle />
      <UserMenu email={email} />
    </header>
  );
}
