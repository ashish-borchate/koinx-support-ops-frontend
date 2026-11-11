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
}: {
  label: string;
  definition: LiveMetricDefinition;
  available: boolean;
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  extraNote?: string;
}) {
  function formatMs(ms: number | null) {
    if (ms == null) return "—";
    const h = ms / 3_600_000;
    if (h < 1) return `${Math.round(ms / 60_000)}m`;
    return `${h.toFixed(1)}h`;
  }

  const desc =
    extraNote && !definition.notes
      ? { ...definition, notes: extraNote }
      : extraNote
        ? { ...definition, notes: `${definition.notes}\n${extraNote}` }
        : definition;

  return (
    <div className="flex min-h-[5.25rem] flex-col rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <LiveMetricInfoButton definition={desc} />
      </div>
      {available ? (
        <>
          <p className="mt-2 text-lg font-semibold leading-tight text-foreground">
            Avg {formatMs(averageMs)} · Med {formatMs(medianMs)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">n = {formatNumber(count)}</p>
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold text-muted-foreground">—</p>
      )}
    </div>
  );
}
