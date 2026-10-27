/**
 * Run: npm test
 */
import assert from "node:assert/strict";
import {
  canPreviewOtherRoles,
  canViewPlaybookRole,
  handbookAudienceRole,
  playbookRolesForViewer,
  workflowVisibleToRole,
} from "./visibility.js";

assert.deepEqual(playbookRolesForViewer("agent"), ["agent"]);
assert.deepEqual(playbookRolesForViewer("supervisor"), [
  "agent",
  "senior_agent",
  "supervisor",
  "tech_agent",
  "admin",
]);
assert.equal(canPreviewOtherRoles("admin"), true);
assert.equal(canPreviewOtherRoles("agent"), false);
assert.equal(canViewPlaybookRole("supervisor", "agent"), true);
assert.equal(canViewPlaybookRole("agent", "supervisor"), false);
assert.equal(handbookAudienceRole("supervisor", "agent"), "agent");
assert.equal(handbookAudienceRole("agent", "supervisor"), "agent");
assert.equal(workflowVisibleToRole("all", "tech_agent"), true);
assert.equal(workflowVisibleToRole(["supervisor"], "agent"), false);

console.log("handbook/lib/visibility.test.ts: ok");
