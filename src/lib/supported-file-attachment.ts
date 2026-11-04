/** Mirrors server `supported-files/attachment-validation.ts` (default 12 MB). */
export const SUPPORTED_FILE_MAX_BYTES = 12 * 1024 * 1024;

export const SUPPORTED_FILE_ACCEPT =
  "text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,.xls,.xlsx";

export const SUPPORTED_FILE_FORMAT_HINT = "CSV or Excel (.csv, .xls, .xlsx)";

const ALLOWED_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function extensionAllowed(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".xls") || lower.endsWith(".xlsx");
}

export function validateSupportedReferenceFile(file: File): string | null {
  if (file.size > SUPPORTED_FILE_MAX_BYTES) {
    return `File exceeds ${Math.round(SUPPORTED_FILE_MAX_BYTES / (1024 * 1024))} MB limit.`;
  }
  const contentType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (contentType && ALLOWED_TYPES.has(contentType)) return null;
  if (!contentType || contentType === "application/octet-stream") {
    if (extensionAllowed(file.name)) return null;
  }
  if (extensionAllowed(file.name)) return null;
  return `File type not allowed. Use ${SUPPORTED_FILE_FORMAT_HINT}.`;
}
