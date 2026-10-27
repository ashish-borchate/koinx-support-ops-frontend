/**
 * Run: npm test (from client/)
 */
import assert from "node:assert/strict";
import { DISCOVER_CHAPTERS, discoverBySlug } from "./learning-catalog.js";
import { DISCOVER_SLUG_REDIRECTS } from "./legacy-redirects.js";

assert.equal(DISCOVER_CHAPTERS.length, 2);
assert.deepEqual(DISCOVER_CHAPTERS.map((c) => c.slug), ["welcome", "getting-around"]);
assert.equal(discoverBySlug("modules-at-a-glance"), undefined);
assert.equal(DISCOVER_SLUG_REDIRECTS["modules-at-a-glance"], "/handbook/discover/welcome");

console.log("handbook/lib/learning-catalog.test.ts: ok");
