/**
 * Run: npm test (from client/)
 */
import assert from "node:assert/strict";
import {
  playbookChapter,
  playbookChaptersForRole,
  sharedChapterBySlug,
  assertValidPlaybookRoute,
  contentFileKey,
} from "./catalog.js";
import { isPlaybookRoleKey, myPlaybookPath, playbookPath } from "./roles.js";

assert.ok(sharedChapterBySlug("what-is-support-hub"));
assert.equal(sharedChapterBySlug("missing"), undefined);

assert.equal(playbookChaptersForRole("agent").length, 3);
assert.equal(playbookChaptersForRole("supervisor").length, 3);
assert.ok(playbookChapter("agent", "introduction"));

assert.equal(assertValidPlaybookRoute("agent", "introduction"), "agent");
assert.equal(assertValidPlaybookRoute("agent", "nope"), null);
assert.equal(assertValidPlaybookRoute("not-a-role"), null);

assert.equal(contentFileKey(sharedChapterBySlug("hub-vs-freshdesk")!), "../content/shared/hub-vs-freshdesk.md");
assert.equal(
  contentFileKey(playbookChapter("agent", "introduction")!),
  "../content/playbooks/agent/introduction.md",
);

assert.ok(isPlaybookRoleKey("senior_agent"));
assert.ok(!isPlaybookRoleKey("intern"));

assert.equal(myPlaybookPath("agent"), "/handbook/playbooks/agent");
assert.equal(playbookPath("supervisor", "intro"), "/handbook/playbooks/supervisor/intro");

console.log("handbook/lib/catalog.test.ts: ok");
