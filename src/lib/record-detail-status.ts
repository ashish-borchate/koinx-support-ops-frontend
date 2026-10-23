import { guideStatusBadgeLabel } from "@/lib/guide-workflow";

export type TitleBadgeSpec = {
  label: string;
  className: string;
};

const TONE = {
  published: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  draft: "bg-muted text-foreground/90",
  amber: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  blue: "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100",
  violet: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
  red: "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100",
};

export function publishedMetadataBadgeClass() {
  return TONE.published;
}

function newUpdateSuffix(
  state: "in_progress" | "verification_required" | "changes_required" | "pending_review" | "ready_to_publish",
): TitleBadgeSpec {
  const map = {
    in_progress: { label: "New Update · In Progress", className: TONE.blue },
    verification_required: { label: "New Update · Verification Required", className: TONE.amber },
    changes_required: { label: "New Update · Changes Required", className: TONE.red },
    pending_review: { label: "New Update · Pending Review", className: TONE.violet },
    ready_to_publish: { label: "New Update · Ready to Publish", className: TONE.violet },
  };
  return map[state];
}

export function productGuideWasEverPublished(guide: { status: string }) {
  return guide.status === "Published";
}

export function productGuideTitleBadge(input: {
  guide: { status: string };
  updating: boolean;
  pendingReady: boolean;
  submitPending: boolean;
}): TitleBadgeSpec | null {
  const { guide, updating, pendingReady, submitPending } = input;
  const everPublished = productGuideWasEverPublished(guide);

  if (updating && everPublished) {
    if (pendingReady) return newUpdateSuffix("ready_to_publish");
    if (submitPending) return newUpdateSuffix("verification_required");
    if (guide.status === "Changes Required") return newUpdateSuffix("changes_required");
    return newUpdateSuffix("in_progress");
  }

  if (everPublished && !updating) return null;

  return {
    label: guideStatusBadgeLabel(guide.status),
    className:
      guide.status === "Published"
        ? TONE.published
        : guide.status === "Changes Required"
          ? TONE.amber
          : guide.status === "Ready to Publish" || guide.status === "Approved — Ready to Publish"
            ? TONE.violet
            : TONE.draft,
  };
}

export function integrationWasEverPublished(integration: { mintlifyStatus?: string }) {
  return integration.mintlifyStatus === "Published";
}

export function integrationTitleBadge(input: {
  integration: { workflowStatus: string; mintlifyStatus?: string };
  updating: boolean;
  pendingReady: boolean;
  verificationRequired: boolean;
}): TitleBadgeSpec | null {
  const { integration, updating, pendingReady, verificationRequired } = input;
  const everPublished = integrationWasEverPublished(integration);

  if (updating && everPublished) {
    if (pendingReady) return newUpdateSuffix("ready_to_publish");
    if (verificationRequired) return newUpdateSuffix("verification_required");
    if (integration.workflowStatus === "Changes Required") return newUpdateSuffix("changes_required");
    if (integration.workflowStatus === "Pending Review") return newUpdateSuffix("pending_review");
    return newUpdateSuffix("in_progress");
  }

  if (integration.workflowStatus === "Draft") {
    return { label: "Draft", className: TONE.draft };
  }
  if (integration.workflowStatus === "Changes Required" && !everPublished) {
    return { label: "Changes required", className: TONE.amber };
  }

  if (everPublished && !updating) return null;

  if (!everPublished && !updating) {
    const ws = integration.workflowStatus;
    if (ws === "Pending Review") {
      return { label: "Pending Review", className: TONE.violet };
    }
    if (ws === "Pending Mintlify") {
      return { label: "Ready to Publish", className: TONE.violet };
    }
  }

  return null;
}
