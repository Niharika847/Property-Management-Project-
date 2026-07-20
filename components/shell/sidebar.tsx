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
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/income", label: "Income", icon: ArrowDownToLine },
  { href: "/expenses", label: "Expenses", icon: ArrowUpFromLine },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span aria-hidden className="text-xl">
          🪺
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink">Roost</div>
          <div className="truncate text-xs text-muted">{workspaceName}</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-(--radius-field) px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-soft font-semibold text-brand"
                  : "text-muted hover:bg-brand-soft/50 hover:text-ink"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`flex items-center gap-3 rounded-(--radius-field) px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-brand-soft font-semibold text-brand"
              : "text-muted hover:bg-brand-soft/50 hover:text-ink"
          }`}
        >
          <Settings className="size-4" aria-hidden />
          Settings
        </Link>
      </div>
    </aside>
  );
}
