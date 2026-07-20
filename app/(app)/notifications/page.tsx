import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" subtitle="Rent alerts, due bills, and AI insights." />
      <EmptyState
        icon={Bell}
        title="You're all caught up"
        body="Late rent, upcoming bills, and items needing review will show up here."
      />
    </>
  );
}
