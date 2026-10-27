import { HandbookProse } from "@/handbook/components/HandbookProse";
import { HandbookResponsibilityMatrix } from "@/handbook/components/handbook-ui";

/** Renders responsibility tables from workflow markdown as a compact matrix when possible. */
export function WorkflowHandoffMap({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  const rows: { stage: string; owner: string }[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|") || line.includes("---") || line.toLowerCase().includes("stage")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) rows.push({ stage: cells[0], owner: cells[1] });
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <HandbookProse markdown={markdown} />
      </div>
    );
  }

  return (
    <HandbookResponsibilityMatrix rows={rows.map((row) => ({ work: row.stage, role: row.owner }))} />
  );
}
