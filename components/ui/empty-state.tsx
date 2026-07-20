import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-(--radius-card) border border-dashed border-line bg-card/50 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <Icon className="size-6 text-brand" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
