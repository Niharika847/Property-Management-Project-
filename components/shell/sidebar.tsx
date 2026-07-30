"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NAV_GROUPS, isActivePath } from "./nav-items";
import { UserCard } from "./user-card";
import { WorkspaceSwitcher, type SwitcherItem } from "./workspace-switcher";

export function Sidebar({
  email,
  name,
  propertyCount,
  workspaces = [],
  activeWorkspaceId = "",
}: {
  email: string;
  name?: string;
  propertyCount: number;
  workspaces?: SwitcherItem[];
  activeWorkspaceId?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-side-bg p-3 md:flex">
      <div className="flex items-center gap-2.5 px-3 py-4">
        <span
          className="flex size-9 items-center justify-center rounded-xl text-lg"
          style={{ background: "rgba(255,255,255,0.1)" }}
          aria-hidden
        >
          🪺
        </span>
        <span className="wordmark text-2xl font-bold tracking-tight text-side-ink">Roost</span>
      </div>

      <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("roost:open-search"))}
        className="mx-1 mt-1 flex items-center gap-2.5 rounded-(--radius-field) border border-side-line px-3 py-2 text-sm text-side-muted transition-colors hover:bg-side-active/50 hover:text-side-ink"
      >
        <Search className="size-[1.15rem]" aria-hidden />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-side-line px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <nav className="mt-4 flex flex-1 flex-col gap-6 overflow-y-auto px-1" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-side-muted uppercase">
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
    </aside>
  );
}
