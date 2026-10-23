export type ReadyPublishAnswer = { result: "verified" | "na" | "unable"; naReason?: string };
export type ReadyPublishChecklistPayload = Record<string, ReadyPublishAnswer>;

export const READY_PUBLISH_CHECKLIST_ITEMS = [
  { id: "product_match", label: "I verified that the guide information matches the current KoinX product.", shortLabel: "Product accuracy" },
  { id: "steps_navigation", label: "I verified that the documented steps, navigation, and feature behavior are accurate.", shortLabel: "Steps & navigation" },
  { id: "screenshots", label: "I verified that screenshots are current and correctly placed.", shortLabel: "Screenshots", allowsNa: true },
  { id: "links_labels", label: "I verified that links, buttons, labels, and references are correct.", shortLabel: "Links & labels" },
] as const;

export type ReadyPublishItemDef = (typeof READY_PUBLISH_CHECKLIST_ITEMS)[number];
