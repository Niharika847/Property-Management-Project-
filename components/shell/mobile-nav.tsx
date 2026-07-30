"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Search } from "lucide-react";
import { NAV_GROUPS, isActivePath } from "./nav-items";
import { UserCard } from "./user-card";
import { WorkspaceSwitcher, type SwitcherItem } from "./workspace-switcher";

/** Phone navigation: a top bar plus a slide-over drawer.
 *  The desktop sidebar is hidden under `md`, so without this there is no way
 *  to reach any page but the dashboard on a phone. */
export function MobileNav({
  email,
  name,
  propertyCount,
  workspaces,
  activeWorkspaceId,
}: {
  email: string;
  name?: string;
  propertyCount: number;
  workspaces: SwitcherItem[];
  activeWorkspaceId: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-side-line bg-side-bg px-3 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-(--radius-field) text-side-ink hover:bg-side-active/60"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Link href="/dashboard" className="flex flex-1 items-center gap-2">
          <span aria-hidden className="text-lg">
            🪺
          </span>
          <span className="wordmark text-xl font-bold text-side-ink">Roost</span>
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("roost:open-search"))}
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-(--radius-field) text-side-ink hover:bg-side-active/60"
        >
          <Search className="size-5" aria-hidden />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col bg-side-bg p-3">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  🪺
                </span>
                <span className="wordmark text-xl font-bold text-side-ink">Roost</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-9 items-center justify-center rounded-(--radius-field) text-side-ink hover:bg-side-active/60"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />

            <nav className="mt-3 flex flex-1 flex-col gap-5 overflow-y-auto px-1" aria-label="Main">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-[0.12em] text-side-muted uppercase">
                    {group.title}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const active = isActivePath(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-(--radius-field) px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? "bg-side-active font-semibold text-side-active-ink"
                              : "text-side-muted hover:bg-side-active/50 hover:text-side-ink"
                          }`}
                        >
                          <Icon className="size-[1.15rem]" aria-hidden />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="pt-3">
              <UserCard email={email} name={name} propertyCount={propertyCount} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
