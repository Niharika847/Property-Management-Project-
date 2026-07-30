import type { SupabaseClient } from "@supabase/supabase-js";

export type EventKind = "rent_due" | "rent_paid" | "lease_end" | "bill";

export interface CalEvent {
  id: string;
  date: string; // yyyy-mm-dd
  kind: EventKind;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
}

/** Month bounds as plain yyyy-mm-dd strings — no Date maths, so no timezone drift. */
export function monthBounds(month: string): { start: string; end: string; year: number; m: number } {
  const [y, mm] = month.split("-").map(Number);
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const m = Number.isFinite(mm) && mm >= 1 && mm <= 12 ? mm : new Date().getMonth() + 1;
  const last = new Date(year, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: `${year}-${p(m)}-01`, end: `${year}-${p(m)}-${p(last)}`, year, m };
}

export const shiftMonth = (month: string, delta: number): string => {
  const { year, m } = monthBounds(month);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Everything scheduled in a month, pulled straight from the ledger. */
export async function buildCalendarEvents(
  supabase: SupabaseClient,
  workspaceId: string,
  month: string
): Promise<CalEvent[]> {
  const { start, end } = monthBounds(month);

  const [charges, leases, bills] = await Promise.all([
    supabase
      .from("rent_charges")
      .select("id, due_date, amount, status, leases ( properties ( address ), tenants ( full_name ) )")
      .eq("workspace_id", workspaceId)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date"),
    supabase
      .from("leases")
      .select("id, end_date, property_id, properties ( address )")
      .eq("workspace_id", workspaceId)
      .not("end_date", "is", null)
      .gte("end_date", start)
      .lte("end_date", end),
    supabase
      .from("expenses")
      .select("id, date, amount, description, payment_status, categories ( name ), properties ( address )")
      .eq("workspace_id", workspaceId)
      .neq("payment_status", "paid")
      .gte("date", start)
      .lte("date", end),
  ]);

  const events: CalEvent[] = [];

  for (const c of (charges.data ?? []) as unknown as {
    id: string;
    due_date: string;
    amount: number;
    status: string;
    leases: { properties: { address: string } | null; tenants: { full_name: string } | null } | null;
  }[]) {
    const paid = c.status === "paid";
    events.push({
      id: `rc-${c.id}`,
      date: c.due_date,
      kind: paid ? "rent_paid" : "rent_due",
      title: paid ? "Rent received" : "Rent due",
      detail: [c.leases?.properties?.address, c.leases?.tenants?.full_name]
        .filter(Boolean)
        .join(" · "),
      amount: Number(c.amount),
      href: "/income",
    });
  }

  for (const l of (leases.data ?? []) as unknown as {
    id: string;
    end_date: string;
    property_id: string;
    properties: { address: string } | null;
  }[]) {
    events.push({
      id: `le-${l.id}`,
      date: l.end_date,
      kind: "lease_end",
      title: "Lease ends",
      detail: l.properties?.address ?? "Property",
      amount: null,
      href: `/properties/${l.property_id}`,
    });
  }

  for (const b of (bills.data ?? []) as unknown as {
    id: string;
    date: string;
    amount: number;
    description: string;
    payment_status: string;
    categories: { name: string } | null;
    properties: { address: string } | null;
  }[]) {
    events.push({
      id: `bill-${b.id}`,
      date: b.date,
      kind: "bill",
      title: b.payment_status === "scheduled" ? "Bill scheduled" : "Bill unpaid",
      detail: [b.categories?.name, b.description, b.properties?.address].filter(Boolean).join(" · "),
      amount: Number(b.amount),
      href: "/expenses",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
