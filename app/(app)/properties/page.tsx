import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export default function PropertiesPage() {
  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Every property you own, with its status, rent, and performance."
      />
      <EmptyState
        icon={Building2}
        title="No properties yet"
        body="Add a property to start tracking its income, expenses, and value. Property creation arrives in the next build phase."
      />
    </>
  );
}
