import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LiveMetricInfoButton, type LiveMetricDefinition } from "./live-metric-info";

export function LiveBacklogMetricCard({
  label,
  value,
  definition,
  onDrill,
  className,
}: {
  label: string;
  value: number;
  definition: LiveMetricDefinition;
  onDrill?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </p>
        <LiveMetricInfoButton definition={definition} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-foreground">
        {formatNumber(value)}
      </p>
    </>
  );

  if (onDrill) {
    return (
      <button
        type="button"
        onClick={onDrill}
        className={cn(
          "flex min-h-[5.25rem] flex-col rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40",
          className,
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[5.25rem] flex-col rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      {inner}
    </div>
  );
}

export function LivePeriodCountCard({
  label,
  value,
  definition,
  onDrill,
}: {
  label: string;
  value: number;
  definition: LiveMetricDefinition;
  onDrill?: () => void;
}) {
  return (
    <LiveBacklogMetricCard label={label} value={value} definition={definition} onDrill={onDrill} />
  );
}

export function LiveDurationCard({
  label,
  definition,
  available,
  count,
  averageMs,
  medianMs,
  extraNote,
  onDrill,
}: {
  label: string;
  definition: LiveMetricDefinition;
  available: boolean;
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  extraNote?: string;
  onDrill?: () => void;
}) {
  function formatMs(ms: number | null) {
    if (ms == null) return "—";
    const h = ms / 3_600_000;
    if (h < 1) return `${Math.round(ms / 60_000)}m`;
    return `${h.toFixed(1)}h`;
  }

  const drillNotes = [
    extraNote,
    count > 0 ? `Based on ${formatNumber(count)} ticket${count === 1 ? "" : "s"} in this period.` : null,
    medianMs != null ? `Median ${formatMs(medianMs)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const desc =
    drillNotes && !definition.notes
      ? { ...definition, notes: drillNotes }
      : drillNotes
        ? { ...definition, notes: `${definition.notes ?? ""}\n${drillNotes}`.trim() }
        : definition;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <LiveMetricInfoButton definition={desc} />
      </div>
      {available ? (
        <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-foreground">
          {formatMs(averageMs)}
          <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">avg</span>
        </p>
      ) : (
        <p className="mt-2 text-2xl font-semibold text-muted-foreground">—</p>
      )}
    </>
  );

  if (onDrill && available && count > 0) {
    return (
      <button
        type="button"
        onClick={onDrill}
        className="flex min-h-[5.25rem] flex-col rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex min-h-[5.25rem] flex-col rounded-xl border border-border bg-card p-3">{inner}</div>;
}
