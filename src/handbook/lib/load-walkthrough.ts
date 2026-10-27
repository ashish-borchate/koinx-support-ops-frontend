import { parseFrontmatter } from "./parse-frontmatter";
import { walkthroughBySlug } from "./walkthroughs";

const guideBodies = import.meta.glob<string>("../content/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export type LoadedWalkthrough = {
  meta: NonNullable<ReturnType<typeof walkthroughBySlug>>;
  body: string;
  stepsMarkdown: string;
};

export function loadWalkthrough(slug: string): LoadedWalkthrough | null {
  const meta = walkthroughBySlug(slug);
  if (!meta) return null;
  const raw = guideBodies[`../content/guides/${slug}.md`];
  if (!raw) return null;
  const parsed = parseFrontmatter(raw);
  const stepsMatch = /## Steps\s+([\s\S]*?)(?=## Expected outcome|## Common mistakes|$)/i.exec(parsed.content);
  return {
    meta,
    body: parsed.content,
    stepsMarkdown: stepsMatch?.[1]?.trim() || parsed.content,
  };
}
