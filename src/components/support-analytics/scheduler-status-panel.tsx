import type { ReactNode } from "react";
import { buildSchedulerAttention } from "@/lib/support-analytics-scheduler-diagnostics";
import { cn } from "@/lib/utils";

type FreshnessDisplay = {
  lastSuccessfulSyncLabelIst?: string | null;
  lastSuccessfulSyncTrigger?: string | null;
  lastSyncType?: string | null;
  nextScheduledLabelIst?: string | null;
  latestScheduledLabelIst?: string | null;
  latestScheduledFinishedLabelIst?: string | null;
  latestScheduledStatus?: string | null;
  schedulerFreshnessWarning?: string | null;
  schedulerSecretConfiguredOnServer?: boolean;
};

function syncTriggerLabel(trigger?: string | null) {
  switch (trigger) {
    case "scheduled":
      return "Automatic";
    case "manual":
      return "Manual";
    case "external":
      return "External";
    default:
      return "—";
  }
}

function scheduledAttemptLabel(status?: string | null) {
  switch (status) {
    case "success":
      return "Succeeded";
    case "partial":
      return "Partial";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "running":
      return "Running";
    default:
      return status || "Not recorded";
  }
}

/** Expandable sync history (header toggle); no status strip on the main Live view. */
export function SupportAnalyticsSchedulerStatusPanel({
  display,
  inOperationalWindow,
  ticketsStored,
  detailsOpen = false,
}: {
  display?: FreshnessDisplay | null;
  inOperationalWindow?: boolean;
  ticketsStored?: number;
  detailsOpen?: boolean;
  hideDetailsToggle?: boolean;
}) {
  if (!display || !detailsOpen) return null;

  const inWindow = Boolean(inOperationalWindow);
  buildSchedulerAttention({
    secretConfigured: display.schedulerSecretConfiguredOnServer !== false,
    inOperationalWindow: inWindow,
    lastScheduledRecorded: Boolean(display.latestScheduledLabelIst),
    lastScheduledStatus: display.latestScheduledStatus,
    freshnessWarning: display.schedulerFreshnessWarning,
  });

  const lastSyncTrigger = syncTriggerLabel(
    display.lastSuccessfulSyncTrigger ?? display.lastSyncType,
  );
  const lastAuto =
    display.latestScheduledLabelIst != null
      ? `${display.latestScheduledLabelIst} · ${scheduledAttemptLabel(display.latestScheduledStatus)}`
      : "Not recorded";

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <SyncDetailRow label="Last successful sync">
          {display.lastSuccessfulSyncLabelIst || "—"}
          {lastSyncTrigger !== "—" ? (
            <span className="font-normal text-muted-foreground"> ({lastSyncTrigger})</span>
          ) : null}
        </SyncDetailRow>
        <SyncDetailRow label="Last automatic attempt">
          {lastAuto}
        </SyncDetailRow>
        <SyncDetailRow label="Next expected slot">
          {display.nextScheduledLabelIst ? `${display.nextScheduledLabelIst} IST` : "—"}
        </SyncDetailRow>
        {typeof ticketsStored === "number" ? (
          <SyncDetailRow label="Tickets in Live store">
            <span className="tabular-nums">{ticketsStored.toLocaleString()}</span>
          </SyncDetailRow>
        ) : null}
      </dl>
    </div>
  );
}

function SyncDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-medium text-foreground")}>{children}</dd>
    </div>
  );
}
