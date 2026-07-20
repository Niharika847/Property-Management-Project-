import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = user ? await ensureWorkspace(supabase, user) : null;

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and workspace preferences." />
      <div className="grid max-w-2xl gap-4">
        <section className="rounded-(--radius-card) border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-ink">Account</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Email</dt>
            <dd className="text-ink">{user?.email}</dd>
            <dt className="text-muted">Theme</dt>
            <dd className="text-ink">Use the sun/moon toggle in the top bar</dd>
          </dl>
        </section>
        <section className="rounded-(--radius-card) border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-ink">Workspace</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="text-ink">{workspace?.name ?? "—"}</dd>
            <dt className="text-muted">Currency</dt>
            <dd className="text-ink">{workspace?.currency ?? "AUD"}</dd>
            <dt className="text-muted">Financial year</dt>
            <dd className="text-ink">Starts 1 July (Australia)</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Editing, team invites, and billing arrive in a later phase.
          </p>
        </section>
      </div>
    </>
  );
}
