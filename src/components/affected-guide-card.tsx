import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { GuideWorkflowStepper } from "@/components/guide-workflow-stepper";
import {
  deriveGuideNextAction,
  guideStatusBadgeLabel,
  guideWorkflowQueueLabel,
  type GuideWorkflowViewer,
} from "@/lib/guide-workflow";
import type { FeatureImpactContext, ProductGuide } from "@/pages/product-guides";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  if (status === "Published") return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  if (status === "Changes Required") return "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  if (status === "Ready to Publish" || status === "Approved — Ready to Publish") {
    return "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100";
  }
  if (status === "Pending Review") return "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  return "bg-muted text-foreground/90";
}

function statusEdge(status: string) {
  if (status === "Published") return "border-l-emerald-500";
  if (status === "Changes Required") return "border-l-amber-500";
  if (status === "Ready to Publish" || status === "Approved — Ready to Publish") return "border-l-blue-500";
  if (status === "Pending Review") return "border-l-amber-500";
  return "border-l-muted-foreground/40";
}

export function AffectedGuideCard({
  guide,
  viewer,
  featureImpact,
  expanded,
  onExpandedChange,
}: {
  guide: ProductGuide;
  viewer: GuideWorkflowViewer;
  featureImpact: FeatureImpactContext;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  const setOpen = onExpandedChange ?? setLocalOpen;

  const next = deriveGuideNextAction(guide, viewer, "feature_impact");
  const latestFeedback = guide.reviewFeedback?.trim();
  const queueLabel = guideWorkflowQueueLabel(guide);
  const panelId = `affected-guide-${guide.id}`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border/80 bg-card shadow-[var(--shadow-card)] border-l-4",
        statusEdge(guide.status),
        open && "ring-1 ring-border/80",
      )}
    >
      <button
        type="button"
        className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-muted/25"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium leading-snug text-foreground">{guide.title}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusTone(guide.status),
              )}
            >
              {guideStatusBadgeLabel(guide.status)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {guide.productArea} · Owner: {guide.ownerName || "—"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GuideWorkflowStepper status={guide.status} compact />
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </div>
          {!open ? <p className="text-xs text-muted-foreground">{queueLabel}</p> : null}
        </div>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border/70 bg-muted/20 px-3 py-2.5">
          <div className="rounded-md border border-border/70 bg-card px-3 py-2 shadow-sm">
            <div className="flex items-start justify-between gap-3 text-sm">
              <p className="min-w-0 text-xs text-muted-foreground">{queueLabel}</p>
              {guide.slaTimer && guide.slaState !== "Not Applicable" ? (
                <p
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    guide.slaState === "Overdue" ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                  )}
                >
                  {guide.slaTimer}
                </p>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className={cn("font-medium", next.personal ? "text-blue-800 dark:text-blue-200" : "text-foreground")}>
                {next.personal ? "Your action" : next.headline}
              </p>
              <Link
                to={`/product-guides/${guide.id}`}
                state={{ fromFeatureImpact: featureImpact }}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {next.ctaLabel}
              </Link>
            </div>
            {next.detail && !next.personal ? (
              <p className="mt-1 text-xs text-muted-foreground">{next.detail}</p>
            ) : null}
            {guide.status === "Changes Required" && latestFeedback ? (
              <p className="mt-2 rounded border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-xs text-amber-950/90 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <span className="font-medium">Review feedback:</span>{" "}
                {latestFeedback.length > 200 ? `${latestFeedback.slice(0, 200)}…` : latestFeedback}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AffectedGuidesList({
  guides,
  viewer,
  featureImpact,
  filterKey,
}: {
  guides: ProductGuide[];
  viewer: GuideWorkflowViewer;
  featureImpact: FeatureImpactContext;
  /** Changes when parent filter changes — clears expanded rows. */
  filterKey?: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedIds(new Set());
  }, [filterKey]);

  const allExpanded = guides.length > 0 && guides.every((g) => expandedIds.has(g.id));
  const toggleAll = () => {
    if (allExpanded) setExpandedIds(new Set());
    else setExpandedIds(new Set(guides.map((g) => g.id)));
  };

  return (
    <div className="space-y-2">
      {guides.length > 1 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={toggleAll}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      ) : null}
      {guides.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No guides match this filter.</p>
      ) : null}
      <div className="space-y-3">
        {guides.map((guide) => (
          <AffectedGuideCard
            key={guide.id}
            guide={guide}
            viewer={viewer}
            featureImpact={featureImpact}
            expanded={expandedIds.has(guide.id)}
            onExpandedChange={(open) => {
              setExpandedIds((prev) => {
                const next = new Set(prev);
                if (open) next.add(guide.id);
                else next.delete(guide.id);
                return next;
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
