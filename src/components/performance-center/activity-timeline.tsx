import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IstDatePicker } from "@/components/ui/ist-date-picker";
import { LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { addDays, formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentDashboard, PeriodPreset } from "./types";

const kindIcon: Record<string, LucideIcon> = {
  "product_guide.review_submitted": ClipboardList,
  "product_feedback.created": MessageSquare,
  "reported_issue.resolved": CheckCircle2,
  "qa.review_received": Scale,
  "qa.appeal_submitted": AlertCircle,
  "qa.appeal_escalated": AlertCircle,
  "coaching.completed": Sparkles,
};

function timeIst(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventReference(event: TimelineEvent) {
  const d = event.description || "";
  if (event.kind.startsWith("qa.")) {
    const ticket = d.match(/Ticket\s+(\S+)/)?.[1];
    return ticket ? `Ticket ${ticket}` : d.split(" · ")[0] || null;
  }
  if (d.length > 64) return `${d.slice(0, 61)}…`;
  return d || null;
}

type TimelineEvent = AgentDashboard["timeline"]["events"][number];

type Props = {
  agentId: string;
  preset: PeriodPreset;
  customFrom: string;
  customTo: string;
  periodStartIst: string;
  periodEndIst: string;
  events: TimelineEvent[];
};

function enumerateDates(startIst: string, endIst: string): string[] {
  const keys: string[] = [];
  let cursor = startIst;
  while (cursor <= endIst) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function defaultSelectedDay(dates: string[], events: TimelineEvent[], todayHint?: string) {
  const withActivity = new Set(events.map((e) => e.occurredAtIst || e.occurredAt.slice(0, 10)));
  if (todayHint && dates.includes(todayHint) && withActivity.has(todayHint)) return todayHint;
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    if (withActivity.has(dates[i])) return dates[i];
  }
  if (todayHint && dates.includes(todayHint)) return todayHint;
  return dates[dates.length - 1] ?? todayHint ?? "";
}

export function ActivityTimeline({
  agentId,
  preset,
  customFrom,
  customTo,
  periodStartIst,
  periodEndIst,
  events: seedEvents,
}: Props) {
  const periodDates = useMemo(
    () => enumerateDates(periodStartIst, periodEndIst),
    [periodStartIst, periodEndIst],
  );

  const periodQs = useMemo(() => {
    const p = new URLSearchParams({ agentId, preset, limit: "100" });
    if (preset === "custom" && customFrom && customTo) {
      p.set("from", customFrom);
      p.set("to", customTo);
    }
    return p.toString();
  }, [agentId, preset, customFrom, customTo]);

  const fullQ = useQuery({
    queryKey: ["agent-activity-timeline", periodQs],
    queryFn: ({ signal }) => api<{ events: TimelineEvent[] }>(`/api/agent-activity/timeline?${periodQs}`, { signal }),
  });

  const allEvents = fullQ.data?.events?.length ? fullQ.data.events : seedEvents;

  const activityDays = useMemo(() => {
    const set = new Set<string>();
    for (const ev of allEvents) {
      set.add(ev.occurredAtIst || ev.occurredAt.slice(0, 10));
    }
    return set;
  }, [allEvents]);

  const [selectedDay, setSelectedDay] = useState(() =>
    defaultSelectedDay(periodDates, seedEvents),
  );

  useEffect(() => {
    setSelectedDay(defaultSelectedDay(periodDates, seedEvents));
  }, [periodStartIst, periodEndIst, agentId, seedEvents, periodDates]);

  const dayEvents = useMemo(
    () =>
      allEvents
        .filter((ev) => (ev.occurredAtIst || ev.occurredAt.slice(0, 10)) === selectedDay)
        .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    [allEvents, selectedDay],
  );

  const selectedIndex = periodDates.indexOf(selectedDay);

  if (periodDates.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
        No activity recorded for this period.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/15">
      <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedDay(periodDates[Math.max(0, selectedIndex - 1)])}
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {periodDates.map((dateKey) => {
              const active = dateKey === selectedDay;
              const hasActivity = activityDays.has(dateKey);
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDay(dateKey)}
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-1 text-[11px] tabular-nums transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 font-semibold text-foreground"
                      : hasActivity
                        ? "border-border/50 bg-muted/45 font-semibold text-foreground hover:bg-muted/55"
                        : "border-transparent bg-card/80 font-medium text-muted-foreground hover:bg-card",
                  )}
                >
                  {formatCalendarDate(dateKey).replace(/,\s*\d{4}$/, "")}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={selectedIndex < 0 || selectedIndex >= periodDates.length - 1}
            onClick={() => setSelectedDay(periodDates[Math.min(periodDates.length - 1, selectedIndex + 1)])}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="w-full shrink-0 sm:w-[11.5rem]">
          <IstDatePicker
            value={selectedDay}
            onChange={(v) => {
              if (v && periodDates.includes(v)) setSelectedDay(v);
            }}
            min={periodStartIst}
            max={periodEndIst}
            aria-label="Jump to date in period"
          />
        </div>
      </div>

      <div className="max-h-[min(420px,50vh)] overflow-y-auto px-3 py-3 sm:px-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatCalendarDate(selectedDay)}
        </p>
        {fullQ.isFetching && !fullQ.data ? <LoadingBlock /> : null}
        {dayEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity on this date.</p>
        ) : (
          <ul className="relative space-y-0 before:absolute before:bottom-1 before:left-[15px] before:top-1 before:w-px before:bg-border/80">
            {dayEvents.map((ev) => (
              <TimelineRow key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const Icon = kindIcon[event.kind] ?? ClipboardList;
  const ref = eventReference(event);
  const content = (
    <div className="flex min-w-0 flex-1 items-start gap-2.5 py-1.5 pl-1">
      <span className="relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className="text-sm font-medium text-foreground">{event.label}</p>
        <p className="text-xs text-muted-foreground">
          {[ref, timeIst(event.occurredAt)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );

  if (event.href) {
    return (
      <li>
        <Link
          to={event.href}
          className={cn(
            "block rounded-md transition-colors hover:bg-card/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {content}
        </Link>
      </li>
    );
  }

  return <li>{content}</li>;
}
