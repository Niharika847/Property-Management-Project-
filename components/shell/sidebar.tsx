"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  FileBarChart,
  LineChart,
  Calendar,
  Sparkles,
  Bell,
  Settings,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserCard } from "./user-card";

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Portfolio",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/income", label: "Income", icon: ArrowDownToLine },
      { href: "/expenses", label: "Expenses", icon: ArrowUpFromLine },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/assistant", label: "AI Assistant", icon: Sparkles },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  email,
  name,
  propertyCount,
}: {
  email: string;
  name?: string;
  propertyCount: number;
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
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-side-muted uppercase">
              {group.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(href);
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
