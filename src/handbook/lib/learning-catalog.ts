import type { PlaybookRoleKey } from "./roles";

export type HandbookSectionId = "discover" | "role" | "workflows";

/** Primary handbook areas (homepage cards and internal routing). */
export const HANDBOOK_SECTIONS: {
  id: HandbookSectionId;
  title: string;
  short: string;
  path: string;
}[] = [
  { id: "discover", title: "Discover the Hub", short: "Understand the workspace, navigation and available modules.", path: "/handbook/discover" },
  {
    id: "role",
    title: "My Role",
    short: "Learn your responsibilities, daily priorities and assigned work.",
    path: "/handbook/role",
  },
  { id: "workflows", title: "Workflow Guides", short: "Explore all 13 workflows or focus on the ones relevant to your role.", path: "/handbook/workflows" },
];

export type DiscoverChapter = {
  section: "discover";
  slug: string;
  title: string;
  description: string;
  order: number;
};

export type RoleHandbook = {
  section: "role";
  roleKey: PlaybookRoleKey;
  slug: string;
  title: string;
  description: string;
};

export type ReferenceChapter = {
  section: "reference";
  slug: string;
  title: string;
  description: string;
  order: number;
};

export type WorkflowLifecycleStep = {
  label: string;
  who: string;
  what: string;
};

export type WorkflowDef = {
  section: "workflows";
  slug: string;
  title: string;
  description: string;
  /** Handbook visibility (not app permissions). */
  roles: PlaybookRoleKey[] | "all";
  priority: number;
  hubRoute?: string;
  primaryOwner?: string;
  lifecycle: WorkflowLifecycleStep[];
  /** Stable internal id — not shown in UI headings */
  internalRef?: string;
};

export const DISCOVER_CHAPTERS: DiscoverChapter[] = [
  {
    section: "discover",
    slug: "welcome",
    title: "Welcome to Support Hub",
    description: "Your workspace for everything happening behind the scenes in KoinX Support.",
    order: 1,
  },
  {
    section: "discover",
    slug: "getting-around",
    title: "Access, Navigation & Your Dashboard",
    description: "Learn how to access Support Hub, find your work and stay updated.",
    order: 2,
  },
];

export const ROLE_HANDBOOKS: RoleHandbook[] = [
  { section: "role", roleKey: "agent", slug: "agent", title: "Agent", description: "Tickets in Freshdesk; QA, coaching, guides, and feedback in the Hub." },
  {
    section: "role",
    roleKey: "senior_agent",
    slug: "senior-agent",
    title: "Senior Agent",
    description: "Agent QA, integration review support, and Daily DSAT Deep Dive.",
  },
  {
    section: "role",
    roleKey: "supervisor",
    slug: "supervisor",
    title: "Supervisor",
    description: "Team KPI entry, guide publication, triage, and operational ownership.",
  },
  {
    section: "role",
    roleKey: "tech_agent",
    slug: "tech-agent",
    title: "Tech Agent",
    description: "Integration frontend work and token migration acknowledgements.",
  },
  {
    section: "role",
    roleKey: "admin",
    slug: "admin",
    title: "Admin",
    description: "People, performance configuration, QA windows, and operational oversight.",
  },
];

export const REFERENCE_CHAPTERS: ReferenceChapter[] = [
  {
    section: "reference",
    slug: "troubleshooting",
    title: "Troubleshooting & FAQs",
    description: "Login, access, DSAT, appeals, and common errors.",
    order: 1,
  },
  {
    section: "reference",
    slug: "glossary-and-permissions",
    title: "Glossary & who owns what",
    description: "Terms and operational ownership — not technical permission lists.",
    order: 2,
  },
];

