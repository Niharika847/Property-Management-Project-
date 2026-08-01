import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace, listMemberships } from "@/lib/workspace";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
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
    // Fixed-height app shell: the page itself never scrolls. Individual panels
    // own their overflow, so the layout always fits the viewport.
    <div className="flex min-h-dvh bg-bg lg:h-dvh lg:overflow-hidden">
      <Sidebar
        email={user.email ?? ""}
        name={fullName}
        propertyCount={count ?? 0}
        workspaces={memberships.map((w) => ({ id: w.id, name: w.name, role: w.role }))}
        activeWorkspaceId={workspace?.id ?? ""}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileNav
          email={user.email ?? ""}
          name={fullName}
          propertyCount={count ?? 0}
          workspaces={memberships.map((w) => ({ id: w.id, name: w.name, role: w.role }))}
          activeWorkspaceId={workspace?.id ?? ""}
        />
        <main className="mx-auto flex w-full min-h-0 max-w-[1500px] flex-1 flex-col p-3 md:p-4 lg:p-5">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
