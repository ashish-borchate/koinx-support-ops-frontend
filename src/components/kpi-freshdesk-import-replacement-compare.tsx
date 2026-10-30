import { useMemo } from "react";
import { formatKpiFieldDiffValue } from "@/lib/freshdesk-import-format";
import { sortPreviewRows, type ImportPreviewRow } from "@/components/kpi-freshdesk-import-preview-table";

const KPI_COMPARE_FIELDS: Array<{ field: string; header: string; className?: string }> = [
  { field: "firstResponseHours", header: "First response", className: "min-w-[7rem]" },
  { field: "averageResponseHours", header: "Avg. response", className: "min-w-[7rem]" },
  { field: "resolutionHours", header: "Resolution", className: "min-w-[7rem]" },
  { field: "slaPercent", header: "Resolution SLA %", className: "min-w-[5rem]" },
  { field: "csatPositiveCount", header: "CSAT +", className: "min-w-[3.5rem]" },
  { field: "csatNegativeCount", header: "CSAT −", className: "min-w-[3.5rem]" },
  { field: "csatNeutralCount", header: "CSAT neutral", className: "min-w-[4rem]" },
  { field: "reopened", header: "Reopened", className: "min-w-[4rem]" },
];

function CompareCell({ field, diff }: { field: string; diff: ImportPreviewRow["kpiDiff"][number] | undefined }) {
  if (!diff) return <span className="text-muted-foreground">—</span>;
  const after = formatKpiFieldDiffValue(field, diff.incoming);
  if (!diff.changed) {
    return <span className="text-muted-foreground">{after}</span>;
  }
  const before = formatKpiFieldDiffValue(field, diff.existing);
  return (
    <span
      className="inline-flex max-w-[14rem] flex-col gap-0.5 rounded-sm bg-amber-100/90 px-1.5 py-0.5 text-foreground dark:bg-amber-950/80"
      title={`Previous: ${before} → New: ${after}`}
    >
      <span className="text-[10px] leading-tight text-muted-foreground line-through decoration-muted-foreground/60">{before}</span>
      <span className="font-medium leading-tight">{after}</span>
    </span>
  );
}

export function KpiFreshdeskImportReplacementCompare({
  rows,
  selectionDraft,
  mappingDraft,
  previousFilename,
}: {
  rows: ImportPreviewRow[];
  selectionDraft: Set<string>;
  mappingDraft: Record<string, string>;
  previousFilename?: string;
}) {
  const sortedRows = useMemo(
    () => sortPreviewRows(rows, selectionDraft, mappingDraft),
    [rows, selectionDraft, mappingDraft],
  );

  const visibleColumns = useMemo(() => {
    return KPI_COMPARE_FIELDS.filter((col) =>
      sortedRows.some((row) => row.kpiDiff.some((d) => d.field === col.field)),
    );
  }, [sortedRows]);

  if (!visibleColumns.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No mapped Hub KPI field differences detected for matched agents. PDF metrics below still apply on import.
      </p>
    );
  }

  return (
    <div className="max-h-52 overflow-auto rounded-md border border-amber-200/80 dark:border-amber-900/60">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b bg-amber-50/90 backdrop-blur-sm dark:bg-amber-950/40">
          <tr>
            <th className="min-w-[8rem] px-2 py-1.5 font-medium">Agent</th>
            {visibleColumns.map((col) => (
              <th key={col.field} className={`whitespace-nowrap px-2 py-1.5 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const selected = selectionDraft.has(row.normalizedName);
            return (
              <tr
                key={row.normalizedName}
                className={`border-b border-border/50 ${selected ? "" : "text-muted-foreground"}`}
              >
                <td className="px-2 py-1.5 font-medium">{row.sourceName}</td>
                {visibleColumns.map((col) => {
                  const diff = row.kpiDiff.find((d) => d.field === col.field);
                  return (
                    <td key={col.field} className="px-2 py-1.5 align-top tabular-nums">
                      <CompareCell field={col.field} diff={diff} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {previousFilename ? (
        <p className="border-t bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
          Compared against current Hub KPI records for this period (previous import: {previousFilename}).
        </p>
      ) : null}
    </div>
  );
}
