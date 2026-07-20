import { STATUS_LABEL } from "@/lib/format";

const TONE: Record<string, string> = {
  rental: "bg-brand-soft text-brand",
  owner_occupied: "bg-brand-soft text-brand",
  vacant: "bg-warn-soft text-warn",
  under_construction: "bg-warn-soft text-warn",
  sold: "bg-line text-muted",
  paid: "bg-brand-soft text-brand",
  unpaid: "bg-warn-soft text-warn",
  scheduled: "bg-line text-muted",
  late: "bg-danger-soft text-danger",
  due: "bg-warn-soft text-warn",
  upcoming: "bg-line text-muted",
  active: "bg-brand-soft text-brand",
  ended: "bg-line text-muted",
};

export function StatusPill({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[value] ?? "bg-line text-muted"}`}
    >
      {label ?? STATUS_LABEL[value] ?? value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}
