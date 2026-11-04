export type SupportedFileDraftEntry = {
  id: string;
  fileName: string;
  notes: string;
  referenceFile: File | null;
  fileError: string | null;
  createdId?: string;
};

/** Matches server batch policy (one exchange, up to 5 files, 20 MB decoded total). */
export const SUPPORTED_FILE_BATCH_MAX_FILES = 5;
export const SUPPORTED_FILE_BATCH_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export function sumPendingReferenceBytes(entries: SupportedFileDraftEntry[]) {
  return entries
    .filter((e) => !e.createdId && e.referenceFile)
    .reduce((sum, e) => sum + (e.referenceFile?.size ?? 0), 0);
}

export function countPendingDraftEntries(entries: SupportedFileDraftEntry[]) {
  return entries.filter((e) => !e.createdId).length;
}

export function validateBatchExchangeUploadLimits(entries: SupportedFileDraftEntry[]): string | null {
  const pendingCount = countPendingDraftEntries(entries);
  if (pendingCount > SUPPORTED_FILE_BATCH_MAX_FILES) {
    return `You can upload at most ${SUPPORTED_FILE_BATCH_MAX_FILES} files per exchange.`;
  }
  const totalBytes = sumPendingReferenceBytes(entries);
  if (totalBytes > SUPPORTED_FILE_BATCH_MAX_TOTAL_BYTES) {
    return `Total reference file size exceeds ${Math.round(SUPPORTED_FILE_BATCH_MAX_TOTAL_BYTES / (1024 * 1024))} MB for one exchange upload.`;
  }
  return null;
}

export function normalizeSupportedFileNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findDuplicateDraftFileName(entries: SupportedFileDraftEntry[]) {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.createdId) continue;
    const key = normalizeSupportedFileNameKey(entry.fileName);
    if (!key) continue;
    if (seen.has(key)) {
      return entry.fileName.trim() || key;
    }
    seen.add(key);
  }
  return null;
}

export type DraftValidationResult = {
  exchangeError: string | null;
  batchError: string | null;
  entryErrors: Record<string, { fileName?: string; reference?: string }>;
  firstInvalidEntryId: string | null;
};

export function validateSupportedFileDrafts(
  exchangeName: string,
  entries: SupportedFileDraftEntry[],
  options?: { requireReference?: (entry: SupportedFileDraftEntry) => boolean },
): DraftValidationResult {
  const requireReference = options?.requireReference ?? ((e: SupportedFileDraftEntry) => !e.createdId);
  const entryErrors: DraftValidationResult["entryErrors"] = {};
  let firstInvalidEntryId: string | null = null;

  const exchangeError = exchangeName.trim() ? null : "Exchange is required.";
  const batchError = validateBatchExchangeUploadLimits(entries);

  const pending = entries.filter((e) => !e.createdId);
  const duplicate = findDuplicateDraftFileName(entries);
  if (duplicate) {
    for (const entry of pending) {
      if (normalizeSupportedFileNameKey(entry.fileName) === normalizeSupportedFileNameKey(duplicate)) {
        entryErrors[entry.id] = {
          ...entryErrors[entry.id],
          fileName: "Duplicate supported file name in this exchange.",
        };
        if (!firstInvalidEntryId) firstInvalidEntryId = entry.id;
      }
    }
  }

  for (const entry of pending) {
    const errs: { fileName?: string; reference?: string } = entryErrors[entry.id] ?? {};
    if (!entry.fileName.trim()) {
      errs.fileName = "Supported file name is required.";
    }
    if (requireReference(entry) && !entry.referenceFile) {
      errs.reference = "Reference file is required (CSV or Excel).";
    }
    if (entry.fileError) {
      errs.reference = entry.fileError;
    }
    if (Object.keys(errs).length > 0) {
      entryErrors[entry.id] = errs;
      if (!firstInvalidEntryId) firstInvalidEntryId = entry.id;
    }
  }

  if (exchangeError && !firstInvalidEntryId && pending.length > 0) {
    firstInvalidEntryId = pending[0].id;
  }

  return { exchangeError, batchError, entryErrors, firstInvalidEntryId };
}

export type BatchApiResultItem = {
  fileName: string;
  ok: boolean;
  id?: string;
  error?: string;
  step?: "create" | "attachment" | "validation" | "rollback";
  rolledBack?: boolean;
  rollbackFailed?: boolean;
  rollbackUnconfirmed?: boolean;
  supportedFileId?: string;
  rollbackError?: string;
  rollbackStep?: string;
  rollbackCleanupStatus?: "confirmed_complete" | "partial" | "not_started" | "not_confirmed";
  recordRemoved?: boolean;
  blobRemoved?: boolean;
};

export function formatBatchEntryFailureMessage(item: BatchApiResultItem): string {
  const base = item.error || "Failed";
  if (!item.rollbackFailed && !item.rollbackUnconfirmed) {
    return `${item.fileName}: ${base}`;
  }
  const parts = [`${item.fileName}: ${base}`];
  if (item.supportedFileId) {
    parts.push(`Record ID: ${item.supportedFileId}`);
  }
  if (item.rollbackStep) {
    parts.push(`Failed step: ${item.rollbackStep}`);
  }
  if (item.rollbackCleanupStatus) {
    const cleanupLabel =
      item.rollbackCleanupStatus === "confirmed_complete"
        ? "Cleanup: database record removed (rollback audit may be incomplete)."
        : item.rollbackCleanupStatus === "partial"
          ? "Cleanup: partially complete — an incomplete record or orphaned blob may remain."
          : item.rollbackCleanupStatus === "not_confirmed"
            ? "Cleanup: not confirmed for this attempt."
            : "Cleanup: not started.";
    parts.push(cleanupLabel);
  }
  if (item.recordRemoved === true) {
    parts.push("The supported file record is no longer in the database.");
  } else if (item.recordRemoved === false && item.rollbackFailed) {
    parts.push("The supported file record may still exist — do not retry blindly.");
  }
  parts.push("Contact an internal maintainer with the record ID and details above.");
  return parts.join(" ");
}

export function summarizeBatchResults(results: BatchApiResultItem[]) {
  const created = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return { created, failed, total: results.length };
}

export function applyBatchResultsToDrafts(
  entries: SupportedFileDraftEntry[],
  results: BatchApiResultItem[],
): SupportedFileDraftEntry[] {
  const byName = new Map<string, BatchApiResultItem>();
  for (const r of results) byName.set(normalizeSupportedFileNameKey(r.fileName), r);
  return entries.map((entry) => {
    const key = normalizeSupportedFileNameKey(entry.fileName);
    const result = byName.get(key);
    if (result?.ok && result.id) {
      return { ...entry, createdId: result.id };
    }
    return entry;
  });
}
