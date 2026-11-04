import assert from "node:assert/strict";
import { validateSupportedReferenceFile, SUPPORTED_FILE_MAX_BYTES } from "./supported-file-attachment.ts";
import {
  applyBatchResultsToDrafts,
  findDuplicateDraftFileName,
  normalizeSupportedFileNameKey,
  SUPPORTED_FILE_BATCH_MAX_FILES,
  SUPPORTED_FILE_BATCH_MAX_TOTAL_BYTES,
  validateBatchExchangeUploadLimits,
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
assert.equal(validation.batchError, null);
assert.equal(validation.firstInvalidEntryId, null);

const sixPending = Array.from({ length: 6 }, (_, i) => ({
  ...e1,
  id: `p${i}`,
  fileName: `File ${i}`,
}));
assert.match(validateBatchExchangeUploadLimits(sixPending) ?? "", /5 files/);

const heavy = [
  { ...e1, id: "h1", referenceFile: new File([new Uint8Array(11 * 1024 * 1024)], "a.csv", { type: "text/csv" }) },
  { ...e1, id: "h2", referenceFile: new File([new Uint8Array(10 * 1024 * 1024)], "b.csv", { type: "text/csv" }) },
];
assert.match(validateBatchExchangeUploadLimits(heavy) ?? "", /20 MB/);
assert.equal(SUPPORTED_FILE_BATCH_MAX_FILES, 5);
assert.equal(SUPPORTED_FILE_BATCH_MAX_TOTAL_BYTES, 20 * 1024 * 1024);

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
