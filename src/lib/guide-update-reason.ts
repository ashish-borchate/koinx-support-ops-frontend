export const GUIDE_UPDATE_REASON_OPTIONS = [
  "Agent Feedback",
  "Periodic Review",
  "Own Finding",
  "New Product Feature",
  "Other",
] as const;

export type GuideUpdateReasonOption = (typeof GUIDE_UPDATE_REASON_OPTIONS)[number];

export function serializeGuideUpdateReason(option: GuideUpdateReasonOption, otherDetail?: string): string {
  if (option === "Other") {
    const detail = (otherDetail || "").trim();
    return detail ? `Other: ${detail}` : "Other";
  }
  return option;
}

export function parseGuideUpdateReason(stored: string | undefined): {
  mode: "empty" | "canonical" | "other" | "legacy";
  option?: GuideUpdateReasonOption;
  otherDetail?: string;
  legacyText?: string;
} {
  const text = (stored || "").trim();
  if (!text) return { mode: "empty" };
  if (text === "Other") return { mode: "other", option: "Other", otherDetail: "" };
  if (text.startsWith("Other:")) {
    return { mode: "other", option: "Other", otherDetail: text.slice("Other:".length).trim() };
  }
  for (const option of GUIDE_UPDATE_REASON_OPTIONS) {
    if (option !== "Other" && text === option) return { mode: "canonical", option };
  }
  return { mode: "legacy", legacyText: text };
}

export function isGuideUpdateReasonReadyForPublish(stored: string | undefined): boolean {
  const parsed = parseGuideUpdateReason(stored);
  if (parsed.mode === "empty") return false;
  if (parsed.mode === "other" && !parsed.otherDetail?.trim()) return false;
  if (parsed.mode === "other" && parsed.option === "Other" && !parsed.otherDetail?.trim()) return false;
  return true;
}

export function formatGuideUpdateReasonDisplay(stored: string | undefined): string {
  const parsed = parseGuideUpdateReason(stored);
  if (parsed.mode === "empty") return "—";
  if (parsed.mode === "legacy") return parsed.legacyText || "—";
  if (parsed.mode === "other") {
    return parsed.otherDetail ? `Other — ${parsed.otherDetail}` : "Other";
  }
  return parsed.option || "—";
}
