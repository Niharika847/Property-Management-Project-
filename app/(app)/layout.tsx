import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace, listMemberships } from "@/lib/workspace";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/search/command-palette";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await ensureWorkspace(supabase, user);
  const memberships = await listMemberships(supabase, user.id);
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? undefined;

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar
        email={user.email ?? ""}
        name={fullName}
        propertyCount={count ?? 0}
        workspaces={memberships.map((w) => ({ id: w.id, name: w.name, role: w.role }))}
        activeWorkspaceId={workspace?.id ?? ""}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
