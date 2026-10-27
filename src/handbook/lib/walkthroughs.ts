import type { PlaybookRoleKey } from "./roles";

export type WalkthroughRef = {
  id: string;
  slug: string;
  title: string;
  description: string;
  purpose: string;
  roles: PlaybookRoleKey[] | "all";
  whenToUse: string;
  prerequisites: string;
  screenshotAsset?: string;
  order: number;
};

export const WALKTHROUGHS: WalkthroughRef[] = [
  {
    id: "C-AUTH-01",
    slug: "C-AUTH-01-sign-in-google",
    title: "Sign in with Google",
    description: "Preferred login using your approved Google account.",
    purpose: "Access the Support Hub securely without storing a separate Hub password.",
    roles: "all",
    whenToUse: "At the start of every shift or when your session expires.",
    prerequisites: "An active employee account created in User management (People).",
    screenshotAsset: "auth-01-login-google.png",
    order: 1,
  },
  {
    id: "C-KPI-02",
    slug: "C-KPI-02-enter-weekly-kpi",
    title: "Enter weekly agent KPI",
    description: "Supervisor-owned data entry for agent performance metrics.",
    purpose: "Keep team KPI records accurate in the Hub for scorecards and reviews.",
    roles: ["supervisor", "admin"],
    whenToUse: "After each reporting week closes (Monday-based week in IST).",
    prerequisites: "Permission to edit KPI (`kpi.edit`).",
    screenshotAsset: "kpi-02-edit-agent-week.png",
    order: 2,
  },
  {
    id: "C-QA-01",
    slug: "C-QA-01-create-agent-qa",
    title: "Create an Agent QA review",
    description: "Score a closed ticket conversation using the KoinX QA rubric.",
    purpose: "Document quality feedback for Agent roles.",
    roles: ["senior_agent"],
    whenToUse: "When sampling or reviewing agent ticket work assigned to QA.",
    prerequisites: "Permission to create QA (`qa.create`). Subject must be an Agent.",
    screenshotAsset: "qa-02-form-rubric.png",
    order: 3,
  },
  {
    id: "C-QA-04",
    slug: "C-QA-04-submit-appeal",
    title: "Submit a QA appeal",
    description: "Challenge criterion scores within the appeal window.",
    purpose: "Give agents a formal path to dispute QA scores on the current rubric.",
    roles: ["agent"],
    whenToUse: "When you disagree with a published QA review and the appeal window is still open.",
    prerequisites: "Own the QA review; KoinX rubric; default appeal window 7 days (production unverified).",
    screenshotAsset: "qa-04-appeal-submit.png",
    order: 4,
  },
  {
    id: "C-NR-04",
    slug: "C-NR-04-daily-dsat",
    title: "Complete Daily DSAT check",
    description: "Reporting owner records whether DSAT was found for each IST working day.",
    purpose: "Track daily DSAT monitoring accountability.",
    roles: ["senior_agent"],
    whenToUse: "Each Mon–Sat day when you are the configured KPI reporting owner.",
    prerequisites: "Admin set you as reporting owner with a launch date in KPI settings.",
    screenshotAsset: "nr-02-daily-dsat-form.png",
    order: 5,
  },
  {
    id: "C-PG-02",
    slug: "C-PG-02-ready-to-publish",
    title: "Mark a product guide ready to publish",
    description: "Supervisor verification checklist before publish queue.",
    purpose: "Ensure Mintlify content is verified before supervisors publish.",
    roles: ["supervisor", "admin"],
    whenToUse: "When draft content is complete and Mintlify is updated.",
    prerequisites: "Guide in Draft or Changes Required; manage/publish permissions.",
    screenshotAsset: "pg-03-ready-checklist.png",
    order: 6,
  },
  {
    id: "C-PG-03",
    slug: "C-PG-03-publish-guide",
    title: "Publish a product guide",
    description: "Move an approved guide to Published with Mintlify URL.",
    purpose: "Make documentation official for the support team.",
    roles: ["supervisor", "admin"],
    whenToUse: "When a guide is Ready to Publish.",
    prerequisites: "`guides.publish` permission.",
    screenshotAsset: "pg-04-publish.png",
    order: 7,
  },
  {
    id: "C-RI-01",
    slug: "C-RI-01-report-issue",
    title: "Report an issue",
    description: "Log a documentation or operational problem.",
    purpose: "Route fixes through Reported Issues instead of informal threads.",
    roles: "all",
    whenToUse: "When you find incorrect docs, broken workflows, or internal ops problems.",
    prerequisites: "`reported_issues.create`.",
    screenshotAsset: "ri-03-report-dialog.png",
    order: 8,
  },
  {
    id: "C-RI-02",
    slug: "C-RI-02-triage-issue",
    title: "Triage a reported issue",
    description: "Supervisor review, assignment, and resolution.",
    purpose: "Move internal issues from Pending Review to resolution.",
    roles: ["supervisor", "admin"],
    whenToUse: "When resource-linked issues are Pending Review or assignee work is open.",
    prerequisites: "View/manage reported issues permissions.",
    screenshotAsset: "ri-02-detail-triage.png",
    order: 9,
  },
  {
    id: "C-TM-02",
    slug: "C-TM-02-tech-ack-migration",
    title: "Acknowledge token migration (Tech)",
    description: "Tech Agent confirms migration notice.",
    purpose: "Close the loop when migrations are communicated to tech.",
    roles: ["tech_agent"],
    whenToUse: "When a migration is marked informed and awaits tech acknowledgement.",
    prerequisites: "`token_migration.acknowledge`.",
    screenshotAsset: "tm-02-tech-ack.png",
    order: 10,
  },
  {
    id: "C-ADM-02",
    slug: "C-ADM-02-kpi-reporting-owner",
    title: "Set KPI reporting owner (Daily DSAT)",
    description: "Admin configures who receives Daily DSAT tasks.",
    purpose: "Assign Daily DSAT and related reporting tasks to one active user (e.g. Senior Agent).",
    roles: ["admin"],
    whenToUse: "When onboarding a new reporting owner or changing DSAT responsibility.",
    prerequisites: "`kpi.manage_goals` (Admin).",
    screenshotAsset: "kpi-03-settings-reporting.png",
    order: 11,
  },
];

export function walkthroughBySlug(slug: string) {
  return WALKTHROUGHS.find((w) => w.slug === slug);
}

export function walkthroughContentPath(slug: string) {
  return `../content/guides/${slug}.md`;
}
