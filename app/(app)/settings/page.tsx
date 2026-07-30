import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { SettingsView } from "@/components/settings/settings-view";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await ensureWorkspace(supabase, user);

  const [{ count: properties }, { count: expenses }, { count: documents }, { data: ws }] =
    await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }),
      supabase.from("expenses").select("id", { count: "exact", head: true }),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("workspaces").select("plan").eq("id", workspace?.id ?? "").maybeSingle(),
    ]);

  return (
    <SettingsView
      email={user.email ?? ""}
      fullName={(user.user_metadata?.full_name as string | undefined) ?? ""}
      workspaceName={workspace?.name ?? "My Portfolio"}
      currency={workspace?.currency ?? "AUD"}
      plan={(ws?.plan as string | undefined) ?? "free"}
      usage={{
        properties: properties ?? 0,
        expenses: expenses ?? 0,
        documents: documents ?? 0,
      }}
    />
  );
}
