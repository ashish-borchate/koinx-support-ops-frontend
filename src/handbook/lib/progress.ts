import { DISCOVER_CHAPTERS } from "./learning-catalog";
import type { PlaybookRoleKey } from "./roles";

const KEY = "koinx-handbook-progress-v1";

export type HandbookProgress = {
  discover: string[];
  roleVisited: boolean;
  workflows: string[];
  reference: string[];
  checklist: Record<string, boolean>;
};

const DEFAULT: HandbookProgress = {
  discover: [],
  roleVisited: false,
  workflows: [],
  reference: [],
  checklist: {},
};

function read(): HandbookProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as HandbookProgress) };
  } catch {
    return { ...DEFAULT };
  }
}

function write(p: HandbookProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function markDiscoverVisited(slug: string) {
  const p = read();
  if (!p.discover.includes(slug)) p.discover = [...p.discover, slug];
  write(p);
}

export function markRoleVisited() {
  const p = read();
  p.roleVisited = true;
  write(p);
}

export function markWorkflowVisited(slug: string) {
  const p = read();
  if (!p.workflows.includes(slug)) p.workflows = [...p.workflows, slug];
  write(p);
}

export function markReferenceVisited(slug: string) {
  const p = read();
  if (!p.reference.includes(slug)) p.reference = [...p.reference, slug];
  write(p);
}

export function toggleChecklistItem(id: string, done: boolean) {
  const p = read();
  p.checklist = { ...p.checklist, [id]: done };
  write(p);
}

export function getHandbookProgress(): HandbookProgress {
  return read();
}

export type JourneyStep = {
  id: string;
  title: string;
  done: boolean;
  to: string;
};

export function journeySteps(audienceRole: PlaybookRoleKey | null, priorityWorkflowSlugs: string[]): JourneyStep[] {
  const p = read();
  const discoverDone = DISCOVER_CHAPTERS.every((c) => p.discover.includes(c.slug));
  const workflowsDone =
    priorityWorkflowSlugs.length > 0 && priorityWorkflowSlugs.every((s) => p.workflows.includes(s));
  const refDone = p.reference.includes("troubleshooting");

  return [
    {
      id: "discover",
      title: "Understand Support Hub",
      done: discoverDone,
      to: "/handbook/discover/welcome",
    },
    {
      id: "role",
      title: "Learn your responsibilities",
      done: p.roleVisited,
      to: audienceRole ? `/handbook/role/${roleHandbookSlug(audienceRole)}` : "/handbook/role",
    },
    {
      id: "workflows",
      title: "Study your key workflows",
      done: workflowsDone,
      to: "/handbook/workflows",
    },
    {
      id: "checklist",
      title: "Complete onboarding checklist",
      done: refDone && Object.values(p.checklist).filter(Boolean).length >= 3,
      to: "/handbook#checklist",
    },
  ];
}

function roleHandbookSlug(roleKey: PlaybookRoleKey): string {
  const map: Record<PlaybookRoleKey, string> = {
    agent: "agent",
    senior_agent: "senior-agent",
    supervisor: "supervisor",
    tech_agent: "tech-agent",
    admin: "admin",
  };
  return map[roleKey];
}

export function continueLearningHref(audienceRole: PlaybookRoleKey | null, priorityWorkflowSlugs: string[]): string {
  const steps = journeySteps(audienceRole, priorityWorkflowSlugs);
  const next = steps.find((s) => !s.done);
  return next?.to ?? "/handbook/workflows";
}
