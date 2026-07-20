import { createClient } from "@/lib/supabase/server";
import { IncomeView } from "@/components/income/income-view";
import { fyRange, todayISO } from "@/lib/format";
import type { Income, Property, RentCharge } from "@/lib/types";

export default async function IncomePage() {
  const supabase = await createClient();
  const fy = fyRange();
  const today = todayISO();

  // Top up rent schedules so the next ~60 days of charges always exist.
  const { data: activeLeases } = await supabase
    .from("leases")
    .select("id")
    .eq("status", "active");
  await Promise.all(
    (activeLeases ?? []).map((l) =>
      supabase.rpc("generate_rent_charges", { p_lease_id: l.id })
    )
  );

  const chargeSelect =
    "id, lease_id, due_date, amount, status, paid_amount, leases ( property_id, frequency, properties ( address ), tenants ( full_name ) )";

  const [{ data: overdue }, { data: upcoming }, { data: history }, { data: properties }] =
    await Promise.all([
      supabase
        .from("rent_charges")
        .select(chargeSelect)
        .eq("status", "expected")
        .lte("due_date", today)
        .order("due_date"),
      supabase
        .from("rent_charges")
        .select(chargeSelect)
        .eq("status", "expected")
        .gt("due_date", today)
        .order("due_date")
        .limit(8),
      supabase
        .from("income")
        .select("id, property_id, type, date, amount, description, properties ( address )")
        .order("date", { ascending: false })
        .limit(50),
      supabase.from("properties").select("id, address").order("address"),
    ]);

  const historyRows = (history ?? []) as unknown as Income[];
  const fyTotal = historyRows
    .filter((r) => r.date >= fy.start && r.date <= fy.end)
    .reduce((s, r) => s + Number(r.amount), 0);
  const overdueRows = (overdue ?? []) as unknown as RentCharge[];
  const outstanding = overdueRows.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <IncomeView
      overdue={overdueRows}
      upcoming={(upcoming ?? []) as unknown as RentCharge[]}
      history={historyRows}
      properties={(properties ?? []) as Pick<Property, "id" | "address">[]}
      fyTotal={fyTotal}
      fyLabel={fy.label}
      outstanding={outstanding}
    />
  );
}