export const WORKFLOW_DEFS: WorkflowDef[] = [
  {
    section: "workflows",
    slug: "qa-evaluations-and-appeals",
    title: "Quality Assurance and Appeal",
    description: "From Senior Agent review through acknowledgement, appeal, escalation, and effective scoring.",
    roles: ["agent", "senior_agent", "supervisor", "admin"],
    priority: 1,
    hubRoute: "/qa",
    primaryOwner: "Senior Agent",
    internalRef: "C-QA-01",
    lifecycle: [
      { label: "Create review", who: "Senior Agent", what: "Scores an Agent on the KoinX rubric." },
      { label: "Agent views", who: "Agent", what: "Reviews scores; acknowledges when required." },
      { label: "Appeal", who: "Agent", what: "Submits within the configured appeal window (see live settings when Admin)." },
      { label: "Reviewer decision", who: "Senior Agent (reviewer)", what: "Accept, partially accept, or reject challenged criteria." },
      { label: "Escalation", who: "Supervisor", what: "Decides escalated appeals within the configured escalation window." },
      { label: "Closed", who: "Hub", what: "Effective QA score updates KPI-related views; no supervisor validation step." },
    ],
  },
  {
    section: "workflows",
    slug: "reported-issues",
    title: "Reported Issues",
    description: "Report, triage, assign, discuss, and resolve internal operational issues.",
    roles: "all",
    priority: 2,
    hubRoute: "/reported-issues",
    primaryOwner: "Supervisor",
    internalRef: "C-RI-01",
    lifecycle: [
      { label: "Create", who: "Support employee", what: "From a module or general operations; optional attachments." },
      { label: "Pending Review", who: "Supervisor (resource-linked)", what: "Triage queue — not every manage holder." },
      { label: "In Progress", who: "Assignee", what: "Work the fix; @mentions notify via hub toasts." },
      {
        label: "Resolved / No Action Required",
        who: "Supervisor or assignee",
        what: '"No Attention Required" requires reason; does not auto-fix source module.',
      },
    ],
  },
  {
    section: "workflows",
    slug: "product-feedback",
    title: "Product Feedback",
    description: "Daily observations from the floor; supervisor review outcomes.",
    roles: ["agent", "senior_agent", "supervisor", "admin"],
    priority: 3,
    hubRoute: "/product-feedback",
    primaryOwner: "Supervisor",
    lifecycle: [
      { label: "Submit", who: "Agents (and others with submit)", what: "Structured feedback from support work." },
      { label: "Pending Review", who: "Supervisor", what: "Dashboard attention for pending items." },
      { label: "Approved / Rejected", who: "Supervisor", what: "Formal review decision — not a customer ticket." },
    ],
  },
  {
    section: "workflows",
    slug: "product-guides",
    title: "Product Guides",
    description: "Draft → ready to publish → published → accuracy review; agent daily review.",
    roles: ["agent", "supervisor", "admin"],
    priority: 4,
    hubRoute: "/product-guides",
    primaryOwner: "Supervisor",
    internalRef: "C-PG-02",
    lifecycle: [
      { label: "Draft / Changes Required", who: "Supervisor or Admin", what: "Edit content in Hub workflow." },
      { label: "Ready to Publish", who: "Supervisor", what: "Checklist + Mintlify confirmation." },
      { label: "Published", who: "Supervisor (publish permission)", what: "Official doc; maintenance schedule starts." },
      { label: "Accuracy review", who: "Supervisor", what: "Periodic accurate vs needs_update." },
      { label: "Agent daily review", who: "Agent", what: "When assigned on dashboard — separate from publish workflow." },
    ],
  },
  {
    section: "workflows",
    slug: "integration-steps",
    title: "Integration Steps",
    description: "Exchange integration documentation from draft through tech completion.",
    roles: ["senior_agent", "supervisor", "tech_agent", "admin"],
    priority: 5,
    hubRoute: "/integration-steps",
    primaryOwner: "Supervisor",
    lifecycle: [
      { label: "Draft", who: "Supervisor", what: "Author integration documentation." },
      { label: "Pending Review", who: "Senior Agent (assigned reviewer)", what: "Review queue." },
      { label: "Mintlify / Frontend", who: "Supervisor + Tech Agent", what: "Pending Mintlify → Mintlify Published → Pending Frontend." },
      { label: "Completed", who: "Team", what: "Library entry; assignments drive attention." },
    ],
  },
  {
    section: "workflows",
    slug: "daily-dsat-and-negative-reviews",
    title: "DSAT Reviews",
    description: "Senior Agent daily DSAT checks and negative review coaching linkage.",
    roles: ["senior_agent", "supervisor", "admin", "agent"],
    priority: 6,
    hubRoute: "/daily-dsat",
    primaryOwner: "Senior Agent",
    internalRef: "C-NR-04",
    lifecycle: [
      { label: "Daily DSAT check", who: "Senior Agent", what: "dsat_found or no_dsat_found per IST working day (Mon–Sat)." },
      { label: "Negative review record", who: "Supervisor / Senior", what: "Root cause and coaching status on tracker." },
      { label: "Agent acknowledgement", who: "Agent", what: "When prompted on own negative review records." },
    ],
  },
  {
    section: "workflows",
    slug: "support-updates",
    title: "Support Updates",
    description: "Internal announcements and acknowledgement when required.",
    roles: "all",
    priority: 7,
    hubRoute: "/support-updates",
    lifecycle: [
      { label: "Publish", who: "Senior Agent / Supervisor / Admin", what: "Broadcast to support team." },
      { label: "Read & acknowledge", who: "All viewers", what: "Dashboard may require ack; material edits can reset ack version." },
    ],
  },
  {
    section: "workflows",
    slug: "kpi-performance",
    title: "KPI Performance",
    description: "Manual weekly metrics, scorecards, and who enters data.",
    roles: ["agent", "supervisor", "admin"],
    priority: 8,
    hubRoute: "/kpi",
    primaryOwner: "Supervisor",
    internalRef: "C-KPI-02",
    lifecycle: [
      { label: "Data entry", who: "Supervisor (primary); Admin also", what: "Manual entry per agent per week (Monday week, IST)." },
      { label: "Agent view", who: "Agent", what: "Own scorecard when kpi.view_own." },
      { label: "Composite score", who: "System", what: "FRT, ART, resolution, SLA, CSAT, QA average — QA uses effective score after appeals." },
    ],
  },
  {
    section: "workflows",
    slug: "coaching",
    title: "Coaching Center",
    description: "Coaching records, acknowledgement, and disputes.",
    roles: ["agent", "senior_agent", "supervisor", "admin"],
    priority: 9,
    hubRoute: "/coaching",
    lifecycle: [
      { label: "Create / assign", who: "Supervisor", what: "From QA, negative reviews, or manual." },
      { label: "In progress", who: "Assignee", what: "Statuses through Pending Acknowledgement." },
      { label: "Completed", who: "Agent acknowledges", what: "Or Acknowledgement Disputed — supervisor follow-up." },
    ],
  },
  {
    section: "workflows",
    slug: "token-migration",
    title: "Token Migration",
    description: "Migration events and tech acknowledgement.",
    roles: ["tech_agent", "supervisor", "senior_agent", "admin"],
    priority: 10,
    hubRoute: "/token-migration",
    internalRef: "C-TM-02",
    lifecycle: [
      { label: "Record migration", who: "Supervisor / Senior / Admin", what: "Coin migration details; mark informed tech." },
      { label: "Tech acknowledgement", who: "Tech Agent", what: "When informedTech and pending ack — dashboard attention." },
    ],
  },
  {
    section: "workflows",
    slug: "supported-files",
    title: "Supported Files",
    description: "Exchange file matrix and verification state.",
    roles: ["agent", "senior_agent", "supervisor", "tech_agent", "admin"],
    priority: 11,
    hubRoute: "/supported-files",
    lifecycle: [
      { label: "Tracker updates", who: "Support roles with tracker access", what: "File support entries." },
      { label: "Needs Review", who: "Supervisor / Admin", what: "Verification queue on dashboard module tasks." },
    ],
  },
  {
    section: "workflows",
    slug: "feature-impact",
    title: "Feature Impact",
    description: "Rollout tracking across linked product guides.",
    roles: ["supervisor", "admin"],
    priority: 12,
    hubRoute: "/feature-impacts",
    lifecycle: [
      { label: "Link guides", who: "Supervisor", what: "Impact record ties to product guides." },
      { label: "Status", who: "Computed", what: "Needs Action / Working / Complete from publish progress." },
    ],
  },
  {
    section: "workflows",
    slug: "knowledge-base",
    title: "Knowledge Base",
    description: "Long-form internal articles (separate from Product Guides).",
    roles: ["agent", "senior_agent", "supervisor", "tech_agent", "admin"],
    priority: 13,
    hubRoute: "/knowledge-base",
    lifecycle: [
      { label: "Active articles", who: "Editors with manage", what: "HTML articles for internal reference." },
      { label: "Needs Update / Archived", who: "Maintainers", what: "No dashboard attention contributor — check tracker." },
    ],
  },
];

export function discoverBySlug(slug: string): DiscoverChapter | undefined {
  return DISCOVER_CHAPTERS.find((c) => c.slug === slug);
}

export function referenceBySlug(slug: string): ReferenceChapter | undefined {
  return REFERENCE_CHAPTERS.find((c) => c.slug === slug);
}

export function workflowBySlug(slug: string): WorkflowDef | undefined {
  return WORKFLOW_DEFS.find((w) => w.slug === slug);
}

export function roleHandbookBySlug(slug: string): RoleHandbook | undefined {
  return ROLE_HANDBOOKS.find((r) => r.slug === slug);
}

export function roleHandbookByKey(roleKey: PlaybookRoleKey): RoleHandbook | undefined {
  return ROLE_HANDBOOKS.find((r) => r.roleKey === roleKey);
}

export function contentPathForDiscover(slug: string): string {
  return `../content/discover/${slug}.md`;
}

export function contentPathForReference(slug: string): string {
  return `../content/reference/${slug}.md`;
}

export function contentPathForRole(roleKey: PlaybookRoleKey): string {
  return `../content/role/${roleKey}.md`;
}

export function contentPathForWorkflow(slug: string): string {
  return `../content/workflows/${slug}.md`;
}
