export type IntegrationType = "File Upload" | "API" | "Direct Connect";

export type VerificationAnswer = { result: "verified" | "na" | "unable"; naReason?: string };
export type VerificationChecklistPayload = Record<string, VerificationAnswer>;

export type ChecklistItemDef = { id: string; label: string; shortLabel: string; allowsNa?: boolean };

/** Six verification items shared across integration types (type-specific extras retired). */
const VERIFICATION_ITEMS: ChecklistItemDef[] = [
  { id: "followed_instructions", label: "I independently followed the documented integration instructions.", shortLabel: "Steps followed" },
  { id: "navigation_labels", label: "I verified that exchange navigation, menu names, buttons, and labels match the current interface.", shortLabel: "Navigation & labels" },
  { id: "screenshots_current", label: "I verified that the screenshots are current and match the described steps.", shortLabel: "Screenshots current", allowsNa: true },
  { id: "complete_ordered", label: "I verified that the instructions are complete, correctly ordered, and understandable to customers.", shortLabel: "Complete & clear steps" },
  {
    id: "consent_screens",
    label: "I verified the required consent, login, or authorization screens against the documented instructions.",
    shortLabel: "Consent screens",
    allowsNa: true,
  },
  {
    id: "connected_state",
    label: "I confirmed that the documented flow successfully reaches the expected connected state.",
    shortLabel: "Connected state",
    allowsNa: true,
  },
];

export function integrationReviewChecklistItems(_type?: string): ChecklistItemDef[] {
  return [...VERIFICATION_ITEMS];
}
