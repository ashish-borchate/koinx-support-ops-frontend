import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTableShell, Empty } from "@/components/bits";
import { formatCalendarDate, formatNumber, formatWhen } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isExportJobActive, type SaExportJob } from "@/components/support-analytics/export-job-list";

const STAGE_LABELS: Record<string, string> = {
  request_submitted: "Submitted",
  freshdesk_queued: "Queued at Freshdesk",
  freshdesk_processing: "Processing at Freshdesk",
  freshdesk_completed: "Ready to download",
  downloading_artifact: "Downloading",
  extracting_artifact: "Extracting",
  parsing_records: "Parsing",
  importing_records: "Importing",
  completed: "Completed",
  duplicate: "Completed (duplicate file)",
  failed: "Failed",
  unauthorized: "Unauthorized",
  timed_out: "Timed out",
};

function statusLabel(job: SaExportJob): string {
  const stage = job.lifecycle?.processingStage || job.hubStatus;
  return STAGE_LABELS[stage] || stage;
}

function ticketsImported(job: SaExportJob): string {
  const n = job.lifecycle?.importStats?.ticketsUpserted;
  if (n == null) return "—";
  return formatNumber(n);
}

function rowTone(job: SaExportJob): string {
  if (isExportJobActive(job)) return "bg-amber-500/10";
  if (job.retryable || job.hubStatus === "failed" || job.lifecycle?.processingStage === "failed") {
    return "bg-destructive/5";
  }
  return "";
}

export function ImportRequestsTable({
  jobs,
  activeJob,
  canManage,
  onRetryFailed,
  showEmpty,
}: {
  jobs: SaExportJob[];
  activeJob: SaExportJob | null;
  canManage: boolean;
  onRetryFailed: (id: string) => void;
  /** When true, show an empty state instead of rendering nothing */
  showEmpty?: boolean;
}) {
  const [detail, setDetail] = useState<SaExportJob | null>(null);
  if (!jobs.length) {
    if (showEmpty) {
      return <Empty title="No import requests yet" body="Freshdesk exports you request will appear here." />;
    }
    return null;
  }

  return (
    <>
      {activeJob ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Import in progress for {formatCalendarDate(activeJob.exportFrom)} –{" "}
          {formatCalendarDate(activeJob.exportTo)}. New exports are disabled until it finishes.
        </p>
      ) : null}
      <DataTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-2 py-2">Requested by</th>
              <th className="px-2 py-2">From</th>
              <th className="px-2 py-2">To</th>
              <th className="px-2 py-2">Requested at</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Completed</th>
              <th className="px-2 py-2 text-right">Imported</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className={`border-b border-border/60 ${rowTone(job)}`}>
                <td className="px-2 py-2">{job.requestedByLabel || job.requestedByName || "—"}</td>
                <td className="px-2 py-2">{formatCalendarDate(job.exportFrom)}</td>
                <td className="px-2 py-2">{formatCalendarDate(job.exportTo)}</td>
                <td className="px-2 py-2 text-xs">{job.createdAt ? formatWhen(job.createdAt) : "—"}</td>
                <td className="px-2 py-2">{statusLabel(job)}</td>
                <td className="px-2 py-2 text-xs">
                  {job.finishedAt || job.lifecycle?.finishedAt
                    ? formatWhen(String(job.finishedAt || job.lifecycle?.finishedAt))
                    : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{ticketsImported(job)}</td>
                <td className="px-2 py-2 text-right">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetail(job)}>
                    Details
                  </Button>
                  {canManage && job.retryable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-1 h-7 text-xs"
                      onClick={() => onRetryFailed(job.id)}
                    >
                      Retry
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import request details</DialogTitle>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-2 text-sm">
              <Row label="Freshdesk job ID" value={detail.freshdeskJobId} />
              <Row label="Freshdesk status" value={`${detail.freshdeskStatus}${detail.freshdeskProgress ? ` (${detail.freshdeskProgress}%)` : ""}`} />
              <Row label="Support Hub stage" value={statusLabel(detail)} />
              <Row label="Started" value={detail.createdAt ? formatWhen(detail.createdAt) : "—"} />
              <Row
                label="Last update"
                value={
                  detail.lifecycle?.lastPolledAt ? formatWhen(String(detail.lifecycle.lastPolledAt)) : "—"
                }
              />
              <Row
                label="Completed"
                value={
                  detail.finishedAt || detail.lifecycle?.finishedAt
                    ? formatWhen(String(detail.finishedAt || detail.lifecycle?.finishedAt))
                    : "—"
                }
              />
              <Row
                label="Parsed records"
                value={formatNumber(detail.lifecycle?.importStats?.recordCount ?? 0)}
              />
              <Row
                label="Upserted tickets"
                value={formatNumber(detail.lifecycle?.importStats?.ticketsUpserted ?? 0)}
              />
              <Row
                label="Validation issues"
                value={formatNumber(detail.lifecycle?.importStats?.validationErrorCount ?? 0)}
              />
              {detail.lifecycle?.importStats?.duplicate ? (
                <Row label="Duplicate file" value="Yes (checksum matched prior import)" />
              ) : null}
              {detail.errorMessage ? (
                <Row label="Error" value={detail.errorMessage} className="text-destructive" />
              ) : null}
              {isExportJobActive(detail) ? (
                <p className="text-xs text-muted-foreground">This request is still processing.</p>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}
