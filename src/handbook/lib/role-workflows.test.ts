/**
 * Run: npm test
 */
import assert from "node:assert/strict";
import { WORKFLOW_DEFS } from "./learning-catalog.js";
import { allHandbookWorkflows, isMyWorkflowForRole, myWorkflowsForRole } from "./role-workflows.js";

assert.equal(allHandbookWorkflows().length, 13);
assert.equal(WORKFLOW_DEFS.length, 13);

const agentSlugs = myWorkflowsForRole("agent").map((w) => w.slug);
assert.ok(agentSlugs.includes("qa-evaluations-and-appeals"));
assert.ok(!agentSlugs.includes("feature-impact"));

const techSlugs = myWorkflowsForRole("tech_agent").map((w) => w.slug);
assert.deepEqual(
  techSlugs,
  ["reported-issues", "integration-steps", "support-updates", "token-migration"],
);
assert.equal(isMyWorkflowForRole("supported-files", "tech_agent"), false);

console.log("handbook/lib/role-workflows.test.ts: ok");
