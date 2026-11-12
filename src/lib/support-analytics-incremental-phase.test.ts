import assert from "node:assert/strict";
import {
  incrementalPhaseProgressLabel,
  incrementalPhaseRunHistoryLabel,
  normalizeTicketIncrementalPhase,
} from "./support-analytics-incremental-phase.js";

assert.equal(normalizeTicketIncrementalPhase("initial"), "initial");
assert.equal(normalizeTicketIncrementalPhase(undefined), "");
assert.equal(incrementalPhaseProgressLabel("initial"), "Initial pass in progress");
assert.equal(incrementalPhaseProgressLabel("catchup"), "Catch-up pass in progress");
assert.equal(incrementalPhaseProgressLabel(""), null);
assert.equal(incrementalPhaseRunHistoryLabel("catchup"), "Catch-up");
assert.equal(incrementalPhaseRunHistoryLabel(undefined), null);
assert.equal(incrementalPhaseRunHistoryLabel(""), null);

console.log("lib/support-analytics-incremental-phase.test.ts: ok");
