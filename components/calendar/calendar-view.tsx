import type { CalEvent, EventKind } from "@/lib/calendar";
import { monthBounds, shiftMonth, currentMonth } from "@/lib/calendar";
import { aud, fmtDate } from "@/lib/format";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";

const KIND: Record<EventKind, { label: string; dot: string; chip: string }> = {
  rent_due: { label: "Rent due", dot: "var(--brand)", chip: "bg-brand-soft text-brand" },
  rent_paid: { label: "Rent received", dot: "var(--muted)", chip: "bg-code-bg text-muted" },
  bill: { label: "Bill", dot: "var(--terra)", chip: "bg-terra-soft text-terra" },
  lease_end: { label: "Lease ends", dot: "var(--amber)", chip: "bg-warn-soft text-warn" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ month, events }: { month: string; events: CalEvent[] }) {
  const { start, year, m } = monthBounds(month);
  const daysInMonth = new Date(year, m, 0).getDate();
  // Monday-first offset for the 1st of the month.
  const firstOffset = (new Date(year, m - 1, 1).getDay() + 6) % 7;
  const monthLabel = new Date(year, m - 1, 1).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
  const todayISO = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${start.slice(0, 8)}${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const totals = {
    rentDue: events.filter((e) => e.kind === "rent_due").reduce((s, e) => s + (e.amount ?? 0), 0),
    bills: events.filter((e) => e.kind === "bill").reduce((s, e) => s + (e.amount ?? 0), 0),
  };

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            Rent dates, lease expiries and bills due — everything scheduled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-(--radius-field) border border-line bg-card text-muted hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold text-ink">{monthLabel}</span>
          <Link
            href={`/calendar?month=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="flex size-9 items-center justify-center rounded-(--radius-field) border border-line bg-card text-muted hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          {month !== currentMonth() && (
            <Link
              href="/calendar"
              className="rounded-(--radius-field) border border-line bg-card px-3 py-2 text-sm text-muted hover:text-ink"
            >
              Today
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        {(Object.keys(KIND) as EventKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: KIND[k].dot }} />
            {KIND[k].label}
          </span>
        ))}
        <span className="ml-auto flex gap-4">
          <span>
            Rent due <span className="num text-ink">{aud(totals.rentDue)}</span>
          </span>
          <span>
            Bills <span className="num text-terra">{aud(totals.bills)}</span>
          </span>
        </span>
      </div>

      {/* Month grid */}
      <div className="flex flex-col overflow-hidden rounded-(--radius-card) border border-line bg-card lg:min-h-0 lg:flex-[3]">
        <div className="grid shrink-0 grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[0.68rem] font-semibold tracking-wide text-muted uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:auto-rows-fr lg:overflow-y-auto">
          {cells.map((date, i) => {
            const dayEvents = date ? (byDay.get(date) ?? []) : [];
            const isToday = date === todayISO;
            return (
              <div
                key={i}
                className={`min-h-[6.5rem] overflow-hidden border-r lg:min-h-[4.25rem] border-b border-line p-1.5 last:border-r-0 ${
                  date ? "" : "bg-card-2/40"
                }`}
              >
                {date && (
                  <>
                    <div
                      className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-brand font-bold text-white" : "text-muted"
                      }`}
                    >
                      {Number(date.slice(8))}
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <Link
                          key={e.id}
                          href={e.href}
                          title={`${e.title} — ${e.detail}`}
                          className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.68rem] font-medium ${KIND[e.kind].chip}`}
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND[e.kind].dot }} />
                          <span className="truncate">
                            {e.amount != null ? aud(e.amount) : e.title}
                          </span>
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="px-1.5 text-[0.68rem] text-muted">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda */}
      <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-4 lg:min-h-0 lg:flex-[2] lg:overflow-hidden">
        <h2 className="mb-3 shrink-0 text-base font-semibold text-ink">
          Agenda — {monthLabel}
          {events.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">{events.length} events</span>
          )}
        </h2>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center lg:min-h-0 lg:flex-1 lg:py-0">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <p className="font-semibold text-ink">Nothing scheduled this month</p>
            <p className="text-sm text-muted">
              Rent schedules, lease end dates and unpaid bills show up here automatically.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: KIND[e.kind].dot }} />
                  <div className="min-w-0">
                    <Link href={e.href} className="block truncate font-medium text-ink hover:text-brand">
                      {e.title}
                    </Link>
                    <span className="block truncate text-xs text-muted">{e.detail}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {e.amount != null && (
                    <span className={`num text-sm font-semibold ${e.kind === "bill" ? "text-terra" : "text-ink"}`}>
                      {aud(e.amount)}
                    </span>
                  )}
                  <span className="w-24 text-right text-xs text-muted">{fmtDate(e.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
