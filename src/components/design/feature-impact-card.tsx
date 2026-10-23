import { Link } from "react-router-dom";
import { formatGuideStatusSummary } from "@/lib/guide-workflow";
import { motionClass, surfaceInteractive } from "./tokens";
import { cn } from "@/lib/utils";

type ImpactProgress = { published: number; total: number; percent: number; status: string };

export function FeatureImpactCard({
  id,
  name,
  reason,
  progress,
  statusCounts,
  needsAttention,
}: {
  id: string;
  name: string;
  reason: string;
  progress: ImpactProgress;
  statusCounts?: Record<string, number>;
  needsAttention?: number;
}) {
  const guideLabel = progress.total === 1 ? "1 affected guide" : `${progress.total} affected guides`;
  const summary = statusCounts ? formatGuideStatusSummary(statusCounts) : `${progress.published} Published`;
  const complete = progress.percent >= 100 && progress.total > 0;

  return (
    <Link
      to={`/feature-impacts/${id}`}
      className={cn(surfaceInteractive, motionClass, "block px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
    >
      <p className="text-sm font-semibold leading-snug text-foreground">{name}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{reason}</p>
      <p className="mt-2.5 text-[11px] text-muted-foreground">{guideLabel}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground">{summary}</p>
      {needsAttention && needsAttention > 0 ? (
        <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          {needsAttention} need{needsAttention === 1 ? "s" : ""} your attention
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300",
              complete ? "bg-emerald-600" : "bg-primary",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums font-medium text-foreground">
          {progress.percent}%{complete ? " · Complete" : ""}
        </span>
      </div>
    </Link>
  );
}
