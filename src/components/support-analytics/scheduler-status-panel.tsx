import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Server, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSchedulerAttention } from "@/lib/support-analytics-scheduler-diagnostics";

type FreshnessDisplay = {
  lastSuccessfulSyncLabelIst?: string | null;
  lastSuccessfulSyncTrigger?: string | null;
  lastSyncType?: string | null;
  nextScheduledLabelIst?: string | null;
  latestScheduledLabelIst?: string | null;
  latestScheduledStatus?: string | null;
  schedulerFreshnessWarning?: string | null;
  schedulerSecretConfiguredOnServer?: boolean;
};

function syncTriggerLabel(trigger?: string | null) {
  switch (trigger) {
    case "scheduled":
      return "Scheduled";
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

export function SupportAnalyticsSchedulerStatusPanel({
  display,
  inOperationalWindow,
}: {
  display?: FreshnessDisplay | null;
  inOperationalWindow?: boolean;
}) {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!display) return null;

  const attention = buildSchedulerAttention({
    secretConfigured: display.schedulerSecretConfiguredOnServer !== false,
    inOperationalWindow: Boolean(inOperationalWindow),
    lastScheduledRecorded: Boolean(display.latestScheduledLabelIst),
    lastScheduledStatus: display.latestScheduledStatus,
    freshnessWarning: display.schedulerFreshnessWarning,
  });

  const lastSyncTrigger = syncTriggerLabel(
    display.lastSuccessfulSyncTrigger ?? display.lastSyncType,
  );
  const lastAuto =
    display.latestScheduledLabelIst != null
      ? `${display.latestScheduledLabelIst} IST · ${scheduledAttemptLabel(display.latestScheduledStatus)}`
      : "Not recorded";

  return (
    <div className="space-y-2">
      {attention.needsAttention ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-sm">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium text-foreground">Scheduled sync needs attention</p>
                <p className="text-xs text-muted-foreground">
                  Automatic Live sync is not currently configured correctly.
                </p>
              </div>
              {attention.githubDetail ? (
                <div className="flex gap-2 text-xs leading-snug">
                  <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p>
                    <span className="font-medium text-foreground">GitHub Actions:</span> {attention.githubDetail}
                  </p>
                </div>
              ) : null}
              {attention.backendDetail ? (
                <div className="flex gap-2 text-xs leading-snug">
                  <Server className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p>
                    <span className="font-medium text-foreground">Backend configuration:</span>{" "}
                    {attention.backendDetail}
                  </p>
                </div>
              ) : null}
              {attention.technicalDetail ? (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-xs text-muted-foreground"
                    onClick={() => setShowTechnical((v) => !v)}
                  >
                    {showTechnical ? (
                      <ChevronDown className="mr-1 h-3 w-3" />
                    ) : (
                      <ChevronRight className="mr-1 h-3 w-3" />
                    )}
                    Technical details
                  </Button>
                  {showTechnical ? (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{attention.technicalDetail}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <p>
          <span className="text-muted-foreground">Last successful sync:</span>{" "}
          <span className="font-medium text-foreground">{display.lastSuccessfulSyncLabelIst || "—"}</span>{" "}
          <span className="text-muted-foreground">({lastSyncTrigger})</span>
        </p>
        <p>
          <span className="text-muted-foreground">Last automatic attempt:</span>{" "}
          <span className="font-medium text-foreground">{lastAuto}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Next expected slot:</span>{" "}
          <span className="font-medium text-foreground">
            {display.nextScheduledLabelIst ? `${display.nextScheduledLabelIst} IST` : "—"}
          </span>
          <span className="ml-1 text-muted-foreground">(expected, not health check)</span>
        </p>
      </div>
    </div>
  );
}
