import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatWhen } from "@/lib/format";
import { api } from "@/lib/api";

export type ExportJobLifecycle = {
  processingStage: string;
  processingStageLabel: string;
  freshdesk: {
    status: string;
    progressPercent: number | null;
    completed: boolean;
    note: string;
  };
  overall: {
    complete: boolean;
    indeterminate: boolean;
    misleadingPercentWarning: string;
  };
  importStats: {
    recordCount?: number;
    ticketsUpserted?: number;
    validationErrorCount?: number;
    duplicate?: boolean;
  } | null;
  freshdeskCompletedAt?: string | null;
  lastPolledAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
};

export type SaExportJob = {
  id: string;
  freshdeskJobId: string;
  exportFrom: string;
  exportTo: string;
  apiStartAt?: string | null;
  apiEndAt?: string | null;
  endCappedToNow?: boolean;
  hubStatus: string;
  freshdeskStatus: string;
  freshdeskProgress: number;
  errorMessage?: string;
  saJsonImportId?: string | null;
  requestedByName?: string;
  requestedByLabel?: string;
  createdAt?: string;
  finishedAt?: string | null;
  lifecycle?: ExportJobLifecycle;
  retryable?: boolean;
};

export function isExportJobActive(job: SaExportJob): boolean {
  if (job.lifecycle) {
    return job.lifecycle.overall.indeterminate && !job.lifecycle.overall.complete;
  }
  return ["submitted", "freshdesk_running", "freshdesk_completed", "downloading", "importing", "extracting", "parsing"].includes(
    job.hubStatus,
  );
}

export function ExportJobList({
  jobs,
  canManage,
  onRetryFailed,
}: {
  jobs: SaExportJob[];
  canManage: boolean;
  onRetryFailed: (id: string) => void;
}) {
  if (!jobs.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card text-sm">
      <p className="border-b border-border px-3 py-2 font-medium text-foreground">Account export jobs</p>
      <ul className="divide-y divide-border">
        {jobs.map((job) => (
          <li key={job.id} className="space-y-2 px-3 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {job.exportFrom} – {job.exportTo} (IST)
              </span>
              <span className="text-xs text-muted-foreground">FD job {job.freshdeskJobId}</span>
            </div>
            <StageRow job={job} />
            <FreshdeskRow job={job} />
            <MetaRow job={job} />
            {job.errorMessage ? <p className="text-xs text-destructive">{job.errorMessage}</p> : null}
            {job.lifecycle?.importStats ? <ImportStatsRow stats={job.lifecycle.importStats} importId={job.saJsonImportId} /> : null}
            {canManage && job.retryable ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRetryFailed(job.id)}>
                Retry failed export
              </Button>
            ) : null}
            {isExportJobActive(job) ? (
              <p className="text-[11px] text-muted-foreground">Advancing automatically…</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageRow({ job }: { job: SaExportJob }) {
  const lifecycle = job.lifecycle;
  const label = lifecycle?.processingStageLabel || job.hubStatus;
  const active = isExportJobActive(job);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Support Hub stage:</span>
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        {active ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : null}
        {label}
      </span>
    </div>
  );
}

function FreshdeskRow({ job }: { job: SaExportJob }) {
  const fd = job.lifecycle?.freshdesk;
  const progress = fd?.progressPercent ?? (job.freshdeskProgress ? job.freshdeskProgress : null);
  return (
    <div className="text-xs text-muted-foreground">
      Freshdesk: <strong className="text-foreground">{job.freshdeskStatus || "—"}</strong>
      {progress != null ? ` · ${progress}%` : ""}
      {fd?.completed ? " · export complete" : ""}
      {fd?.note ? <span className="block">{fd.note}</span> : null}
    </div>
  );
}

function MetaRow({ job }: { job: SaExportJob }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {job.createdAt ? <span>Started {formatWhen(job.createdAt)}</span> : null}
      {job.lifecycle?.lastPolledAt ? <span>Last update {formatWhen(String(job.lifecycle.lastPolledAt))}</span> : null}
      {job.lifecycle?.freshdeskCompletedAt ? (
        <span>FD completed {formatWhen(String(job.lifecycle.freshdeskCompletedAt))}</span>
      ) : null}
      {job.finishedAt || job.lifecycle?.finishedAt ? (
        <span>Finished {formatWhen(String(job.finishedAt || job.lifecycle?.finishedAt))}</span>
      ) : null}
      {job.requestedByName ? <span>By {job.requestedByName}</span> : null}
    </div>
  );
}

function ImportStatsRow({
  stats,
  importId,
}: {
  stats: NonNullable<ExportJobLifecycle["importStats"]>;
  importId?: string | null;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Import: {formatNumber(stats.ticketsUpserted ?? 0)} upserted
      {stats.recordCount != null ? ` · ${formatNumber(stats.recordCount)} parsed` : ""}
      {stats.validationErrorCount ? ` · ${formatNumber(stats.validationErrorCount)} validation issues` : ""}
      {stats.duplicate ? " · duplicate checksum" : ""}
      {importId ? ` · ${importId}` : ""}
    </p>
  );
}

export async function advanceExportJob(id: string) {
  return api(`/api/support-analytics/exports/${id}/advance`, { method: "POST" });
}

export async function retryFailedExportJob(id: string) {
  return api<SaExportJob>(`/api/support-analytics/exports/${id}/retry`, { method: "POST" });
}
