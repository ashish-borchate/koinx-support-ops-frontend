import { useMemo } from "react";
import { eachDateKey } from "@/lib/ist-calendar-grid";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type DayCell = { date: string; created: number; resolved: number };

export type CalendarActivityKind = "created" | "resolved";

export function SupportAnalyticsActivityCalendar({
  from,
  to,
  daily,
  selectedDate,
  onDayClick,
}: {
  from: string;
  to: string;
  daily: DayCell[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
}) {
  const map = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const dates = useMemo(() => eachDateKey(from, to), [from, to]);
  const max = useMemo(() => Math.max(1, ...daily.map((d) => Math.max(d.created, d.resolved))), [daily]);

  return (
    <div className="space-y-2">
      <section className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          <strong className="text-foreground">C</strong> Created
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <strong className="text-foreground">R</strong> Resolved
        </span>
        <span className="text-muted-foreground/80">Click a day for detail</span>
      </section>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 md:grid-cols-14">
        {dates.map((date) => {
          const row = map.get(date) || { date, created: 0, resolved: 0 };
          const intensity = Math.max(row.created, row.resolved) / max;
          const inRange = date >= from && date <= to;
          const active = selectedDate === date;
          const hasActivity = row.created > 0 || row.resolved > 0;
          return (
            <button
              key={date}
              type="button"
              disabled={!inRange || !hasActivity}
              onClick={() => onDayClick(date)}
              className={cn(
                "flex min-h-[4rem] flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[10px] transition",
                inRange ? "border-border" : "border-transparent opacity-30",
                hasActivity ? "hover:border-primary/50" : "opacity-50",
                active ? "ring-2 ring-primary" : "",
              )}
              style={{
                backgroundColor: hasActivity
                  ? `color-mix(in srgb, rgb(14 165 233) ${Math.round(intensity * 50)}%, transparent)`
                  : undefined,
              }}
            >
              <span className="tabular-nums font-medium text-foreground">{date.slice(8)}</span>
              <span
                className={cn(
                  "mt-0.5 tabular-nums leading-tight",
                  row.created > 0 ? "text-sky-700 dark:text-sky-300" : "text-muted-foreground/40",
                )}
              >
                C {formatNumber(row.created)}
              </span>
              <span
                className={cn(
                  "tabular-nums leading-tight",
                  row.resolved > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/40",
                )}
              >
                R {formatNumber(row.resolved)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
