import { slugifyHeading } from "./toc";

/** Assign stable heading IDs matching `extractTocFromMarkdown`. */
export function buildHeadingIdAssigner(body: string) {
  const seen = new Set<string>();
  const order: { level: number; text: string; id: string }[] = [];
  for (const line of body.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/\s+#*$/, "").trim();
    let id = slugifyHeading(text);
    if (!id) continue;
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    order.push({ level, text, id });
  }
  let index = 0;
  return (level: 2 | 3, text: string) => {
    while (index < order.length) {
      const row = order[index];
      index += 1;
      if (row.level === level && row.text === text) return row.id;
    }
    return slugifyHeading(text);
  };
}
