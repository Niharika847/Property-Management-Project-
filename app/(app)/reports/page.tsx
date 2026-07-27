import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";
import type { Property } from "@/lib/types";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address")
    .order("address");

  return <ReportsView properties={(properties ?? []) as Pick<Property, "id" | "address">[]} />;
}
