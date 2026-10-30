export const MANAGEMENT_DRILL_MODULES = [
  "productGuides",
  "integrationSteps",
  "supportedFiles",
  "negativeReviews",
  "productFeedback",
  "tokenMigration",
] as const;

export type ManagementDrillModule = (typeof MANAGEMENT_DRILL_MODULES)[number];

export const MANAGEMENT_MODULE_LABELS: Record<ManagementDrillModule, string> = {
  productGuides: "Product Guides",
  integrationSteps: "Integration Steps",
  supportedFiles: "Supported Files",
  negativeReviews: "Negative Reviews",
  productFeedback: "Product Feedback",
  tokenMigration: "Token Migration",
};

export type DrillDownScope = "live" | "completed";

export type DrillDownRecord = {
  id: string;
  title: string;
  statusLabel: string;
  ownerLabel?: string | null;
  eventAt?: string | null;
  deadlineAt?: string | null;
  overdueLabel?: string | null;
  detailPath: string;
};

export type DrillDownTarget = {
  scope: DrillDownScope;
  module: ManagementDrillModule;
  category: string;
};

/** Completed-work category keys — must match server `drill-down/completed.ts`. */
export const COMPLETED_WORK_CATEGORIES: Record<
  ManagementDrillModule,
  { categoryKey: string; label: string; countKey: string }[]
> = {
  productGuides: [
    { categoryKey: "updated", label: "Updated", countKey: "updated" },
    { categoryKey: "reviewed", label: "Reviewed", countKey: "reviewed" },
    { categoryKey: "approved", label: "Approved", countKey: "approved" },
    { categoryKey: "published", label: "Published", countKey: "published" },
  ],
  integrationSteps: [
    { categoryKey: "updated", label: "Updated", countKey: "updated" },
    { categoryKey: "reviewed", label: "Reviewed", countKey: "reviewed" },
    { categoryKey: "approved", label: "Approved", countKey: "approved" },
    { categoryKey: "published_by_tech", label: "Published by Tech", countKey: "publishedByTech" },
  ],
  supportedFiles: [
    { categoryKey: "added", label: "Added", countKey: "added" },
    { categoryKey: "updated", label: "Updated / replaced", countKey: "updated" },
  ],
  negativeReviews: [
    { categoryKey: "reviews_logged", label: "Reviews logged", countKey: "reviewed" },
    { categoryKey: "coaching_completed", label: "Coaching completed", countKey: "coachingCompleted" },
    { categoryKey: "agent_ack_completed", label: "Agent ack completed", countKey: "agentAckCompleted" },
  ],
  productFeedback: [
    { categoryKey: "supervisor_reviewed", label: "Supervisor reviewed", countKey: "reviewed" },
    { categoryKey: "approved", label: "Approved", countKey: "approved" },
    { categoryKey: "shared_in_slack", label: "Shared in Slack", countKey: "sharedInSlack" },
  ],
  tokenMigration: [
    { categoryKey: "migrations_recorded", label: "Migrations recorded", countKey: "recorded" },
    { categoryKey: "tech_ack_completed", label: "Tech acknowledgements", countKey: "techAckCompleted" },
  ],
};

export function liveModuleLabel(key: string) {
  if (key in MANAGEMENT_MODULE_LABELS) return MANAGEMENT_MODULE_LABELS[key as ManagementDrillModule];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
