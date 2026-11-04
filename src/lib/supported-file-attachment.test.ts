import assert from "node:assert/strict";
import { validateSupportedReferenceFile, SUPPORTED_FILE_MAX_BYTES } from "./supported-file-attachment.ts";
import {
  applyBatchResultsToDrafts,
  findDuplicateDraftFileName,
  normalizeSupportedFileNameKey,
  validateSupportedFileDrafts,
  type SupportedFileDraftEntry,
} from "./supported-file-batch.ts";

assert.equal(validateSupportedReferenceFile(new File(["x"], "sample.csv", { type: "text/csv" })), null);
assert.equal(
  validateSupportedReferenceFile(
    new File(["x"], "sheet.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  ),
  null,
);
assert.match(
  validateSupportedReferenceFile(new File(["x"], "doc.pdf", { type: "application/pdf" })) ?? "",
  /not allowed/,
);

const big = new File([new Uint8Array(SUPPORTED_FILE_MAX_BYTES + 1)], "big.csv", { type: "text/csv" });
assert.match(validateSupportedReferenceFile(big) ?? "", /12 MB/);

assert.match(validateSupportedReferenceFile(new File(["x"], "bad.exe", { type: "application/octet-stream" })) ?? "", /not allowed/);

const e1: SupportedFileDraftEntry = {
  id: "a",
  fileName: "Trade History",
  notes: "",
  referenceFile: new File(["x"], "t.csv", { type: "text/csv" }),
  fileError: null,
};
const e2: SupportedFileDraftEntry = {
  id: "b",
  fileName: "trade history",
  notes: "",
  referenceFile: null,
  fileError: null,
};
assert.ok(findDuplicateDraftFileName([e1, e2]));

const validation = validateSupportedFileDrafts("Binance", [e1]);
assert.equal(validation.exchangeError, null);
assert.equal(validation.firstInvalidEntryId, null);

const missingRef: SupportedFileDraftEntry = { ...e1, id: "c", referenceFile: null };
const v2 = validateSupportedFileDrafts("Binance", [missingRef]);
assert.equal(v2.entryErrors.c?.reference, "Reference file is required (CSV or Excel).");

const merged = applyBatchResultsToDrafts(
  [e1, { ...e2, fileName: "Deposits", id: "d", referenceFile: e1.referenceFile }],
  [
    { fileName: "Trade History", ok: true, id: "id1" },
    { fileName: "Deposits", ok: false, error: "exists" },
  ],
);
assert.equal(merged[0]?.createdId, "id1");
assert.equal(normalizeSupportedFileNameKey("  Trade   History "), "trade history");

console.log("supported-file-attachment.test.ts: ok");
