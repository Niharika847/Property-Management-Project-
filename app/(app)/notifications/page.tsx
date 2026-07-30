import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { buildAlerts } from "@/lib/alerts";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await ensureWorkspace(supabase, user);
  const alerts = workspace ? await buildAlerts(supabase, workspace.id) : [];

  return <NotificationsView alerts={alerts} />;
}
