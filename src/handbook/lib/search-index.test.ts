/**
 * Run: npm test (pure helpers; full index requires Vite import.meta.glob in the app).
 */
import assert from "node:assert/strict";
import { stripMarkdown } from "./search-utils.js";

assert.equal(stripMarkdown("## Hello [link](/x) `code`"), "Hello link");
assert.ok(stripMarkdown("**bold** text").includes("bold"));

console.log("handbook/lib/search-index.test.ts: ok");
