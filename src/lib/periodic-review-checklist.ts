export const PERIODIC_CHECKLIST_ITEMS = [
  {
    id: "product_information",
    label: "I verified that the product information and instructions match the current KoinX product.",
  },
  {
    id: "screenshots",
    label: "I verified that the screenshots are accurate and up to date.",
  },
  {
    id: "links_navigation",
    label: "I verified that links, buttons, menu names, and navigation references are correct.",
  },
  {
    id: "missing_information",
    label: "I checked whether important steps, explanations, or information are missing.",
  },
  {
    id: "clarity_completeness",
    label: "I reviewed the guide for clarity and completeness.",
  },
] as const;

export type PeriodicChecklistAnswer = { result: "yes" | "na"; naReason?: string };
export type PeriodicChecklistPayload = Record<string, PeriodicChecklistAnswer>;

export function emptyPeriodicChecklist(): PeriodicChecklistPayload {
  return {};
}
