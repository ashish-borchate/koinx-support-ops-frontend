import { Link } from "react-router-dom";
import { StatusBadge } from "./status-badge";
import { motionClass, surfaceInteractive } from "./tokens";
import { cn } from "@/lib/utils";

type ImpactProgress = { published: number; total: number; percent: number; status: string };

export function FeatureImpactCard({
  id,
  name,
  reason,
  updatedLabel,
  progress,
}: {
  id: string;
  name: string;
  reason: string;
  updatedLabel: string;
  progress: ImpactProgress;
}) {
  const guideLabel = progress.total === 1 ? "1 linked guide" : `${progress.total} linked guides`;

  return (
    <Link
      to={`/feature-impacts/${id}`}
      className={cn(surfaceInteractive, motionClass, "block px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">{name}</p>
        <StatusBadge value={progress.status} className="shrink-0" />
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{reason}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {guideLabel} · Updated {updatedLabel}
        </span>
        <span className="ml-auto tabular-nums font-medium text-foreground">{progress.percent}%</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {progress.published}/{progress.total}
        </span>
      </div>
    </Link>
  );
}
