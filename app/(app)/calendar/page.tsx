import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Bills due, lease events, maintenance, and mortgage payments."
      />
      <EmptyState
        icon={Calendar}
        title="Nothing scheduled"
        body="Due dates from rent, bills, and leases will populate this calendar automatically."
      />
    </>
  );
}
