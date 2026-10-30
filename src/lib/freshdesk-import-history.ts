import { formatWeek } from "@/lib/format";

export type ImportHistoryStatus = "imported" | "partially_imported" | "replaced";

export type ImportHistoryEntry = {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  reportTitle: string;
  originalFilename: string;
  reportGeneratedAt: string;
  reportingFilter: string;
  appliedAt: string | Date | null;
  historyStatus: ImportHistoryStatus;
  importedAgentCount: number;
  selectedAgentCount: number;
  appliedByName: string | null;
  wasReplaced: boolean;
};

export function formatImportHistoryStatus(status: ImportHistoryStatus): string {
  switch (status) {
    case "imported":
      return "Imported";
    case "partially_imported":
      return "Partially imported";
    case "replaced":
      return "Replaced";
    default:
      return status;
  }
}

export function formatImportReportTitle(entry: Pick<ImportHistoryEntry, "periodType" | "reportTitle">): string {
  if (entry.reportTitle?.trim()) return entry.reportTitle.trim();
  return entry.periodType === "weekly" ? "Weekly Agent Performance" : "Monthly Agent Performance";
}

export function formatImportReportingPeriod(entry: Pick<ImportHistoryEntry, "periodType" | "periodStart" | "periodEnd">): string {
  if (entry.periodType === "weekly") {
    return formatWeek(entry.periodStart);
  }
  const start = new Date(`${entry.periodStart}T00:00:00.000Z`);
  const end = new Date(`${entry.periodEnd}T00:00:00.000Z`);
  const monthYear = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${start.getUTCDate()}–${end.getUTCDate()} ${monthYear}`;
}

export function formatImportAppliedAt(value: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
