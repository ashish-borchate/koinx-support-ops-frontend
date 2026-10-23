export type SectionAttention = "none" | "yellow" | "red";

type GuideAttentionInput = {
  status?: string;
  hasPendingUpdate?: boolean;
  pendingUpdateStatus?: string | null;
  requiresPersonalAttention?: boolean;
  reviewDue?: boolean;
  slaState?: string;
};

export function productGuideAttentionLevel(guide: GuideAttentionInput): SectionAttention {
  const status = guide.status || "";
  if (status === "Draft" || status === "Changes Required") return "red";
  if (status === "Ready to Publish") return "yellow";
  if (guide.hasPendingUpdate || guide.pendingUpdateStatus) return "yellow";
  if (guide.requiresPersonalAttention) return "yellow";
  if (guide.reviewDue) return "yellow";
  if (guide.slaState === "Overdue") return "red";
  if (guide.slaState === "Due Soon") return "yellow";
  return "none";
}

export function productGuideSectionAttention(guides: GuideAttentionInput[]): SectionAttention {
  let yellow = false;
  for (const guide of guides) {
    const level = productGuideAttentionLevel(guide);
    if (level === "red") return "red";
    if (level === "yellow") yellow = true;
  }
  return yellow ? "yellow" : "none";
}
