export const PLAYBOOK_ROLE_KEYS = ["agent", "senior_agent", "supervisor", "tech_agent", "admin"] as const;
export type PlaybookRoleKey = (typeof PLAYBOOK_ROLE_KEYS)[number];

export const PLAYBOOK_ROLE_LABELS: Record<PlaybookRoleKey, string> = {
  agent: "Agent",
  senior_agent: "Senior Agent",
  supervisor: "Supervisor",
  tech_agent: "Tech Agent",
  admin: "Admin",
};

export function isPlaybookRoleKey(value: string): value is PlaybookRoleKey {
  return (PLAYBOOK_ROLE_KEYS as readonly string[]).includes(value);
}

export function playbookPath(roleKey: PlaybookRoleKey, chapterSlug?: string) {
  return chapterSlug ? `/handbook/playbooks/${roleKey}/${chapterSlug}` : `/handbook/playbooks/${roleKey}`;
}

export function myPlaybookPath(roleKey: string) {
  if (isPlaybookRoleKey(roleKey)) return playbookPath(roleKey);
  return "/handbook/playbooks";
}
