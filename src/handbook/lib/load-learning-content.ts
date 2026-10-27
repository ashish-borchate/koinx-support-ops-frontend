import { parseFrontmatter } from "./parse-frontmatter";
import {
  contentPathForDiscover,
  contentPathForReference,
  contentPathForRole,
  contentPathForWorkflow,
} from "./learning-catalog";
import type { PlaybookRoleKey } from "./roles";

export type LoadedLearningDoc = {
  slug: string;
  title: string;
  description: string;
  body: string;
};

const rawByPath = import.meta.glob<string>("../content/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function loadAt(path: string): LoadedLearningDoc | null {
  const raw = rawByPath[path];
  if (!raw) return null;
  const parsed = parseFrontmatter(raw);
  const data = parsed.data;
  const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? "";
  return {
    slug,
    title: String(data.title ?? slug).replace(/^Role handbook$/i, slug.replace(/_/g, " ")),
    description: String(data.description ?? ""),
    body: parsed.content,
  };
}

export function loadDiscoverDoc(slug: string): LoadedLearningDoc | null {
  return loadAt(contentPathForDiscover(slug));
}

export function loadReferenceDoc(slug: string): LoadedLearningDoc | null {
  return loadAt(contentPathForReference(slug));
}

export function loadRoleDoc(roleKey: PlaybookRoleKey): LoadedLearningDoc | null {
  return loadAt(contentPathForRole(roleKey));
}

export function loadWorkflowDoc(slug: string): LoadedLearningDoc | null {
  return loadAt(contentPathForWorkflow(slug));
}
