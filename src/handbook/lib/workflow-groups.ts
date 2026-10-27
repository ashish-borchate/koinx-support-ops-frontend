export type WorkflowGroup = {
  id: string;
  title: string;
  description: string;
  slugs: string[];
};

/** Admin oversight — grouped workflow index (handbook navigation only). */
export const ADMIN_WORKFLOW_GROUPS: WorkflowGroup[] = [
  {
    id: "performance",
    title: "Performance & quality",
    description: "KPI, QA, appeals, coaching, and DSAT accountability.",
    slugs: [
      "kpi-performance",
      "qa-evaluations-and-appeals",
      "coaching",
      "daily-dsat-and-negative-reviews",
    ],
  },
  {
    id: "documentation",
    title: "Documentation & product",
    description: "Guides, integrations, feedback, and rollout tracking.",
    slugs: ["product-guides", "integration-steps", "product-feedback", "feature-impact", "knowledge-base"],
  },
  {
    id: "operations",
    title: "Team operations",
    description: "Issues, announcements, files, and technical handoffs.",
    slugs: ["reported-issues", "support-updates", "supported-files", "token-migration"],
  },
];

export function groupWorkflowsForSlugs(
  groups: WorkflowGroup[],
  visibleSlugs: Set<string>,
): { group: WorkflowGroup; slugs: string[] }[] {
  return groups
    .map((group) => ({
      group,
      slugs: group.slugs.filter((s) => visibleSlugs.has(s)),
    }))
    .filter((g) => g.slugs.length > 0);
}
