import assert from "node:assert/strict";
import { buildSchedulerAttention } from "./support-analytics-scheduler-diagnostics.js";

const missingSecret = buildSchedulerAttention({
  secretConfigured: false,
  inOperationalWindow: true,
  lastScheduledRecorded: false,
  lastScheduledStatus: null,
  freshnessWarning: null,
});
assert.equal(missingSecret.needsAttention, true);
assert.ok(missingSecret.backendDetail?.includes("SUPPORT_ANALYTICS_SCHEDULER_SECRET"));

const noAttempt = buildSchedulerAttention({
  secretConfigured: true,
  inOperationalWindow: true,
  lastScheduledRecorded: false,
  lastScheduledStatus: null,
  freshnessWarning: null,
});
assert.equal(noAttempt.needsAttention, true);
assert.ok(noAttempt.githubDetail?.includes("No scheduled attempt"));

const failed = buildSchedulerAttention({
  secretConfigured: true,
  inOperationalWindow: true,
  lastScheduledRecorded: true,
  lastScheduledStatus: "failed",
  freshnessWarning: null,
});
assert.equal(failed.needsAttention, true);
assert.ok(failed.githubDetail?.includes("failed"));

const healthy = buildSchedulerAttention({
  secretConfigured: true,
  inOperationalWindow: true,
  lastScheduledRecorded: true,
  lastScheduledStatus: "success",
  freshnessWarning: null,
});
assert.equal(healthy.needsAttention, false);
assert.equal(healthy.scheduledHealthy, true);

console.log("support-analytics-scheduler-diagnostics.test.ts: ok");
