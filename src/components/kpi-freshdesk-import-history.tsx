import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  KpiFreshdeskImportPreviewTable,
  type ImportPreviewRow,
} from "@/components/kpi-freshdesk-import-preview-table";
import { api, download } from "@/lib/api";
import {
  formatImportAppliedAt,
  formatImportHistoryStatus,
  formatImportReportTitle,
  formatImportReportingPeriod,
  type ImportHistoryEntry,
} from "@/lib/freshdesk-import-history";

function noop() {}

export function KpiFreshdeskImportHistoryViewDialog({
  importId,
  open,
  onOpenChange,
}: {
  importId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["kpi-import-detail", importId],
    queryFn: () =>
      api<{
        import: ImportHistoryEntry & { status: string };
        preview: { rows: ImportPreviewRow[]; warnings: string[] };
      }>(`/api/kpi/import/${importId}`),
    enabled: open && Boolean(importId),
  });

  const entry = detailQuery.data?.import;
  const preview = detailQuery.data?.preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(96vw,72rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle className="text-left">{entry ? formatImportReportTitle(entry) : "Imported report"}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
          {detailQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading report…</p> : null}
          {detailQuery.isError ? (
            <p className="text-sm text-destructive">Could not load this import. It may have been removed.</p>
          ) : null}

          {entry && preview ? (
            <>
              <div className="shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">Period:</span> {formatImportReportingPeriod(entry)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Generated:</span> {entry.reportGeneratedAt}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Status:</span> {formatImportHistoryStatus(entry.historyStatus)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Imported:</span> {formatImportAppliedAt(entry.appliedAt)}
                  </span>
                  {entry.appliedByName ? (
                    <span>
                      <span className="text-muted-foreground">By:</span> {entry.appliedByName}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-muted-foreground">
                  Original filename:{" "}
                  <span className="font-medium text-foreground">{entry.originalFilename}</span>
                </p>
                {entry.wasReplaced ? (
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    A newer import replaced this report for the same reporting period.
                  </p>
                ) : null}
              </div>

              <KpiFreshdeskImportPreviewTable
                readOnly
                rows={preview.rows}
                selectionDraft={new Set()}
                agents={[]}
                mappingDraft={{}}
                onToggleSelection={noop}
                onMappingChange={noop}
              />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KpiFreshdeskImportHistoryList({
  imports,
  isLoading,
  onView,
}: {
  imports: ImportHistoryEntry[];
  isLoading: boolean;
  onView: (importId: string) => void;
}) {
  async function handleDownload(entry: ImportHistoryEntry) {
    try {
      await download(`/api/kpi/import/${entry.id}/file`, entry.originalFilename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download PDF.");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading import history…</p>;
  if (!imports.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No imported reports yet. History lists only PDFs whose KPI data was applied to the Hub.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {imports.map((item) => (
        <li key={item.id} className="rounded-lg border p-3 text-sm shadow-sm">
          <div className="font-medium">{formatImportReportTitle(item)}</div>
          <div className="mt-0.5 text-muted-foreground">
            {formatImportReportingPeriod(item)} · {formatImportHistoryStatus(item.historyStatus)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Original filename:{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => onView(item.id)}
            >
              {item.originalFilename}
            </button>
          </p>
          <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="text-foreground/80">Agents selected:</span> {item.selectedAgentCount}
            </div>
            <div>
              <span className="text-foreground/80">Imported successfully:</span> {item.importedAgentCount}
            </div>
            <div>
              <span className="text-foreground/80">Import date:</span> {formatImportAppliedAt(item.appliedAt)}
            </div>
            <div>
              <span className="text-foreground/80">Imported by:</span> {item.appliedByName || "—"}
            </div>
          </dl>
          {item.wasReplaced ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Superseded by a newer import for this period.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onView(item.id)}>
              View report
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => void handleDownload(item)}>
              Download PDF
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
