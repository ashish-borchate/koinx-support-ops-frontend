export type TocEntry = { id: string; text: string; level: 2 | 3 };

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Extract `##` and `###` headings from markdown body (after frontmatter). */
export function extractTocFromMarkdown(body: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Set<string>();
  for (const line of body.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/\s+#*$/, "").trim();
    let id = slugifyHeading(text);
    if (!id) continue;
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    entries.push({ id, text, level });
  }
  return entries;
}
