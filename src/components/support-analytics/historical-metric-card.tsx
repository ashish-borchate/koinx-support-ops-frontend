import { Info } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DurationMetricUi = {
  available: boolean;
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  coverageHint?: string | null;
  note?: string;
};

export type CsatMetricUi = {
  available: boolean;
  responseCount: number;
  averageRating: number | null;
  distribution?: { rating: number; count: number }[];
  coverageHint?: string | null;
  unavailableReason?: string | null;
};

function formatMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(ms / 60_000)}m`;
  return `${h.toFixed(1)}h`;
}

function CoverageTip({ hint }: { hint: string }) {
  return (
    <span className="group relative ml-1 inline-flex">
      <Info className="h-3 w-3 cursor-help text-muted-foreground" aria-hidden />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-44 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-normal text-popover-foreground shadow-sm group-hover:block">
        {hint}
      </span>
    </span>
  );
}

export function HistoricalCountCard({
  label,
  value,
  tone,
  onClick,
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "negative";
  onClick?: () => void;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {hint ? <CoverageTip hint={hint} /> : null}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
          tone === "negative" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {formatNumber(value)}
      </p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={value === 0}
        className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 disabled:cursor-default disabled:opacity-60"
      >
        {body}
      </button>
    );
  }
  return <div className="rounded-xl border border-border bg-card p-3">{body}</div>;
}

export function HistoricalDurationInline({
  label,
  metric,
  sublabel,
}: {
  label: string;
  metric: DurationMetricUi;
  sublabel?: string;
}) {
  const hint = metric.coverageHint ?? (metric.available ? `${metric.count} tickets` : null);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {hint ? <CoverageTip hint={hint} /> : null}
      </p>
      {sublabel ? <p className="text-[10px] text-muted-foreground">{sublabel}</p> : null}
      {metric.available ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <dt className="text-[10px] text-muted-foreground">Avg</dt>
            <dd className="font-semibold tabular-nums">{formatMs(metric.averageMs)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Median</dt>
            <dd className="font-semibold tabular-nums">{formatMs(metric.medianMs)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

export function HistoricalCsatCard({ csat }: { csat: CsatMetricUi }) {
  if (!csat.available) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-3 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">CSAT (historical)</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {csat.unavailableReason ?? "Not available in current imports."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        CSAT (resolved tickets)
        {csat.coverageHint ? <CoverageTip hint={csat.coverageHint} /> : null}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {csat.averageRating != null ? csat.averageRating.toFixed(2) : "—"}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          · {formatNumber(csat.responseCount)} responses
        </span>
      </p>
      {csat.distribution?.length ? (
        <p className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          {csat.distribution.map((d) => (
            <span key={d.rating} className="rounded bg-muted px-1.5 py-0.5">
              {d.rating}★ × {d.count}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
