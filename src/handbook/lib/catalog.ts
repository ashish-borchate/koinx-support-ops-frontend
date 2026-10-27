import type { PlaybookRoleKey } from "./roles";
import { isPlaybookRoleKey, PLAYBOOK_ROLE_KEYS } from "./roles";

export type HandbookAudience = "all" | PlaybookRoleKey | PlaybookRoleKey[];

export type HandbookDocRef = {
  slug: string;
  title: string;
  description: string;
  order: number;
  audience: HandbookAudience;
};

export type SharedDocRef = HandbookDocRef & { collection: "shared" };

export type PlaybookDocRef = HandbookDocRef & {
  collection: "playbook";
  roleKey: PlaybookRoleKey;
};

export const SHARED_CHAPTERS: SharedDocRef[] = [
  {
    collection: "shared",
    slug: "what-is-support-hub",
    title: "What is KoinX Support Hub?",
    description: "Purpose of the Hub and how it fits into daily support work.",
    order: 1,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "hub-vs-freshdesk",
    title: "Hub vs Freshdesk",
    description: "When to use the internal Hub versus customer ticketing.",
    order: 2,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "getting-started-google-sign-in",
    title: "Getting started & sign-in",
    description: "Google Sign-In (preferred) and password fallback.",
    order: 3,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "navigation-and-interface",
    title: "Navigation & interface",
    description: "Sidebar, account menu, mobile layout, and View As.",
    order: 4,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "understanding-the-dashboard",
    title: "Dashboard & workspace",
    description: "Classic dashboard vs Operations Workspace.",
    order: 5,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "attention-notifications-and-tasks",
    title: "Attention, notifications & tasks",
    description: "Needs your attention, module tasks, and in-app toasts.",
    order: 6,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "module-overview",
    title: "Module overview",
    description: "Every active Hub module at a glance.",
    order: 7,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "kpi-and-qa-concepts",
    title: "KPI & QA concepts",
    description: "Metrics, scorecards, QA rubric, and appeals.",
    order: 8,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "documentation-and-trackers",
    title: "Documentation & trackers",
    description: "Product Guides, integrations, files, and related workflows.",
    order: 9,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "roles-and-permissions",
    title: "Roles & permissions",
    description: "Job responsibilities vs what the app allows.",
    order: 10,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "reported-issues-and-support-updates",
    title: "Reported Issues & Support Updates",
    description: "Internal issues and team announcements.",
    order: 11,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "daily-operational-practices",
    title: "Daily operational practices",
    description: "Healthy habits for every shift.",
    order: 12,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "terminology-glossary",
    title: "Terminology glossary",
    description: "Common Hub and support terms.",
    order: 13,
    audience: "all",
  },
  {
    collection: "shared",
    slug: "troubleshooting-and-faqs",
    title: "Troubleshooting & FAQs",
    description: "Login, access, DSAT, appeals, and common errors.",
    order: 14,
    audience: "all",
  },
];

function pb(
  roleKey: PlaybookRoleKey,
  slug: string,
  title: string,
  description: string,
  order: number,
): PlaybookDocRef {
  return { collection: "playbook", roleKey, slug, title, description, order, audience: roleKey };
}

export const PLAYBOOK_CHAPTERS: PlaybookDocRef[] = [
  pb("agent", "introduction", "Agent playbook — introduction", "Role purpose and Hub boundaries.", 1),
  pb("agent", "daily-routine", "Daily routine", "Start-of-shift checklist for Agents.", 2),
  pb("agent", "key-workflows", "Key workflows & mistakes", "QA, coaching, feedback, and pitfalls.", 3),
  pb("senior_agent", "introduction", "Senior Agent — introduction", "Quality and operational visibility.", 1),
  pb("senior_agent", "qa-and-dsat", "QA evaluations & Daily DSAT", "Scoring agents and DSAT checks.", 2),
  pb("senior_agent", "key-workflows", "Integration review & coaching", "Reviews, negative reviews, appeals.", 3),
  pb("supervisor", "introduction", "Supervisor — introduction", "Team operations ownership.", 1),
  pb("supervisor", "kpi-and-operations", "KPI entry & team operations", "Primary KPI ownership and triage.", 2),
  pb("supervisor", "guides-and-quality", "Guides, feedback & quality", "Publishing, PF review, coaching.", 3),
  pb("tech_agent", "introduction", "Tech Agent — introduction", "Technical integration work.", 1),
  pb("tech_agent", "integration-and-migrations", "Integration tasks & token migrations", "Frontend work and acknowledgements.", 2),
  pb("admin", "introduction", "Admin — introduction", "Full access and guardrails.", 1),
  pb("admin", "people-and-settings", "People, KPI settings & QA config", "Users, reporting owner, goals.", 2),
];

export function sharedChapterBySlug(slug: string): SharedDocRef | undefined {
  return SHARED_CHAPTERS.find((c) => c.slug === slug);
}

export function playbookChaptersForRole(roleKey: PlaybookRoleKey): PlaybookDocRef[] {
  return PLAYBOOK_CHAPTERS.filter((c) => c.roleKey === roleKey).sort((a, b) => a.order - b.order);
}

export function playbookChapter(roleKey: PlaybookRoleKey, slug: string): PlaybookDocRef | undefined {
  return PLAYBOOK_CHAPTERS.find((c) => c.roleKey === roleKey && c.slug === slug);
}

export function contentFileKey(ref: SharedDocRef | PlaybookDocRef): string {
  if (ref.collection === "shared") return `../content/shared/${ref.slug}.md`;
  return `../content/playbooks/${ref.roleKey}/${ref.slug}.md`;
}

export function rolesWithPlaybookContent(): PlaybookRoleKey[] {
  const set = new Set(PLAYBOOK_CHAPTERS.map((c) => c.roleKey));
  return PLAYBOOK_ROLE_KEYS.filter((k) => set.has(k));
}

export function playbookRolesForNav(): { roleKey: PlaybookRoleKey; chapterCount: number }[] {
  return PLAYBOOK_ROLE_KEYS.map((roleKey) => ({
    roleKey,
    chapterCount: playbookChaptersForRole(roleKey).length,
  }));
}

export function assertValidPlaybookRoute(roleKey: string, slug?: string): PlaybookRoleKey | null {
  if (!isPlaybookRoleKey(roleKey)) return null;
  if (!slug) return roleKey;
  return playbookChapter(roleKey, slug) ? roleKey : null;
}
