import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatFreshdeskCount,
  formatFreshdeskPercent,
  formatFreshdeskTimeSeconds,
  formatKpiFieldDiffValue,
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

function HubMappingCell({
  row,
  included,
  agents,
  mappingDraft,
  onMappingChange,
}: {
  row: ImportPreviewRow;
  included: boolean;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onMappingChange: (normalizedName: string, agentId: string) => void;
}) {
  if (!included) return <span className="text-muted-foreground">—</span>;
  if (row.match.status === "exact" && row.match.agentId) {
    return (
      <span className="truncate" title={agents.find((a) => a.id === row.match.agentId)?.name || row.match.agentId}>
        {agents.find((a) => a.id === row.match.agentId)?.name || row.match.agentId}
      </span>
    );
  }
  return (
    <Select
      value={mappingDraft[row.normalizedName] || ""}
      onValueChange={(value) => onMappingChange(row.normalizedName, value)}
    >
      <SelectTrigger className="h-7 w-full min-w-[8.5rem] text-xs">
        <SelectValue placeholder="Map to Hub" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SectionTable({
  rows,
  columns,
  selectionDraft,
  agents,
  mappingDraft,
  onToggleSelection,
  onMappingChange,
}: {
  rows: ImportPreviewRow[];
  columns: MetricColumn[];
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
            <th className="w-9 px-2 py-1.5" aria-label="Include in import" />
            <th className="min-w-[7.5rem] px-2 py-1.5 font-medium">Agent</th>
            <th className="min-w-[9rem] px-2 py-1.5 font-medium">Hub agent</th>
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
                className={`border-b border-border/60 ${included ? "" : "bg-muted/15 text-muted-foreground"}`}
              >
                <td className="px-2 py-1.5 align-middle">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={included}
                    aria-label={`Include ${row.sourceName} in import`}
                    onChange={(e) => onToggleSelection(row.normalizedName, e.target.checked)}
                  />
                </td>
                <td className="px-2 py-1.5 align-middle font-medium">
                  <div className="flex flex-wrap items-center gap-1">
                    <span>{row.sourceName}</span>
                    {!included ? (
                      <span className="rounded bg-muted px-1 py-0 text-[10px] font-normal uppercase">Excluded</span>
                    ) : null}
                  </div>
                </td>
                <td className="max-w-[11rem] px-2 py-1.5 align-middle">
                  <HubMappingCell
                    row={row}
                    included={included}
                    agents={agents}
                    mappingDraft={mappingDraft}
                    onMappingChange={onMappingChange}
                  />
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

function ChangesTable({
  rows,
  selectionDraft,
  agents,
  mappingDraft,
  onToggleSelection,
  onMappingChange,
}: {
  rows: ImportPreviewRow[];
  selectionDraft: Set<string>;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onToggleSelection: (normalizedName: string, checked: boolean) => void;
  onMappingChange: (normalizedName: string, agentId: string) => void;
}) {
  const rowsWithChanges = rows
    .map((row) => ({
      row,
      changes: row.kpiDiff.filter((d) => d.changed),
    }))
    .filter(({ changes }) => changes.length > 0);

  if (!rowsWithChanges.length) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No KPI field differences detected for this PDF versus current Hub records.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b bg-muted/50 backdrop-blur-sm">
          <tr>
            <th className="w-9 px-2 py-1.5" aria-label="Include in import" />
            <th className="min-w-[7.5rem] px-2 py-1.5">Agent</th>
            <th className="min-w-[9rem] px-2 py-1.5">Hub agent</th>
            <th className="min-w-[10rem] px-2 py-1.5">KPI field</th>
            <th className="px-2 py-1.5">Before</th>
            <th className="w-8 px-1 py-1.5 text-center">→</th>
            <th className="px-2 py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {rowsWithChanges.map(({ row, changes }) => {
            const included = selectionDraft.has(row.normalizedName);
            return changes.map((diff, index) => (
              <tr key={`${row.normalizedName}-${diff.field}`} className="border-b border-border/60">
                {index === 0 ? (
                  <>
                    <td className="px-2 py-1.5 align-top" rowSpan={changes.length}>
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={included}
                        aria-label={`Include ${row.sourceName} in import`}
                        onChange={(e) => onToggleSelection(row.normalizedName, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top font-medium" rowSpan={changes.length}>
                      {row.sourceName}
                    </td>
                    <td className="max-w-[11rem] px-2 py-1.5 align-top" rowSpan={changes.length}>
                      <HubMappingCell
                        row={row}
                        included={included}
                        agents={agents}
                        mappingDraft={mappingDraft}
                        onMappingChange={onMappingChange}
                      />
                    </td>
                  </>
                ) : null}
                <td className="px-2 py-1.5 align-middle">{diff.label}</td>
                <td className="px-2 py-1.5 tabular-nums align-middle">{formatKpiFieldDiffValue(diff.field, diff.existing)}</td>
                <td className="px-1 py-1.5 text-center align-middle text-muted-foreground">→</td>
                <td className="px-2 py-1.5 tabular-nums align-middle">{formatKpiFieldDiffValue(diff.field, diff.incoming)}</td>
              </tr>
            ));
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
}: {
  rows: ImportPreviewRow[];
  selectionDraft: Set<string>;
  agents: HubAgent[];
  mappingDraft: Record<string, string>;
  onToggleSelection: (normalizedName: string, checked: boolean) => void;
  onMappingChange: (normalizedName: string, agentId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedCount: number;
  totalAgents: number;
}) {
  const tableProps = {
    rows,
    selectionDraft,
    agents,
    mappingDraft,
    onToggleSelection,
    onMappingChange,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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
          <TabsTrigger value="changes" className="h-7 px-2.5 text-xs">
            Changes
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
        <TabsContent value="changes" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <p className="mb-2 shrink-0 text-xs text-muted-foreground">
            Hub KPI fields that will change when you apply (selected agents only). PDF-only metrics stay in the import record.
          </p>
          <ChangesTable {...tableProps} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
