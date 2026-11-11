import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { ImportRequestsTable } from "@/components/support-analytics/import-requests-table";
import { type SaExportJob } from "@/components/support-analytics/export-job-list";

type FreshdeskRange = {
  start_date: string;
  end_date: string;
  selectedFrom: string;
  selectedTo: string;
  endCappedToNow: boolean;
};

export function ManageHistoricalDataSheet({
  open,
  onOpenChange,
  canImport,
  importFrom,
  importTo,
  setImportFrom,
  setImportTo,
  onUploadFile,
  uploadPending,
  onRequestExport,
  exportPending,
  exportBlocked,
  lastFreshdeskRange,
  exports,
  activeExportJob,
  onRetryFailed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canImport: boolean;
  importFrom: string;
  importTo: string;
  setImportFrom: (v: string) => void;
  setImportTo: (v: string) => void;
  onUploadFile: (file: File) => void;
  uploadPending: boolean;
  onRequestExport: () => Promise<void>;
  exportPending: boolean;
  exportBlocked: boolean;
  lastFreshdeskRange: FreshdeskRange | null;
  exports: SaExportJob[];
  activeExportJob: SaExportJob | null;
  onRetryFailed: (id: string) => void;
}) {
  const [confirmExport, setConfirmExport] = useState(false);

  async function confirmAndExport() {
    setConfirmExport(false);
    await onRequestExport();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Manage Historical Data</SheetTitle>
            <SheetDescription>
              Upload files or request Freshdesk exports. This does not change the reporting period on the main
              dashboard.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-6">
            <section className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
              <h3 className="text-sm font-semibold">1. Upload Historical JSON</h3>
              <p className="text-xs text-muted-foreground">
                Use for initial backfill or recovery when a scheduled export failed. Identical files are detected by
                checksum and skipped as duplicates.
              </p>
              {canImport ? (
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" disabled={uploadPending} asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadPending ? "Uploading…" : "Choose JSON file"}
                    </span>
                  </Button>
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">You do not have permission to upload imports.</p>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
              <h3 className="text-sm font-semibold">2. Request Freshdesk Export</h3>
              <p className="text-xs text-muted-foreground">
                Creates a Freshdesk Account Export for tickets <strong>created</strong> on the selected IST dates, then
                downloads and imports it automatically. Daily imports at 06:00 IST use yesterday only — use this for
                manual catch-up.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <DateField label="From (IST)" value={importFrom} onChange={setImportFrom} />
                <DateField label="To (IST)" value={importTo} onChange={setImportTo} />
              </div>
              {canImport ? (
                <Button
                  size="sm"
                  disabled={exportPending || exportBlocked || !importFrom || !importTo}
                  onClick={() => setConfirmExport(true)}
                >
                  {exportPending ? "Starting…" : "Request Freshdesk Export"}
                </Button>
              ) : null}
              {exportBlocked && activeExportJob ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  An import is already running for {formatCalendarDate(activeExportJob.exportFrom)} –{" "}
                  {formatCalendarDate(activeExportJob.exportTo)}. Wait for it to finish before starting another.
                </p>
              ) : null}
              {lastFreshdeskRange ? (
                <p className="text-[11px] text-muted-foreground">
                  Last request sent to Freshdesk: {formatWhen(lastFreshdeskRange.start_date)} →{" "}
                  {formatWhen(lastFreshdeskRange.end_date)}
                  {lastFreshdeskRange.endCappedToNow ? " (end capped for API rules)" : ""}
                </p>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">3. Import Requests History</h3>
              <p className="text-xs text-muted-foreground">
                Freshdesk export jobs and their import status. Failed jobs can be retried when available.
              </p>
              <ImportRequestsTable
                jobs={exports}
                activeJob={activeExportJob}
                canManage={canImport}
                onRetryFailed={onRetryFailed}
                showEmpty
              />
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmExport} onOpenChange={setConfirmExport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Freshdesk Account Export?</DialogTitle>
            <DialogDescription>
              Freshdesk will generate an export for tickets created from{" "}
              <strong>{importFrom ? formatCalendarDate(importFrom) : "—"}</strong> through{" "}
              <strong>{importTo ? formatCalendarDate(importTo) : "—"}</strong> (IST). When ready, Support Hub will
              download the file and import it. This can take several minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmExport(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmAndExport()} disabled={exportPending}>
              {exportPending ? "Starting…" : "Confirm export request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="date" className="mt-0.5 h-9 w-40" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
