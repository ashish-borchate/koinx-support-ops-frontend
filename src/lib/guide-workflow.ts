import type { ProductGuide } from "@/pages/product-guides";

export type WorkflowStageKey = "draft" | "readyToPublish" | "published";

export type WorkflowStageState = "complete" | "active" | "action" | "pending";

export type GuideWorkflowViewer = {
  id: string;
  canReview: boolean;
  canPublish: boolean;
  canManage: boolean;
};

/** Display label for canonical and legacy revision statuses. */
export function guideStatusBadgeLabel(status: string) {
  if (status === "Ready to Publish" || status === "Approved — Ready to Publish") return "Ready to publish";
  if (status === "Pending Review") return "Pending review (legacy)";
  if (status === "Changes Required") return "Changes required";
  return status;
}

export function workflowStagesForStatus(status: string): Record<WorkflowStageKey, WorkflowStageState> {
  switch (status) {
    case "Draft":
      return { draft: "active", readyToPublish: "pending", published: "pending" };
    case "Changes Required":
      return { draft: "complete", readyToPublish: "active", published: "pending" };
    case "Ready to Publish":
    case "Approved — Ready to Publish":
      return { draft: "complete", readyToPublish: "complete", published: "active" };
    case "Published":
      return { draft: "complete", readyToPublish: "complete", published: "complete" };
    case "Pending Review":
      return { draft: "complete", readyToPublish: "active", published: "pending" };
    default:
      return { draft: "pending", readyToPublish: "pending", published: "pending" };
  }
}

export function formatGuideStatusSummary(counts: Record<string, number>) {
  const order = ["Published", "Ready to Publish", "Changes Required", "Draft"];
  const parts = order
    .filter((s) => (counts[s] || 0) > 0 || (s === "Ready to Publish" && (counts["Approved — Ready to Publish"] || 0) > 0))
    .map((s) => {
      const n = s === "Ready to Publish" ? (counts[s] || 0) + (counts["Approved — Ready to Publish"] || 0) : counts[s] || 0;
      return `${n} ${shortStatusLabel(s)}`;
    });
  return parts.join(" · ");
}

function shortStatusLabel(status: string) {
  return guideStatusBadgeLabel(status);
}

export function guideWorkflowQueueLabel(guide: ProductGuide): string {
  const owner = guide.ownerName?.trim() || "owner";
  switch (guide.status) {
    case "Published":
      return "Published";
    case "Draft":
      return `Draft — ${owner}`;
    case "Changes Required":
      return `Changes required — ${owner}`;
    case "Ready to Publish":
    case "Approved — Ready to Publish":
      return "Ready to publish on Mintlify";
    case "Pending Review":
      return "Legacy pending review — mark ready to publish when content is complete";
    default:
      return guide.status;
  }
}

