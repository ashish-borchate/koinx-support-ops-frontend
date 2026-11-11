/** Mirrors server `deriveSchedulerAttention` for Live sync status UI. */

export type SchedulerAttentionState = {
  needsAttention: boolean;
  githubDetail: string | null;
  backendDetail: string | null;
  technicalDetail: string | null;
  scheduledHealthy: boolean;
};

const FAILURE_STATUSES = new Set(["failed", "partial"]);

export function buildSchedulerAttention(input: {
  secretConfigured: boolean;
  inOperationalWindow: boolean;
  lastScheduledRecorded: boolean;
  lastScheduledStatus: string | null | undefined;
  freshnessWarning: string | null | undefined;
}): SchedulerAttentionState {
  const githubDetail =
    input.freshnessWarning ??
    (input.lastScheduledStatus && FAILURE_STATUSES.has(input.lastScheduledStatus)
      ? `Latest automatic attempt failed (${input.lastScheduledStatus}). Check GitHub Actions workflow logs.`
      : input.inOperationalWindow && !input.lastScheduledRecorded
        ? "No scheduled attempt recorded today. Check the workflow on the default branch and its latest run."
        : null);

  const backendDetail = input.secretConfigured
    ? null
    : "`SUPPORT_ANALYTICS_SCHEDULER_SECRET` is missing. Configure it in the backend environment and make sure it matches the GitHub repository secret.";

  const needsAttention = Boolean(githubDetail || backendDetail);
  const scheduledHealthy =
    input.secretConfigured &&
    input.lastScheduledRecorded &&
    !FAILURE_STATUSES.has(String(input.lastScheduledStatus ?? "")) &&
    !input.freshnessWarning;

  return {
    needsAttention,
    githubDetail,
    backendDetail,
    technicalDetail: input.freshnessWarning ?? null,
    scheduledHealthy,
  };
}
