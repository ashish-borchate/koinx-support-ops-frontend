import { WORKFLOW_DEFS, type WorkflowDef } from "./learning-catalog";
import type { PlaybookRoleKey } from "./roles";

/**
 * Workflows where the role has operational participation (My Workflows).
 * Distinct from handbook read access (all 13) and from `WorkflowDef.roles` visibility hints.
 */
export const MY_WORKFLOW_SLUGS_BY_ROLE: Record<PlaybookRoleKey, readonly string[]> = {
  admin: WORKFLOW_DEFS.map((w) => w.slug),
  supervisor: WORKFLOW_DEFS.map((w) => w.slug),
  senior_agent: [
    "qa-evaluations-and-appeals",
    "reported-issues",
    "product-feedback",
    "integration-steps",
    "daily-dsat-and-negative-reviews",
    "support-updates",
    "coaching",
    "kpi-performance",
    "knowledge-base",
  ],
  agent: [
    "qa-evaluations-and-appeals",
    "reported-issues",
    "product-feedback",
    "product-guides",
    "coaching",
    "kpi-performance",
    "daily-dsat-and-negative-reviews",
    "support-updates",
    "knowledge-base",
  ],
  tech_agent: ["integration-steps", "token-migration", "support-updates", "reported-issues"],
};

export function allHandbookWorkflows(): WorkflowDef[] {
  return [...WORKFLOW_DEFS].sort((a, b) => a.priority - b.priority);
}

export function myWorkflowsForRole(role: PlaybookRoleKey | null): WorkflowDef[] {
  if (!role) return [];
  const allowed = new Set(MY_WORKFLOW_SLUGS_BY_ROLE[role]);
  return allHandbookWorkflows().filter((w) => allowed.has(w.slug));
}

export function isMyWorkflowForRole(slug: string, role: PlaybookRoleKey | null): boolean {
  if (!role) return false;
  return MY_WORKFLOW_SLUGS_BY_ROLE[role].includes(slug);
}

export type WorkflowGuideView = "all" | "my";

export function parseWorkflowGuideView(raw: string | null): WorkflowGuideView {
  return raw === "all" ? "all" : "my";
}

export function workflowGuidesHref(view: WorkflowGuideView = "my"): string {
  return view === "all" ? "/handbook/workflows?view=all" : "/handbook/workflows?view=my";
}

export function workflowGuideDetailHref(slug: string, view: WorkflowGuideView): string {
  const q = view === "all" ? "?view=all" : "?view=my";
  return `/handbook/workflows/${slug}${q}`;
}
