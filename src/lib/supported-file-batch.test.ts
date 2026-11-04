import assert from "node:assert/strict";
import { formatBatchEntryFailureMessage } from "./supported-file-batch.js";

const rollbackFailed = formatBatchEntryFailureMessage({
  fileName: "Trades",
  ok: false,
  rollbackFailed: true,
  supportedFileId: "507f1f77bcf86cd799439011",
  rollbackStep: "record",
  rollbackCleanupStatus: "partial",
  recordRemoved: false,
  blobRemoved: true,
  error: "Attachment upload failed.",
});

assert.match(rollbackFailed, /Record ID: 507f1f77bcf86cd799439011/);
assert.match(rollbackFailed, /Failed step: record/);
assert.match(rollbackFailed, /partially complete/i);
assert.match(rollbackFailed, /do not retry blindly/i);

const auditGap = formatBatchEntryFailureMessage({
  fileName: "Deposits",
  ok: false,
  rollbackFailed: true,
  supportedFileId: "507f1f77bcf86cd799439012",
  rollbackStep: "audit",
  rollbackCleanupStatus: "confirmed_complete",
  recordRemoved: true,
  error: "Rollback cleanup completed but success audit write failed",
});

assert.match(auditGap, /no longer in the database/i);
assert.match(auditGap, /507f1f77bcf86cd799439012/);

console.log("supported-file-batch.test.ts: ok");
