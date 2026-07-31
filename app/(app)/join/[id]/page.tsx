import { createClient } from "@/lib/supabase/server";
import { AcceptInvite } from "@/components/settings/accept-invite";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";

/** Landing page for a shared invite link: /join/<invite id>.
 *  Signed-out visitors are sent to login and returned here afterwards. */
export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${id}`);

  // RLS only returns this row if the invite is addressed to the caller's email.
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("id, role, workspaces ( name )")
    .eq("id", id)
    .is("accepted_at", null)
    .maybeSingle();

  const workspaceName =
    (invite?.workspaces as unknown as { name: string } | null)?.name ?? null;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      {invite && workspaceName ? (
        <AcceptInvite
          inviteId={invite.id as string}
          workspaceName={workspaceName}
          roleLabel={ROLE_LABEL[invite.role as Role]}
        />
      ) : (
        <div className="rounded-(--radius-card) border border-line bg-card p-8">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <TriangleAlert className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink">This invite isn&apos;t available</h1>
          <p className="mt-2 text-sm text-muted">
            It may have already been used, been revoked, or been sent to a different email address.
            You&apos;re signed in as <span className="text-ink">{user.email}</span> — ask the owner
            to re-send it to this address.
          </p>
        </div>
      )}
    </div>
  );
}
