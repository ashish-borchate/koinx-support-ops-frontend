import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatFreshdeskCount,
  formatFreshdeskPercent,
  formatFreshdeskTimeSeconds,
  type FreshdeskAgentMetricsPayload,
} from "@/lib/freshdesk-import-format";

type HubAgent = { id: string; name: string };

export type ImportPreviewRow = {
  sourceName: string;
  normalizedName: string;
  status: string;
  selectedForImport: boolean;
  metrics: FreshdeskAgentMetricsPayload;
  match: {
    status: string;
    agentId: string | null;
    candidates: Array<{ agentId: string; name: string; score: number }>;
  };
  kpiDiff: Array<{ field: string; label: string; existing: number | null; incoming: number | null; changed: boolean }>;
};

type MetricColumn = {
  id: string;
  header: string;
  className?: string;
  cell: (metrics: FreshdeskAgentMetricsPayload) => string;
};

const ACTIVITY_COLUMNS: MetricColumn[] = [
  { id: "assigned", header: "Tickets assigned", cell: (m) => formatFreshdeskCount(m.activity.ticketsAssigned) },
  { id: "resolved", header: "Tickets resolved", cell: (m) => formatFreshdeskCount(m.activity.ticketsResolved) },
  { id: "reopened", header: "Tickets reopened", cell: (m) => formatFreshdeskCount(m.activity.ticketsReopened) },
  {
    id: "reassigned",
    header: "Tickets reassigned",
    cell: (m) => formatFreshdeskCount(m.activity.ticketsReassignedFromAgent),
  },
  { id: "notes", header: "Private notes", cell: (m) => formatFreshdeskCount(m.activity.privateNotes) },
  { id: "responses", header: "Responses", cell: (m) => formatFreshdeskCount(m.activity.responses) },
];

const TIME_COLUMNS: MetricColumn[] = [
  {
    id: "frt",
    header: "Avg. first response (business hrs)",
    className: "min-w-[9rem]",
    cell: (m) => formatFreshdeskTimeSeconds(m.time.firstResponseSeconds),
  },
  {
    id: "art",
    header: "Avg. response (business hrs)",
    className: "min-w-[8rem]",
    cell: (m) => formatFreshdeskTimeSeconds(m.time.averageResponseSeconds),
  },
  {
    id: "resolution",
    header: "Avg. resolution (business hrs)",
    className: "min-w-[8rem]",
    cell: (m) => formatFreshdeskTimeSeconds(m.time.resolutionSeconds),
  },
];

const SLA_COLUMNS: MetricColumn[] = [
  { id: "res-sla", header: "Resolution SLA %", cell: (m) => formatFreshdeskPercent(m.sla.resolutionSlaPercent) },
  {
    id: "frt-sla",
    header: "First response SLA %",
    cell: (m) => formatFreshdeskPercent(m.sla.firstResponseSlaPercent),
  },
  {
    id: "fcr",
    header: "First contact resolution (FCR) %",
    cell: (m) => formatFreshdeskPercent(m.sla.fcrPercent),
  },
];

const CSAT_COLUMNS: MetricColumn[] = [
  { id: "pos", header: "Positive", cell: (m) => formatFreshdeskCount(m.csat.positive) },
  { id: "neg", header: "Negative", cell: (m) => formatFreshdeskCount(m.csat.negative) },
  { id: "neu", header: "Neutral", cell: (m) => formatFreshdeskCount(m.csat.neutral) },
  { id: "total", header: "Total", cell: (m) => formatFreshdeskCount(m.csat.total) },
];

function isRowMatched(row: ImportPreviewRow, mappingDraft: Record<string, string>): boolean {
  if (row.match.status === "exact" && row.match.agentId) return true;
  return Boolean(mappingDraft[row.normalizedName]);
}

export function rowNeedsManualMatching(
  row: ImportPreviewRow,
  selectionDraft: Set<string>,
  mappingDraft: Record<string, string>,
): boolean {
  if (!selectionDraft.has(row.normalizedName)) return false;
  return !isRowMatched(row, mappingDraft);
}

/** Selected matched → unselected → selected needs manual matching. */
export function sortPreviewRows(
  rows: ImportPreviewRow[],
  selectionDraft: Set<string>,
  mappingDraft: Record<string, string>,
): ImportPreviewRow[] {
  const tier = (row: ImportPreviewRow) => {
    const selected = selectionDraft.has(row.normalizedName);
    if (!selected) return 1;
    if (rowNeedsManualMatching(row, selectionDraft, mappingDraft)) return 2;
    return 0;
  };
  return [...rows].sort((a, b) => {
    const byTier = tier(a) - tier(b);
    if (byTier !== 0) return byTier;
    return a.sourceName.localeCompare(b.sourceName, undefined, { sensitivity: "base" });
  });
}

