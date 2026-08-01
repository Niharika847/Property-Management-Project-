"use client";

import { createClient } from "@/lib/supabase/client";
import { resetWorkspaceData } from "@/app/(app)/settings/actions";
import { planFor } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Check, User, Building2, CreditCard, Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PlanUsage {
  properties: number;
  expenses: number;
  documents: number;
}


function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof User;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          <p className="text-sm text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsView({
  email,
  fullName,
  workspaceName,
  currency,
  plan,
  usage,
  role,
  canEdit,
  isOwner,
  team,
  billing,
}: {
  email: string;
  fullName: string;
  workspaceName: string;
  currency: string;
  plan: string;
  usage: PlanUsage;
  role: string;
  canEdit: boolean;
  isOwner: boolean;
  team?: React.ReactNode;
  billing?: React.ReactNode;
}) {
  const router = useRouter();

  const [name, setName] = useState(fullName);
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved">("idle");
  const [nameError, setNameError] = useState<string | null>(null);

  const [wsName, setWsName] = useState(workspaceName);
  const [wsState, setWsState] = useState<"idle" | "saving" | "saved">("idle");
  const [wsError, setWsError] = useState<string | null>(null);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwState, setPwState] = useState<"idle" | "saving" | "saved">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function runReset() {
    setResetting(true);
    setResetError(null);
    const res = await resetWorkspaceData(resetConfirm.trim());
    setResetting(false);
    if (!res.ok) {
      setResetError(res.error);
      return;
    }
    setResetOpen(false);
    setResetConfirm("");
    router.refresh();
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameState("saving");
    setNameError(null);
    const { error } = await createClient().auth.updateUser({ data: { full_name: name.trim() } });
    if (error) {
      setNameError(error.message);
      setNameState("idle");
      return;
    }
    setNameState("saved");
    router.refresh();
    setTimeout(() => setNameState("idle"), 2500);
  }

  async function saveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setWsState("saving");
    setWsError(null);
    const supabase = createClient();
    const { data: member } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
    if (!member) {
      setWsError("Couldn't find your workspace.");
      setWsState("idle");
      return;
    }
    const { error } = await supabase
      .from("workspaces")
      .update({ name: wsName.trim() })
      .eq("id", member.workspace_id);
    if (error) {
      setWsError(error.message);
      setWsState("idle");
      return;
    }
    setWsState("saved");
    router.refresh();
    setTimeout(() => setWsState("idle"), 2500);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.length < 8) {
      setPwError("Use at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setPwError("The two passwords don't match.");
      return;
    }
    setPwState("saving");
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) {
      setPwError(error.message);
      setPwState("idle");
      return;
    }
    setPw("");
    setPw2("");
    setPwState("saved");
    setTimeout(() => setPwState("idle"), 3000);
  }

  const limits = planFor(plan);
  const propertyPct =
    limits.properties == null ? 0 : Math.min(100, (usage.properties / limits.properties) * 100);
  const overLimit = limits.properties != null && usage.properties > limits.properties;

  return (
    <div className="flex flex-col gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
          <p className="mt-1 text-sm text-muted">Your account, workspace, team, plan and data.</p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
          Your role: {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={User} title="Profile" desc="The name shown across Roost.">
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Niharika Singh"
            />
            <div className="text-xs text-muted">
              Signed in as <span className="text-ink">{email}</span>
            </div>
            {nameError && <p className="text-sm text-danger">{nameError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={nameState === "saving"} disabled={!name.trim() || name === fullName}>
                Save name
              </Button>
              {nameState === "saved" && (
                <span className="flex items-center gap-1 text-sm text-brand">
                  <Check className="size-4" aria-hidden /> Saved
                </span>
              )}
            </div>
          </form>
        </Section>

        <Section icon={User} title="Password" desc="Change your password without leaving the app.">
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <Input
              label="New password"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
            {pwError && <p className="text-sm text-danger">{pwError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={pwState === "saving"} disabled={!pw || !pw2}>
                Update password
              </Button>
              {pwState === "saved" && (
                <span className="flex items-center gap-1 text-sm text-brand">
                  <Check className="size-4" aria-hidden /> Password updated
                </span>
              )}
            </div>
          </form>
        </Section>

        <Section icon={Building2} title="Workspace" desc="Your portfolio's name and currency.">
          <form onSubmit={saveWorkspace} className="flex flex-col gap-3">
            <Input
              label="Workspace name"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="My Portfolio"
            />
            <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Currency</dt>
              <dd className="text-ink">{currency}</dd>
              <dt className="text-muted">Financial year</dt>
              <dd className="text-ink">1 July – 30 June (Australia)</dd>
            </dl>
            {wsError && <p className="text-sm text-danger">{wsError}</p>}
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                loading={wsState === "saving"}
                disabled={!canEdit || !wsName.trim() || wsName === workspaceName}
                title={canEdit ? undefined : "Read-only access"}
              >
                Save workspace
              </Button>
              {wsState === "saved" && (
                <span className="flex items-center gap-1 text-sm text-brand">
                  <Check className="size-4" aria-hidden /> Saved
                </span>
              )}
            </div>
          </form>
        </Section>

        <Section icon={CreditCard} title="Plan &amp; usage" desc="What you're on and what you've used.">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-lg font-bold text-ink">{limits.label}</div>
              <div className="text-sm text-muted">{limits.price}</div>
            </div>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
              Current plan
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink">Properties</span>
              <span className="num text-ink">
                {usage.properties}
                {limits.properties != null ? ` / ${limits.properties}` : " · unlimited"}
              </span>
            </div>
            {limits.properties != null && (
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-code-bg">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${propertyPct}%`,
                    background: overLimit ? "var(--terra)" : "var(--brand)",
                  }}
                />
              </div>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-line p-3">
              <dt className="text-xs text-muted">Transactions</dt>
              <dd className="num mt-0.5 font-semibold text-ink">{usage.expenses}</dd>
            </div>
            <div className="rounded-lg border border-line p-3">
              <dt className="text-xs text-muted">Documents</dt>
              <dd className="num mt-0.5 font-semibold text-ink">{usage.documents}</dd>
            </div>
          </dl>

          {overLimit && (
            <p className="mt-3 text-xs text-terra">
              You&apos;re over the {limits.label} limit — upgrading unlocks more properties.
            </p>
          )}
          {billing ?? (
            <p className="mt-4 text-xs text-muted">
              Paid plans and card payments arrive with billing (Stripe). Nothing is charged today.
            </p>
          )}
        </Section>

        {team}

        <Section
          icon={Database}
          title="Your data"
          desc="Export everything you've recorded, any time."
        >
          <div className="flex flex-wrap gap-3">
            <a
              href="/reports/export?report=ledger&period=all&property=all"
              className="flex items-center gap-2 rounded-(--radius-field) border border-line bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-soft/50"
            >
              <Download className="size-4" aria-hidden /> Export all transactions (CSV)
            </a>
            <a
              href="/reports/export?report=tax&period=this_fy&property=all"
              className="flex items-center gap-2 rounded-(--radius-field) border border-line bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-soft/50"
            >
              <Download className="size-4" aria-hidden /> Export tax summary (CSV)
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            Your data is yours — exports are plain CSV that opens in Excel or Google Sheets. See our{" "}
            <a href="/privacy" className="underline hover:text-ink">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="/terms" className="underline hover:text-ink">
              Terms
            </a>
            .
          </p>

          {isOwner && (
          <div className="mt-5 rounded-(--radius-field) border border-danger/40 p-4">
            <div className="font-semibold text-ink">Clear all portfolio data</div>
            <p className="mt-1 text-sm text-muted">
              Permanently deletes every property, tenant, lease, transaction and document in this
              workspace. Useful for clearing sample data before entering your own. This cannot be
              undone — export first if unsure.
            </p>
            {!resetOpen ? (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="mt-3 rounded-(--radius-field) border border-danger/50 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft"
              >
                Clear all data…
              </button>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <Input
                  label="Type RESET to confirm"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="RESET"
                />
                {resetError && <p className="text-sm text-danger">{resetError}</p>}
                <div className="flex gap-2">
                  <Button variant="danger" loading={resetting} onClick={runReset}>
                    Delete everything
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResetOpen(false);
                      setResetConfirm("");
                      setResetError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
          )}
        </Section>
      </div>
    </div>
  );
}
