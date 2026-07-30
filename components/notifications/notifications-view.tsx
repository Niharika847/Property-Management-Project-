"use client";

import type { Alert, Severity } from "@/lib/alerts";
import { AlertTriangle, Bell, Info, Check, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORE = "roost-dismissed-alerts";

const TONE: Record<Severity, { chip: string; icon: typeof Bell; label: string }> = {
  critical: { chip: "bg-danger-soft text-danger", icon: AlertTriangle, label: "Needs action" },
  warning: { chip: "bg-terra-soft text-terra", icon: AlertTriangle, label: "Attention" },
  info: { chip: "bg-brand-soft text-brand", icon: Info, label: "For info" },
};

export function NotificationsView({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(STORE) ?? "[]"));
    } catch {
      setDismissed([]);
    }
    setReady(true);
  }, []);

  function persist(next: string[]) {
    setDismissed(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }

  const visible = alerts.filter((a) => !dismissed.includes(a.key));
  const hiddenCount = alerts.length - visible.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-muted">
            Late rent, vacancies, lease expiries and anything else that needs you.
          </p>
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => persist([])}
            className="flex items-center gap-1.5 rounded-(--radius-field) border border-line bg-card px-3 py-2 text-sm text-muted hover:text-ink"
          >
            <Undo2 className="size-4" aria-hidden /> Restore {hiddenCount} dismissed
          </button>
        )}
      </div>

      {!ready ? null : visible.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-(--radius-card) border border-dashed border-line bg-card/50 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="text-lg font-semibold text-ink">You&apos;re all caught up</p>
          <p className="max-w-sm text-sm text-muted">
            {alerts.length === 0
              ? "No late rent, no vacancies, nothing outstanding. We'll tell you the moment something needs attention."
              : "Everything here has been dismissed."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => {
            const tone = TONE[a.severity];
            return (
              <li
                key={a.key}
                className="flex items-start gap-3 rounded-(--radius-card) border border-line bg-card p-4"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>
                  <tone.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{a.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${tone.chip}`}>
                      {tone.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
                  <Link href={a.href} className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
                    Open →
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => persist([...dismissed, a.key])}
                  aria-label={`Dismiss: ${a.title}`}
                  className="shrink-0 rounded p-1.5 text-muted hover:bg-brand-soft hover:text-ink"
                >
                  <Check className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
