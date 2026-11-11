import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  latestScheduledMessage?: string | null;
  latestScheduledSkipReason?: string | null;
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

function deriveCompactSyncTone(input: {
  attention: ReturnType<typeof buildSchedulerAttention>;
  inOperationalWindow: boolean;
  latestScheduledStatus?: string | null;
}) {
  const status = input.latestScheduledStatus;
  if (input.attention.needsAttention || status === "failed") {
    return "issue" as const;
  }
  if (status === "skipped") {
    return "issue" as const;
  }
  if (!input.inOperationalWindow) {
    return "quiet" as const;
  }
  if (status === "success" || status === "partial") {
    return "active" as const;
  }
  if (status === "running") {
    return "active" as const;
  }
  if (!input.attention.scheduledHealthy && input.inOperationalWindow) {
    return "issue" as const;
  }
  return "unknown" as const;
}

export function SupportAnalyticsSchedulerStatusPanel({
  display,
  inOperationalWindow,
  ticketsStored,
  detailsOpen = false,
  hideDetailsToggle = false,
  children,
}: {
  display?: FreshnessDisplay | null;
  inOperationalWindow?: boolean;
  ticketsStored?: number;
  detailsOpen?: boolean;
  hideDetailsToggle?: boolean;
  children?: ReactNode;
}) {
  const [detailsOpenInternal, setDetailsOpenInternal] = useState(false);
  const expanded = hideDetailsToggle ? detailsOpen : detailsOpenInternal;

  if (!display) return null;

  const inWindow = Boolean(inOperationalWindow);
  const attention = buildSchedulerAttention({
    secretConfigured: display.schedulerSecretConfiguredOnServer !== false,
    inOperationalWindow: inWindow,
    lastScheduledRecorded: Boolean(display.latestScheduledLabelIst),
    lastScheduledStatus: display.latestScheduledStatus,
    freshnessWarning: display.schedulerFreshnessWarning,
  });

  const tone = deriveCompactSyncTone({
    attention,
    inOperationalWindow: inWindow,
    latestScheduledStatus: display.latestScheduledStatus,
  });

  const lastSyncTrigger = syncTriggerLabel(
    display.lastSuccessfulSyncTrigger ?? display.lastSyncType,
  );
  const lastAuto =
    display.latestScheduledLabelIst != null
      ? `${display.latestScheduledLabelIst} · ${scheduledAttemptLabel(display.latestScheduledStatus)}`
      : "Not recorded";

  const statusLabel =
    tone === "active"
      ? "Automatic sync active"
      : tone === "quiet"
        ? "Scheduled sync paused (quiet hours)"
        : tone === "issue"
          ? "Sync issue"
          : "Sync status";

  const StatusIcon =
    tone === "active"
      ? CheckCircle2
      : tone === "quiet"
        ? PauseCircle
        : tone === "issue"
          ? AlertCircle
          : PauseCircle;

  const iconClass =
    tone === "active"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "quiet"
        ? "text-muted-foreground"
        : tone === "issue"
          ? "text-amber-700 dark:text-amber-400"
          : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            tone === "issue" && "border-amber-500/40 bg-amber-500/10 text-foreground",
            tone === "active" && "border-border bg-muted/40 text-foreground",
            tone === "quiet" && "border-border bg-muted/20 text-muted-foreground",
            tone === "unknown" && "border-border bg-muted/20 text-muted-foreground",
          )}
        >
          <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
          {statusLabel}
        </div>

        {typeof ticketsStored === "number" ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {ticketsStored.toLocaleString()} tickets in Live store
          </span>
        ) : null}

        {!hideDetailsToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            aria-expanded={expanded}
            onClick={() => setDetailsOpenInternal((v) => !v)}
          >
            Sync details
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        ) : null}
      </div>

      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>

      {expanded ? (
        <SyncDetailsPanel>
          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <SyncDetailRow label="Last successful sync">
              {display.lastSuccessfulSyncLabelIst || "—"}
              {lastSyncTrigger !== "—" ? (
                <span className="text-muted-foreground"> ({lastSyncTrigger})</span>
              ) : null}
            </SyncDetailRow>
            <SyncDetailRow label="Last automatic attempt">
              {lastAuto}
              {display.latestScheduledFinishedLabelIst ? (
                <span className="block text-muted-foreground">
                  Finished {display.latestScheduledFinishedLabelIst} IST
                </span>
              ) : null}
            </SyncDetailRow>
            <SyncDetailRow label="Next expected slot">
              {display.nextScheduledLabelIst ? `${display.nextScheduledLabelIst} IST` : "—"}
              <span className="block text-muted-foreground">Expected schedule, not a health check</span>
            </SyncDetailRow>
          </dl>

          {(attention.githubDetail || attention.backendDetail) && (
            <SyncDetailsSubsection title="GitHub Actions & scheduling">
              {attention.githubDetail ? <p>{attention.githubDetail}</p> : null}
              {attention.backendDetail ? <p className="mt-1">{attention.backendDetail}</p> : null}
            </SyncDetailsSubsection>
          )}

          {display.latestScheduledMessage || display.latestScheduledSkipReason ? (
            <SyncDetailsSubsection title="Latest attempt details">
              {display.latestScheduledMessage ? <p>{display.latestScheduledMessage}</p> : null}
              {display.latestScheduledSkipReason ? (
                <p className="mt-1 text-muted-foreground">Reason: {display.latestScheduledSkipReason}</p>
              ) : null}
            </SyncDetailsSubsection>
          ) : null}

          <SyncDetailsSubsection title="Live data coverage">
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>Dashboard metrics use tickets synced into the Support Analytics store.</li>
              <li>Backlog counts reflect the latest stored snapshot.</li>
              <li>Period metrics use stored tickets for the dates you select.</li>
            </ul>
          </SyncDetailsSubsection>
        </SyncDetailsPanel>
      ) : null}
    </div>
  );
}

function SyncDetailsPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5", className)}>
      {children}
    </div>
  );
}

function SyncDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function SyncDetailsSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-border/80 pt-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 text-xs leading-relaxed text-foreground">{children}</div>
    </div>
  );
}
