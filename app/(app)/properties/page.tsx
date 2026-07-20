import { createClient } from "@/lib/supabase/server";
import { PropertiesView } from "@/components/properties/properties-view";
import type { Lease, Property } from "@/lib/types";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const [{ data: properties }, { data: leases }] = await Promise.all([
    supabase.from("properties").select("*").order("created_at"),
    supabase.from("leases").select("*").eq("status", "active"),
  ]);

  const leasesByProperty: Record<string, Lease> = {};
  for (const lease of (leases ?? []) as Lease[]) {
    leasesByProperty[lease.property_id] = lease;
  }

  return (
    <PropertiesView
      properties={(properties ?? []) as Property[]}
      leasesByProperty={leasesByProperty}
    />
  );
}
