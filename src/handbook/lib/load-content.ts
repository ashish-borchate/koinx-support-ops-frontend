import type { PlaybookDocRef, SharedDocRef } from "./catalog";
import { contentFileKey } from "./catalog";
import { parseFrontmatter } from "./parse-frontmatter";

export type LoadedHandbookDoc = {
  slug: string;
  title: string;
  description: string;
  audience: string;
  body: string;
};

const rawByPath = import.meta.glob<string>("../content/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function loadMarkdownDoc(ref: SharedDocRef | PlaybookDocRef): LoadedHandbookDoc | null {
  const key = contentFileKey(ref);
  const raw = rawByPath[key];
  if (!raw) return null;
  const parsed = parseFrontmatter(raw);
  const data = parsed.data;
  return {
    slug: ref.slug,
    title: data.title ?? ref.title,
    description: data.description ?? ref.description,
    audience: data.audience ?? String(ref.audience),
    body: parsed.content,
  };
}
