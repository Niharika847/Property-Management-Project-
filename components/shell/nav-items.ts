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
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Single source of truth for navigation, shared by the desktop sidebar and
 *  the mobile drawer so the two can never drift apart. */
export const NAV_GROUPS: NavGroup[] = [
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

/** True when a nav href should render as the current page. */
export const isActivePath = (pathname: string, href: string): boolean =>
  href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
