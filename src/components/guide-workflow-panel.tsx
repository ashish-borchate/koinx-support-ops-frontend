import { useAuth } from "@/lib/auth";
import { deriveGuideNextAction, type GuideWorkflowViewer } from "@/lib/guide-workflow";
import type { ProductGuide } from "@/pages/product-guides";

export function useGuideWorkflowViewer(): GuideWorkflowViewer {
  const { effective, can } = useAuth();
  return {
    id: effective?.id ?? "",
    canReview: can("guides.review"),
    canPublish: can("guides.publish"),
    canManage: can("guides.manage"),
  };
}

export function GuideWorkflowPanel({ guide, viewer }: { guide: ProductGuide; viewer: GuideWorkflowViewer }) {
  if (guide.status === "Published" || guide.pendingUpdate?.active) return null;

  const latestFeedback = guide.reviewFeedback?.trim();
  if (guide.status === "Changes Required" && latestFeedback) {
    return (
      <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-xs font-medium text-amber-950 dark:text-amber-100">Review feedback</p>
        <p className="mt-1 whitespace-pre-wrap text-amber-950/90 dark:text-amber-50">{latestFeedback}</p>
      </section>
    );
  }

  const next = deriveGuideNextAction(guide, viewer);
  if (!next.detail && guide.status === "Draft") return null;

  return (
    <section className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      {next.detail ? <p>{next.detail}</p> : null}
    </section>
  );
}
