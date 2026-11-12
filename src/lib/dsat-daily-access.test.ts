/**
 * Run: npx tsx src/lib/dsat-daily-access.test.ts
 */
import assert from "node:assert/strict";
import { canAccessDailyDsat, canCorrectDailyDsat } from "./dsat-daily-access.js";

assert.equal(canAccessDailyDsat("admin"), true);
assert.equal(canAccessDailyDsat("supervisor"), true);
assert.equal(canAccessDailyDsat("senior_agent"), true);
assert.equal(canAccessDailyDsat("agent"), false);
assert.equal(canAccessDailyDsat("tech_agent"), false);

assert.equal(canCorrectDailyDsat("admin"), true);
assert.equal(canCorrectDailyDsat("supervisor"), true);
assert.equal(canCorrectDailyDsat("senior_agent"), false);

console.log("dsat-daily-access.test.ts: ok");
