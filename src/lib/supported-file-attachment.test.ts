import assert from "node:assert/strict";
import { validateSupportedReferenceFile, SUPPORTED_FILE_MAX_BYTES } from "./supported-file-attachment.ts";

assert.equal(validateSupportedReferenceFile(new File(["x"], "sample.csv", { type: "text/csv" })), null);
assert.equal(validateSupportedReferenceFile(new File(["x"], "doc.pdf", { type: "application/pdf" })), null);

const big = new File([new Uint8Array(SUPPORTED_FILE_MAX_BYTES + 1)], "big.csv", { type: "text/csv" });
assert.match(validateSupportedReferenceFile(big) ?? "", /12 MB/);

assert.match(validateSupportedReferenceFile(new File(["x"], "bad.exe", { type: "application/octet-stream" })) ?? "", /not allowed/);

console.log("supported-file-attachment.test.ts: ok");