export function tallyGuideStatuses(guides: { status: string }[]) {
  const counts: Record<string, number> = {};
  for (const g of guides) {
    const key = g.status === "Approved — Ready to Publish" ? "Ready to Publish" : g.status;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export type GuideNextAction = {
  personal: boolean;
  headline: string;
  detail: string;
  ctaLabel: string;
  ctaKind: "update" | "publish" | "view";
};

export type GuideAttentionContext = "product_guide" | "feature_impact";

function isPersonallyResponsible(guide: ProductGuide, context: GuideAttentionContext = "product_guide") {
  if (context === "feature_impact") {
    return guide.requiresFeatureImpactAttention === true;
  }
  return Boolean(guide.requiresPersonalAttention);
}

export function featureImpactPersonalGuides(guides: ProductGuide[]) {
  return guides.filter((g) => g.requiresFeatureImpactAttention === true);
}

export type FeatureImpactGuideFilter =
  | "all"
  | "your_action"
  | "Draft"
  | "Changes Required"
  | "Ready to Publish"
  | "Published";

const FI_STATUS_KEYS: FeatureImpactGuideFilter[] = [
  "Draft",
  "Changes Required",
  "Ready to Publish",
  "Published",
];

function guideMatchesStatusFilter(guide: ProductGuide, filter: FeatureImpactGuideFilter) {
  if (filter === "Ready to Publish") {
    return guide.status === "Ready to Publish" || guide.status === "Approved — Ready to Publish";
  }
  return guide.status === filter;
}

export function tallyFeatureImpactFilterCounts(guides: ProductGuide[]) {
  const counts: Record<FeatureImpactGuideFilter, number> = {
    all: guides.length,
    your_action: featureImpactPersonalGuides(guides).length,
    Draft: 0,
    "Changes Required": 0,
    "Ready to Publish": 0,
    Published: 0,
  };
  for (const g of guides) {
    for (const key of FI_STATUS_KEYS) {
      if (guideMatchesStatusFilter(g, key)) counts[key] += 1;
    }
  }
  return counts;
}

export function filterFeatureImpactGuides(guides: ProductGuide[], filter: FeatureImpactGuideFilter) {
  if (filter === "all") return guides;
  if (filter === "your_action") return featureImpactPersonalGuides(guides);
  return guides.filter((g) => guideMatchesStatusFilter(g, filter));
}

export function featureImpactFilterLabel(filter: FeatureImpactGuideFilter): string | null {
  if (filter === "all") return null;
  if (filter === "your_action") return "Needs your action";
  if (filter === "Changes Required") return "Changes Requested";
  if (filter === "Ready to Publish") return "Ready To Publish";
  return filter;
}

export function deriveGuideNextAction(
  guide: ProductGuide,
  _viewer: GuideWorkflowViewer,
  context: GuideAttentionContext = "product_guide",
): GuideNextAction {
  const actions = guide.actions ?? { edit: false, submit: false, review: false, publish: false, accuracyReview: false };
  const owner = guide.ownerName || "Owner";
  const sla = guide.slaTimer || guide.slaState || "";
  const slaSuffix = sla && sla !== "Not Applicable" ? ` · ${sla}` : "";
  const personal = isPersonallyResponsible(guide, context);
  const readyStatus =
    guide.status === "Ready to Publish" || guide.status === "Approved — Ready to Publish";

  if (guide.status === "Published") {
    if (context === "feature_impact") {
      return {
        personal: false,
        headline: "Completed",
        detail: "No further action required.",
        ctaLabel: "View guide →",
        ctaKind: "view",
      };
    }
    if (personal) {
      return {
        personal: true,
        headline: "Accuracy review due",
        detail: "Periodic maintenance review is due for this guide.",
        ctaLabel: "View guide →",
        ctaKind: "view",
      };
    }
    return {
      personal: false,
      headline: "Completed",
      detail: "No further action required.",
      ctaLabel: "View guide →",
      ctaKind: "view",
    };
  }

  if (guide.status === "Changes Required" || guide.status === "Draft") {
    if (personal) {
      return {
        personal: true,
        headline: "Your action",
        detail:
          guide.status === "Changes Required"
            ? "Update the guide, then mark it ready to publish."
            : "Finish the draft, then mark it ready to publish.",
        ctaLabel: actions.edit || actions.submit ? "Update guide →" : "Open guide →",
        ctaKind: "update",
      };
    }
    return {
      personal: false,
      headline: guide.status === "Changes Required" ? "Updates needed" : "Draft in progress",
      detail: guide.status === "Changes Required" ? `Action required from ${owner}.` : `Owned by ${owner}.`,
      ctaLabel: "View guide →",
      ctaKind: "view",
    };
  }

  if (readyStatus) {
    if (personal) {
      return {
        personal: true,
        headline: "Your action",
        detail: `Publish the guide on Mintlify${slaSuffix}`,
        ctaLabel: actions.publish ? "Open guide →" : "View guide →",
        ctaKind: "publish",
      };
    }
    return {
      personal: false,
      headline: "Ready to publish",
      detail: `Waiting for publication on Mintlify${slaSuffix}`,
      ctaLabel: "View guide →",
      ctaKind: "view",
    };
  }

  if (guide.status === "Pending Review") {
    return {
      personal: false,
      headline: "Legacy status",
      detail: "This guide used the retired review workflow. Mark it ready to publish when content is complete.",
      ctaLabel: "View guide →",
      ctaKind: "view",
    };
  }

  return {
    personal: false,
    headline: guide.status,
    detail: "",
    ctaLabel: "View guide →",
    ctaKind: "view",
  };
}

export function countPersonalActions(guides: ProductGuide[]) {
  return featureImpactPersonalGuides(guides).length;
}

export function buildFeatureImpactPersonalAttentionBanner(
  guides: ProductGuide[],
  viewer: GuideWorkflowViewer,
): { title: string; body: string } | null {
  const personal = sortAffectedGuides(featureImpactPersonalGuides(guides), viewer);
  if (!personal.length) return null;

  const n = personal.length;
  const first = personal[0];
  return {
    title: n === 1 ? "1 guide needs your action" : `${n} guides need your action`,
    body: `Start with ${first.title}.`,
  };
}

export function workflowActionLabel(guide: ProductGuide, next: GuideNextAction): string {
  if (guide.status === "Published" && !next.personal) return "Complete";
  if (!next.personal) return next.headline;
  if (next.ctaKind === "publish") return "Your action: Publish to Mintlify";
  if (guide.status === "Changes Required") return "Your action: Update this guide";
  if (guide.status === "Draft") return "Your action: Mark ready to publish";
  if (guide.actions?.accuracyReview) return "Accuracy review due";
  if (guide.status === "Published") return "Your action: Complete maintenance review";
  return "Your action";
}

const STATUS_SORT: Record<string, number> = {
  "Changes Required": 0,
  Draft: 1,
  "Ready to Publish": 2,
  "Approved — Ready to Publish": 2,
  "Pending Review": 2,
  Published: 4,
};

export function sortAffectedGuides(guides: ProductGuide[], _viewer: GuideWorkflowViewer) {
  return [...guides].sort((a, b) => {
    const ap = isPersonallyResponsible(a, "feature_impact") ? 0 : 1;
    const bp = isPersonallyResponsible(b, "feature_impact") ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const as = STATUS_SORT[a.status] ?? 5;
    const bs = STATUS_SORT[b.status] ?? 5;
    return as - bs;
  });
}
