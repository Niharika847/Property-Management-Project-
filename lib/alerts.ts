import type { SupabaseClient } from "@supabase/supabase-js";
import { audCents, fmtDate, todayISO } from "@/lib/format";

export type Severity = "critical" | "warning" | "info";

export interface Alert {
  /** Stable key so a dismissal survives page loads. */
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  href: string;
  date?: string;
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

/** Derives the current alert list straight from the ledger, so it is always
 *  accurate without a background job keeping a table in sync. */
export async function buildAlerts(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<Alert[]> {
  const today = todayISO();
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  const soonISO = soon.toISOString().slice(0, 10);
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const weekISO = week.toISOString().slice(0, 10);

  const [overdue, upcoming, properties, leases, unfiled] = await Promise.all([
    supabase
      .from("rent_charges")
      .select("id, amount, due_date, leases ( properties ( address ), tenants ( full_name ) )")
      .eq("workspace_id", workspaceId)
      .eq("status", "expected")
      .lte("due_date", today)
      .order("due_date"),
    supabase
      .from("rent_charges")
      .select("id, amount, due_date, leases ( properties ( address ) )")
      .eq("workspace_id", workspaceId)
      .eq("status", "expected")
      .gt("due_date", today)
      .lte("due_date", weekISO)
      .order("due_date"),
    supabase
      .from("properties")
      .select("id, address, status, current_value")
      .eq("workspace_id", workspaceId),
    supabase
      .from("leases")
      .select("id, end_date, property_id, properties ( address )")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .not("end_date", "is", null)
      .lte("end_date", soonISO),
    supabase
      .from("documents")
      .select("id, file_name, created_at")
      .eq("workspace_id", workspaceId)
      .is("expense_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const alerts: Alert[] = [];

  for (const c of (overdue.data ?? []) as unknown as {
    id: string;
    amount: number;
    due_date: string;
    leases: { properties: { address: string } | null; tenants: { full_name: string } | null } | null;
  }[]) {
    const late = daysBetween(today, c.due_date);
    alerts.push({
      key: `rent-late-${c.id}`,
      severity: late > 7 ? "critical" : "warning",
      title: `Rent ${audCents(Number(c.amount))} unpaid`,
      detail: `${c.leases?.properties?.address ?? "Property"}${
        c.leases?.tenants?.full_name ? ` · ${c.leases.tenants.full_name}` : ""
      } · due ${fmtDate(c.due_date)}${late > 0 ? ` (${late} day${late === 1 ? "" : "s"} ago)` : ""}`,
      href: "/income",
      date: c.due_date,
    });
  }

  for (const p of (properties.data ?? []).filter((p) => p.status === "vacant")) {
    alerts.push({
      key: `vacant-${p.id}`,
      severity: "warning",
      title: `${p.address} is vacant`,
      detail: "No rent is coming in while this property sits empty.",
      href: `/properties/${p.id}`,
    });
  }

  for (const l of (leases.data ?? []) as unknown as {
    id: string;
    end_date: string;
    property_id: string;
    properties: { address: string } | null;
  }[]) {
    const days = daysBetween(l.end_date, today);
    alerts.push({
      key: `lease-end-${l.id}`,
      severity: days <= 14 ? "warning" : "info",
      title: `Lease ends ${days < 0 ? "ended" : `in ${days} day${days === 1 ? "" : "s"}`}`,
      detail: `${l.properties?.address ?? "Property"} · ${fmtDate(l.end_date)} — arrange a renewal or re-listing.`,
      href: `/properties/${l.property_id}`,
      date: l.end_date,
    });
  }

  const unfiledDocs = unfiled.data ?? [];
  if (unfiledDocs.length > 0) {
    alerts.push({
      key: `docs-unfiled-${unfiledDocs.length}`,
      severity: "info",
      title: `${unfiledDocs.length} document${unfiledDocs.length === 1 ? "" : "s"} not filed yet`,
      detail: "Review them to turn each receipt into an expense.",
      href: "/documents",
    });
  }

  const unvalued = (properties.data ?? []).filter(
    (p) => !p.current_value && p.status !== "sold"
  );
  if (unvalued.length > 0) {
    alerts.push({
      key: `no-valuation-${unvalued.length}`,
      severity: "info",
      title: `${unvalued.length} propert${unvalued.length === 1 ? "y has" : "ies have"} no valuation`,
      detail: "Add a current value so portfolio worth and yield are accurate.",
      href: "/properties",
    });
  }

  const upcomingRows = upcoming.data ?? [];
  if (upcomingRows.length > 0) {
    const total = upcomingRows.reduce((s, c) => s + Number(c.amount), 0);
    alerts.push({
      key: `rent-upcoming-${upcomingRows.length}`,
      severity: "info",
      title: `${audCents(total)} rent due this week`,
      detail: `${upcomingRows.length} payment${upcomingRows.length === 1 ? "" : "s"} scheduled in the next 7 days.`,
      href: "/income",
    });
  }

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
