import { audCents } from "@/lib/format";

export interface MonthPoint {
  label: string;
  income: number;
  expenses: number;
}

export function CashflowChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  const hasAny = data.some((d) => d.income > 0 || d.expenses > 0);

  return (
    <div>
      <div className="flex h-52 items-end justify-between gap-4">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-44 w-full items-end justify-center gap-1.5">
              <div
                className="group relative w-1/2 max-w-9 rounded-t-md bg-brand/85"
                style={{ height: `${Math.max(hasAny ? 3 : 0, (d.income / max) * 100)}%` }}
              >
                <Tip label="Rent" value={d.income} />
              </div>
              <div
                className="group relative w-1/2 max-w-9 rounded-t-md"
                style={{
                  height: `${Math.max(hasAny ? 3 : 0, (d.expenses / max) * 100)}%`,
                  background: "var(--terra)",
                }}
              >
                <Tip label="Expenses" value={d.expenses} />
              </div>
            </div>
            <span className="text-xs text-muted">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-5 text-xs text-muted">
        <Legend color="var(--brand)" label="Rent income" />
        <Legend color="var(--terra)" label="Expenses" />
      </div>
    </div>
  );
}

function Tip({ label, value }: { label: string; value: number }) {
  return (
    <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg group-hover:block">
      {label} {audCents(value)}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
