export const INTEGRATION_UPDATE_REASON_OPTIONS = [
  "New Integration",
  "Agent Feedback",
  "Periodic Review",
  "Own Finding",
  "New Product Feature",
  "Exchange UI/API Change",
  "Other",
] as const;

export type IntegrationUpdateReasonOption = (typeof INTEGRATION_UPDATE_REASON_OPTIONS)[number];

export function serializeIntegrationUpdateReason(option: IntegrationUpdateReasonOption, otherDetail?: string): string {
  if (option === "Other") {
    const detail = (otherDetail || "").trim();
    return detail ? `Other: ${detail}` : "Other";
  }
  return option;
}

export function parseIntegrationUpdateReason(stored: string | undefined): {
  mode: "empty" | "canonical" | "other" | "legacy";
  option?: IntegrationUpdateReasonOption;
  otherDetail?: string;
  legacyText?: string;
} {
  const text = (stored || "").trim();
  if (!text) return { mode: "empty" };
  if (text === "Other") return { mode: "other", option: "Other", otherDetail: "" };
  if (text.startsWith("Other:")) {
    return { mode: "other", option: "Other", otherDetail: text.slice("Other:".length).trim() };
  }
  for (const option of INTEGRATION_UPDATE_REASON_OPTIONS) {
    if (option !== "Other" && text === option) return { mode: "canonical", option };
  }
  return { mode: "legacy", legacyText: text };
}

export function isIntegrationUpdateReasonReadyForPublish(stored: string | undefined): boolean {
  const parsed = parseIntegrationUpdateReason(stored);
  if (parsed.mode === "empty") return false;
  if (parsed.mode === "other" && !parsed.otherDetail?.trim()) return false;
  return true;
}

export function formatIntegrationUpdateReasonDisplay(stored: string | undefined): string {
  const parsed = parseIntegrationUpdateReason(stored);
  if (parsed.mode === "empty") return "—";
  if (parsed.mode === "legacy") return parsed.legacyText || "—";
  if (parsed.mode === "other") return parsed.otherDetail ? `Other — ${parsed.otherDetail}` : "Other";
  return parsed.option || "—";
}
