import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/shell/sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureWorkspace(supabase, user);
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar email={user.email ?? ""} propertyCount={count ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
