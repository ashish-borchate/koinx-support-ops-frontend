import { DISCOVER_CHAPTERS, ROLE_HANDBOOKS, WORKFLOW_DEFS } from "./learning-catalog";
import { loadRoleDoc, loadWorkflowDoc } from "./load-learning-content";
import type { PlaybookRoleKey } from "./roles";
import { PLAYBOOK_ROLE_LABELS } from "./roles";
import { stripMarkdown } from "./search-utils";
import { canViewPlaybookRole } from "./visibility";

export { stripMarkdown } from "./search-utils";

export type SearchResultKind = "discover" | "role" | "workflow";

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  description: string;
  href: string;
  excerpt: string;
  roles?: string;
};

function excerptAround(haystack: string, needle: string, radius = 80): string {
  const lower = haystack.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx === -1) return haystack.slice(0, radius * 2) + (haystack.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(haystack.length, idx + needle.length + radius);
  return (start > 0 ? "…" : "") + haystack.slice(start, end).trim() + (end < haystack.length ? "…" : "");
}

let cachedIndex: SearchResult[] | null = null;

export function buildHandbookSearchIndex(): SearchResult[] {
  if (cachedIndex) return cachedIndex;
  const items: SearchResult[] = [];

  for (const ch of DISCOVER_CHAPTERS) {
    items.push({
      id: `discover:${ch.slug}`,
      kind: "discover",
      title: ch.title,
      description: ch.description,
      href: `/handbook/discover/${ch.slug}`,
      excerpt: ch.description,
    });
  }

  for (const rh of ROLE_HANDBOOKS) {
    const doc = loadRoleDoc(rh.roleKey);
    if (!doc) continue;
    const plain = stripMarkdown(doc.body);
    items.push({
      id: `role:${rh.roleKey}`,
      kind: "role",
      title: `${rh.title} responsibilities`,
      description: rh.description,
      href: `/handbook/role/${rh.slug}`,
      excerpt: plain.slice(0, 160) + (plain.length > 160 ? "…" : ""),
      roles: PLAYBOOK_ROLE_LABELS[rh.roleKey],
    });
  }

  for (const w of WORKFLOW_DEFS) {
    const doc = loadWorkflowDoc(w.slug);
    const plain = doc ? stripMarkdown(doc.body) : w.description;
    items.push({
      id: `workflow:${w.slug}`,
      kind: "workflow",
      title: w.title,
      description: w.description,
      href: `/handbook/workflows/${w.slug}`,
      excerpt: plain.slice(0, 160) + (plain.length > 160 ? "…" : ""),
      roles: w.roles === "all" ? "All roles" : w.roles.map((r) => PLAYBOOK_ROLE_LABELS[r]).join(", "),
    });
  }

  cachedIndex = items;
  return items;
}

export function searchHandbook(
  query: string,
  audienceRole: PlaybookRoleKey | null,
  viewerRole: PlaybookRoleKey | null,
  limit = 40,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const index = buildHandbookSearchIndex().filter((item) => {
    if (!audienceRole || !viewerRole) return item.kind === "discover";
    if (item.kind === "role") {
      const roleKey = ROLE_HANDBOOKS.find((r) => item.href.endsWith(`/${r.slug}`))?.roleKey;
      return roleKey ? canViewPlaybookRole(viewerRole, roleKey) : false;
    }
    if (item.kind === "workflow") {
      const slug = item.href.split("/").pop() || "";
      return WORKFLOW_DEFS.some((w) => w.slug === slug);
    }
    return true;
  });

  const scored = index
    .map((item) => {
      const blob = `${item.title} ${item.description} ${item.excerpt}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (item.title.toLowerCase().includes(t)) score += 8;
        if (item.description.toLowerCase().includes(t)) score += 4;
        if (blob.includes(t)) score += 2;
      }
      if (!score) return null;
      return {
        item,
        score,
        excerpt: tokens.length ? excerptAround(item.excerpt, tokens[0]) : item.excerpt,
      };
    })
    .filter((x): x is { item: SearchResult; score: number; excerpt: string } => Boolean(x));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ item, excerpt }) => ({ ...item, excerpt }));
}

export function resetSearchIndexCache() {
  cachedIndex = null;
}