function AgentCell({
  row,
  selectionDraft,
  agents,
  mappingDraft,
  onToggleSelection,
  onMappingChange,
}: {
  row: ImportPreviewRow;
  selectionDraft: Set<string>;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onToggleSelection: (normalizedName: string, checked: boolean) => void;
  onMappingChange: (normalizedName: string, agentId: string) => void;
}) {
  const included = selectionDraft.has(row.normalizedName);
  const needsMatch = rowNeedsManualMatching(row, selectionDraft, mappingDraft);

  return (
    <div className="flex min-w-[10rem] items-start gap-2">
      <input
        type="checkbox"
        className="mt-0.5 size-3.5 shrink-0"
        checked={included}
        aria-label={`Include ${row.sourceName} in import`}
        onChange={(e) => onToggleSelection(row.normalizedName, e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-snug">{row.sourceName}</div>
        {needsMatch ? (
          <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Needs matching</span>
            <Select
              value={mappingDraft[row.normalizedName] || ""}
              onValueChange={(value) => onMappingChange(row.normalizedName, value)}
            >
              <SelectTrigger className="h-7 max-w-[14rem] text-xs">
                <SelectValue placeholder="Select Hub user" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionTable({
  rows,
  columns,
  readOnly = false,
  selectionDraft,
  agents,
  mappingDraft,
  onToggleSelection,
  onMappingChange,
}: {
  rows: ImportPreviewRow[];
  columns: MetricColumn[];
  readOnly?: boolean;
  selectionDraft: Set<string>;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onToggleSelection: (normalizedName: string, checked: boolean) => void;
  onMappingChange: (normalizedName: string, agentId: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b bg-muted/50 backdrop-blur-sm">
          <tr>
            <th className="min-w-[11rem] px-2 py-1.5 font-medium">Agent</th>
            {columns.map((col) => (
              <th key={col.id} className={`whitespace-nowrap px-2 py-1.5 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const included = selectionDraft.has(row.normalizedName);
            return (
              <tr
                key={row.normalizedName}
                className={`border-b border-border/60 ${readOnly || included ? "" : "text-muted-foreground"}`}
              >
                <td className="px-2 py-1.5 align-top">
                  {readOnly ? (
                    <span className="font-medium">{row.sourceName}</span>
                  ) : (
                    <AgentCell
                      row={row}
                      selectionDraft={selectionDraft}
                      agents={agents}
                      mappingDraft={mappingDraft}
                      onToggleSelection={onToggleSelection}
                      onMappingChange={onMappingChange}
                    />
                  )}
                </td>
                {columns.map((col) => (
                  <td key={col.id} className={`whitespace-nowrap px-2 py-1.5 tabular-nums align-middle ${col.className ?? ""}`}>
                    {col.cell(row.metrics)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function KpiFreshdeskImportPreviewTable({
  rows,
  selectionDraft,
  agents,
  mappingDraft,
  onToggleSelection,
  onMappingChange,
  onSelectAll,
  onDeselectAll,
  selectedCount,
  totalAgents,
  readOnly = false,
}: {
  rows: ImportPreviewRow[];
  selectionDraft: Set<string>;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onToggleSelection: (normalizedName: string, checked: boolean) => void;
  onMappingChange: (normalizedName: string, agentId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  selectedCount?: number;
  totalAgents?: number;
  readOnly?: boolean;
}) {
  const sortedRows = useMemo(() => {
    if (readOnly) return rows;
    return sortPreviewRows(rows, selectionDraft, mappingDraft);
  }, [readOnly, rows, selectionDraft, mappingDraft]);

  const tableProps = {
    rows: sortedRows,
    readOnly,
    selectionDraft: readOnly ? new Set<string>() : selectionDraft,
    agents,
    mappingDraft,
    onToggleSelection,
    onMappingChange,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {selectedCount} of {totalAgents} Agents selected
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSelectAll}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onDeselectAll}>
              Deselect all
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col gap-2">
        <TabsList className="h-8 w-fit shrink-0 flex-wrap gap-0.5">
          <TabsTrigger value="activity" className="h-7 px-2.5 text-xs">
            Activity
          </TabsTrigger>
          <TabsTrigger value="time" className="h-7 px-2.5 text-xs">
            Time
          </TabsTrigger>
          <TabsTrigger value="sla" className="h-7 px-2.5 text-xs">
            SLA Performance
          </TabsTrigger>
          <TabsTrigger value="csat" className="h-7 px-2.5 text-xs">
            CSAT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SectionTable {...tableProps} columns={ACTIVITY_COLUMNS} />
        </TabsContent>
        <TabsContent value="time" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SectionTable {...tableProps} columns={TIME_COLUMNS} />
        </TabsContent>
        <TabsContent value="sla" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SectionTable {...tableProps} columns={SLA_COLUMNS} />
        </TabsContent>
        <TabsContent value="csat" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SectionTable {...tableProps} columns={CSAT_COLUMNS} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
