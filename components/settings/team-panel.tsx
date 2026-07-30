"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  inviteMember,
  revokeInvite,
  acceptInvite,
  changeMemberRole,
  removeMember,
  leaveWorkspace,
} from "@/app/(app)/settings/team-actions";
import { ROLE_LABEL, ROLE_BLURB, type Role } from "@/lib/roles";
import { Users, UserPlus, Mail, X, LogOut, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Member {
  userId: string;
  role: Role;
  email: string;
  fullName: string | null;
  isYou: boolean;
}
export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
}
export interface IncomingInvite {
  id: string;
  role: Role;
  workspaceName: string;
}

const INVITABLE: Role[] = ["manager", "accountant", "viewer"];

export function TeamPanel({
  members,
  pending,
  incoming,
  canEdit,
  isOwner,
  workspaceName,
}: {
  members: Member[];
  pending: PendingInvite[];
  incoming: IncomingInvite[];
  canEdit: boolean;
  isOwner: boolean;
  workspaceName: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("accountant");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const okDone = await run("invite", () => inviteMember(email, role));
    if (okDone) {
      setEmail("");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    }
  }

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6 lg:col-span-2">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Users className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-ink">Team</h2>
          <p className="text-sm text-muted">
            Invite your accountant or partner to <span className="text-ink">{workspaceName}</span>.
            Accountants and viewers get read-only access.
          </p>
        </div>
      </div>

      {/* Invites addressed to me */}
      {incoming.length > 0 && (
        <div className="mb-5 flex flex-col gap-3">
          {incoming.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-field) border border-brand/40 bg-brand-soft px-4 py-3"
            >
              <div className="text-sm">
                <div className="font-semibold text-ink">
                  You&apos;ve been invited to {inv.workspaceName}
                </div>
                <div className="text-muted">as {ROLE_LABEL[inv.role]}</div>
              </div>
              <Button loading={busy === `accept-${inv.id}`} onClick={() => run(`accept-${inv.id}`, () => acceptInvite(inv.id))}>
                Accept invite
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Members */}
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {(m.fullName || m.email || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">
                  {m.fullName || m.email}
                  {m.isYou && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted">{m.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && !m.isYou ? (
                <select
                  aria-label={`Role for ${m.email}`}
                  value={m.role}
                  onChange={(e) => run(`role-${m.userId}`, () => changeMemberRole(m.userId, e.target.value as Role))}
                  disabled={busy === `role-${m.userId}`}
                  className="h-9 rounded-(--radius-field) border border-line bg-card px-2 text-sm text-ink"
                >
                  {(["manager", "accountant", "viewer"] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-code-bg px-2.5 py-1 text-xs font-semibold text-muted">
                  {ROLE_LABEL[m.role]}
                </span>
              )}
              {isOwner && !m.isYou && (
                <button
                  type="button"
                  onClick={() => run(`rm-${m.userId}`, () => removeMember(m.userId))}
                  disabled={busy === `rm-${m.userId}`}
                  aria-label={`Remove ${m.email}`}
                  className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Pending invites we sent */}
      {pending.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold tracking-wide text-muted uppercase">Pending invites</div>
          <ul className="mt-2 divide-y divide-line">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Mail className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-ink">{inv.email}</span>
                  <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
                    {ROLE_LABEL[inv.role]}
                  </span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => run(`inv-${inv.id}`, () => revokeInvite(inv.id))}
                    disabled={busy === `inv-${inv.id}`}
                    className="shrink-0 text-xs text-muted hover:text-danger disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form */}
      {canEdit && (
        <form onSubmit={onInvite} className="mt-5 border-t border-line pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Invite by email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accountant@firm.com.au"
              />
            </div>
            <div className="sm:w-44">
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {INVITABLE.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" loading={busy === "invite"} disabled={!email.trim()}>
              <UserPlus className="size-4" aria-hidden /> Invite
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">{ROLE_BLURB[role]}</p>
          {sent && (
            <p className="mt-2 flex items-center gap-1 text-sm text-brand">
              <Check className="size-4" aria-hidden /> Invite created — they&apos;ll see it in
              Settings once they sign in with that email.
            </p>
          )}
        </form>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!isOwner && (
        <div className="mt-5 border-t border-line pt-4">
          <Button
            variant="secondary"
            loading={busy === "leave"}
            onClick={() => run("leave", () => leaveWorkspace())}
          >
            <LogOut className="size-4" aria-hidden /> Leave this workspace
          </Button>
        </div>
      )}
    </section>
  );
}
