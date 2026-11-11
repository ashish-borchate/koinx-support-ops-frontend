import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import {
  DataTableShell,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
} from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiFormData } from "@/lib/api";
import { toast } from "sonner";
import { formatCalendarDate, formatDurationHours, formatNumber } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { type DatePresetId, resolveDatePreset } from "@/lib/support-analytics-date-presets";
import {
  SupportAnalyticsActivityCalendar,
  type CalendarActivityKind,
} from "@/components/support-analytics/activity-calendar";
import {
  advanceExportJob,
  isExportJobActive,
  retryFailedExportJob,
  type SaExportJob,
} from "@/components/support-analytics/export-job-list";
import { ManageHistoricalDataSheet } from "@/components/support-analytics/manage-historical-data-sheet";
import {
  SupportAnalyticsTicketExplorerModal,
  historicalDayExplorer,
  type SupportAnalyticsTicketExplorerRequest,
} from "@/components/support-analytics/ticket-explorer-modal";
import { addDaysIst } from "@/lib/support-analytics-date-presets";

type DurationMetric = {
  available: boolean;
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  note: string;
};

type HistoricalOverview = {
  dataSource: string;
  range: { from: string; to: string; timezone: string };
  note: string;
  coverage: {
    successfulImports: number;
    canonicalTicketCount: number;
    totalStoredRows: number;
    duplicateUploadAttempts: number;
    imports: {
      id: string;
      filename: string;
      coverageFrom: string;
      coverageTo: string;
      ticketsUpserted: number;
      importedAt: string;
    }[];
  };
  periodActivity: {
    ticketsCreated: number;
    ticketsResolved: number;
    firstResponseTime: DurationMetric;
    resolutionTime: DurationMetric & { resolutionTimestampPolicy?: string };
  };
  dailyTrend: { date: string; created: number; resolved: number }[];
  snapshotAtImport?: {
    backlogCount: number;
    breakdown: {
      byStatus: { id: number; label: string; count: number }[];
      byPriority: { id: number; label: string; count: number }[];
      bySource: { id: number; label: string; count: number }[];
    };
  };
};

function formatMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return formatDurationHours(ms / 3_600_000);
}

type AdvancedAnalytics = {
  volume: {
    createdInRange: number;
    resolvedInRange: number;
    netChange: number;
    dailyTrend: { date: string; created: number; resolved: number; net: number }[];
    weekdayCreated: { weekday: number; created: number }[];
    hourCreatedHeatmap: { hourIst: number; created: number }[];
  };
  backlogAging: { label: string; buckets: { bucket: string; count: number }[] };
  insights: string[];
  unavailable: Record<string, string>;
};

export function SupportAnalyticsHistoricalPanel() {
  const { can, readOnly } = useAuth();
  const qc = useQueryClient();
  const canImport = can("support_analytics.import") && !readOnly;
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [explorerRequest, setExplorerRequest] = useState<SupportAnalyticsTicketExplorerRequest | null>(null);
  const [lastFreshdeskRange, setLastFreshdeskRange] = useState<{
    start_date: string;
    end_date: string;
    selectedFrom: string;
    selectedTo: string;
    endCappedToNow: boolean;
  } | null>(null);
  const [importFrom, setImportFrom] = useState("");
  const [importTo, setImportTo] = useState("");
  const [preset, setPreset] = useState<DatePresetId>("last30");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [manageDataOpen, setManageDataOpen] = useState(false);
  const rangeInit = useRef(false);
  const advancingExportRef = useRef(false);

  const imports = useQuery({
    queryKey: ["support-analytics", "imports"],
    queryFn: () => api<{ imports: unknown[] }>("/api/support-analytics/imports"),
    staleTime: STALE.operational,
  });

  const exportsQuery = useQuery({
    queryKey: ["support-analytics", "exports"],
    queryFn: () => api<{ exports: SaExportJob[] }>("/api/support-analytics/exports"),
    staleTime: STALE.operational,
    refetchInterval: (query) => {
      const rows = (query.state.data as { exports?: SaExportJob[] } | undefined)?.exports || [];
      return rows.some(isExportJobActive) ? 12_000 : false;
    },
  });

  const advanced = useQuery({
    queryKey: ["support-analytics", "historical-advanced", appliedFrom, appliedTo],
    enabled: Boolean(appliedFrom && appliedTo),
    queryFn: () => {
      const params = new URLSearchParams({ from: appliedFrom, to: appliedTo });
      return api<AdvancedAnalytics & { range: HistoricalOverview["range"] }>(
        `/api/support-analytics/historical/advanced?${params}`,
      );
    },
    staleTime: STALE.operational,
  });

  const overview = useQuery({
    queryKey: ["support-analytics", "historical-overview", appliedFrom, appliedTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (appliedFrom && appliedTo) {
        params.set("from", appliedFrom);
        params.set("to", appliedTo);
      }
      const q = params.toString();
      return api<HistoricalOverview>(`/api/support-analytics/historical/overview${q ? `?${q}` : ""}`);
    },
    staleTime: STALE.operational,
  });

  const data = overview.data;

  useEffect(() => {
    if (!data?.range || rangeInit.current) return;
    rangeInit.current = true;
    setDraftFrom(data.range.from);
    setDraftTo(data.range.to);
    setAppliedFrom(data.range.from);
    setAppliedTo(data.range.to);
    const yesterday = addDaysIst(data.range.to, -1);
    setImportFrom(yesterday);
    setImportTo(yesterday);
  }, [data?.range]);

  const activeExportJob = useMemo(
    () => exportsQuery.data?.exports?.find(isExportJobActive) ?? null,
    [exportsQuery.data?.exports],
  );

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return apiFormData<{ import: { status: string; ticketsUpserted?: number }; duplicate: boolean }>(
        "/api/support-analytics/imports/upload",
        form,
      );
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["support-analytics"] });
      toast.success(
        res.duplicate ? "This file was already imported (duplicate checksum)." : "Historical JSON imported.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const startExport = useMutation({
    mutationFn: async () => {
      if (!importFrom || !importTo) throw new Error("Select import From and To dates first.");
      return api<{
        id: string;
        hubStatus: string;
        freshdeskDateRange?: {
          start_date: string;
          end_date: string;
          selectedFrom: string;
          selectedTo: string;
          endCappedToNow: boolean;
        };
      }>("/api/support-analytics/exports/start", {
        method: "POST",
        body: JSON.stringify({ from: importFrom, to: importTo }),
      });
    },
    onSuccess: async (job) => {
      if (job.freshdeskDateRange) setLastFreshdeskRange(job.freshdeskDateRange);
      toast.success("Freshdesk account export started.");
      await exportsQuery.refetch();
      await advanceExportJob(job.id);
      void exportsQuery.refetch();
      qc.invalidateQueries({ queryKey: ["support-analytics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start account export"),
  });

  const activeExportId = useMemo(() => {
    const rows = exportsQuery.data?.exports || [];
    return rows.find(isExportJobActive)?.id ?? null;
  }, [exportsQuery.data?.exports]);

  useEffect(() => {
    if (!activeExportId) return;
    const tick = async () => {
      if (advancingExportRef.current) return;
      advancingExportRef.current = true;
      try {
        await advanceExportJob(activeExportId);
        await exportsQuery.refetch();
        qc.invalidateQueries({ queryKey: ["support-analytics"] });
      } catch {
        /* ignore transient poll errors */
      } finally {
        advancingExportRef.current = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 10_000);
    return () => window.clearInterval(timer);
  }, [activeExportId, exportsQuery, qc]);

  function applyRange(from = draftFrom, to = draftTo) {
    if (!from || !to) {
      toast.error("Select both From and To dates.");
      return;
    }
    if (from > to) {
      toast.error("From cannot be after To.");
      return;
    }
    setAppliedFrom(from);
    setAppliedTo(to);
    setDraftFrom(from);
    setDraftTo(to);
    setExplorerRequest(null);
  }

  function openDayActivity(date: string, kind: CalendarActivityKind) {
    if (!appliedFrom || !appliedTo) return;
    setExplorerRequest(historicalDayExplorer(date, kind, appliedFrom, appliedTo));
  }

  function openPeriodActivity(kind: "created" | "resolved") {
    if (!appliedFrom || !appliedTo) return;
    setExplorerRequest({
      source: "historical",
      title: kind === "created" ? "Tickets created" : "Tickets resolved",
      subtitle: `${formatCalendarDate(appliedFrom)} – ${formatCalendarDate(appliedTo)} (IST)`,
      exportFileName: `historical-${kind}-${appliedFrom}-${appliedTo}.csv`,
      queryParams: { kind, from: appliedFrom, to: appliedTo, limit: "500" },
    });
  }

  function selectPreset(next: DatePresetId) {
    setPreset(next);
    if (next === "custom") {
      setShowCustomRange(true);
      return;
    }
    setShowCustomRange(false);
    const { from, to } = resolveDatePreset(next);
    applyRange(from, to);
  }

  const importList = useMemo(
    () => (imports.data?.imports as HistoricalOverview["coverage"]["imports"]) || data?.coverage.imports || [],
    [imports.data, data?.coverage.imports],
  );

  const dailyForCalendar =
    advanced.data?.volume.dailyTrend?.length ? advanced.data.volume.dailyTrend : data?.dailyTrend || [];

  const importedSpan = useMemo(() => {
    if (!importList.length) return null;
    let from = importList[0]!.coverageFrom;
    let to = importList[0]!.coverageTo;
    for (const row of importList) {
      if (row.coverageFrom < from) from = row.coverageFrom;
      if (row.coverageTo > to) to = row.coverageTo;
    }
    return { from, to };
  }, [importList]);

  const exportJobs = exportsQuery.data?.exports ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Trends and activity from imported Freshdesk exports. Not combined with Live API sync.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setManageDataOpen(true)}>
          <Database className="mr-2 h-4 w-4" />
          Manage Historical Data
          {activeExportJob ? (
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
              Import running
            </span>
          ) : null}
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card px-3 py-3">
        <SectionHeader
          className="mb-2"
          title="Reporting period"
          description="Filters the metrics below to tickets created or resolved on these IST dates. Does not download or import new data."
        />
        <div className="flex flex-wrap items-end gap-2">
          <PresetGroup preset={preset} onSelect={selectPreset} />
          {showCustomRange || preset === "custom" ? (
            <DateRangeControls
              draftFrom={draftFrom}
              draftTo={draftTo}
              setDraftFrom={setDraftFrom}
              setDraftTo={setDraftTo}
              onApply={() => {
                setPreset("custom");
                applyRange();
              }}
            />
          ) : null}
        </div>
        {appliedFrom && appliedTo ? (
          <p className="mt-3 text-sm font-medium tabular-nums">
            Showing {formatCalendarDate(appliedFrom)} – {formatCalendarDate(appliedTo)} (IST)
          </p>
        ) : null}
      </section>

      {data?.coverage ? (
        <ImportedDataCoverageBlock
          coverage={data.coverage}
          importedSpan={importedSpan}
          reportingFrom={appliedFrom}
          reportingTo={appliedTo}
        />
      ) : null}

      {overview.isLoading ? <LoadingBlock label="Loading historical analytics…" /> : null}
      {overview.isError ? <ErrorBlock message="Could not load historical analytics." /> : null}

      {data ? (
        <>
          <SectionHeader
            title="Key metrics"
            description="Counts and timing for the selected reporting period."
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Tickets created"
              value={data.periodActivity.ticketsCreated}
              onDrill={() => openPeriodActivity("created")}
            />
            <StatCard
              title="Tickets resolved"
              value={data.periodActivity.ticketsResolved}
              onDrill={() => openPeriodActivity("resolved")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TimingCard title="First response time" metric={data.periodActivity.firstResponseTime} />
            <TimingCard title="Resolution time" metric={data.periodActivity.resolutionTime} />
          </div>

          {dailyForCalendar.length > 0 && appliedFrom && appliedTo ? (
            <>
              <SectionHeader
                title="Daily activity"
                description="Created and resolved counts per day within the reporting period."
                action={
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDailyTable((v) => !v)}>
                    {showDailyTable ? "Show calendar" : "Show table"}
                  </Button>
                }
              />
              {showDailyTable ? (
                <DataTableShell>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2">Date (IST)</th>
                        <th className="px-3 py-2 text-right">Created</th>
                        <th className="px-3 py-2 text-right">Resolved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyForCalendar.map((row) => (
                        <tr key={row.date} className="border-b border-border/60">
                          <td className="px-3 py-2">{formatCalendarDate(row.date)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={row.created === 0}
                              className="tabular-nums text-sky-700 hover:underline disabled:text-muted-foreground disabled:no-underline dark:text-sky-300"
                              onClick={() => openDayActivity(row.date, "created")}
                            >
                              {row.created}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={row.resolved === 0}
                              className="tabular-nums text-emerald-700 hover:underline disabled:text-muted-foreground disabled:no-underline dark:text-emerald-300"
                              onClick={() => openDayActivity(row.date, "resolved")}
                            >
                              {row.resolved}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              ) : (
                <SupportAnalyticsActivityCalendar
                  from={appliedFrom}
                  to={appliedTo}
                  daily={dailyForCalendar}
                  selectedDate={null}
                  activityKind="created"
                  onPick={(date, kind) => {
                    if (date) openDayActivity(date, kind);
                  }}
                />
              )}
            </>
          ) : null}

          {advanced.data ? (
            <>
              <SectionHeader
                title="Volume & trends"
                description="Creation patterns and net change use the reporting period. Open ticket aging uses the latest import snapshot."
              />
              <AdvancedSummaryGrid advanced={advanced.data} />
              {advanced.data.insights.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {advanced.data.insights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

        </>
      ) : null}

      <ManageHistoricalDataSheet
        open={manageDataOpen}
        onOpenChange={setManageDataOpen}
        canImport={canImport}
        importFrom={importFrom}
        importTo={importTo}
        setImportFrom={setImportFrom}
        setImportTo={setImportTo}
        onUploadFile={(file) => upload.mutate(file)}
        uploadPending={upload.isPending}
        onRequestExport={async () => {
          await startExport.mutateAsync();
        }}
        exportPending={startExport.isPending}
        exportBlocked={Boolean(activeExportJob)}
        lastFreshdeskRange={lastFreshdeskRange}
        exports={exportJobs}
        activeExportJob={activeExportJob}
        onRetryFailed={async (id) => {
          try {
            await retryFailedExportJob(id);
            toast.success("Import retry started.");
            await exportsQuery.refetch();
            qc.invalidateQueries({ queryKey: ["support-analytics"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Retry failed");
          }
        }}
      />

      <SupportAnalyticsTicketExplorerModal
        request={explorerRequest}
        onClose={() => setExplorerRequest(null)}
      />
    </div>
  );
}

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom" },
];

function PresetGroup({ preset, onSelect }: { preset: DatePresetId; onSelect: (p: DatePresetId) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={preset === p.id ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => onSelect(p.id)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function AdvancedSummaryGrid({ advanced }: { advanced: AdvancedAnalytics }) {
  const maxHour = Math.max(1, ...advanced.volume.hourCreatedHeatmap.map((h) => h.created));
  const maxWeekday = Math.max(1, ...advanced.volume.weekdayCreated.map((w) => w.created));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard title="Net change (period)" value={advanced.volume.netChange} />
      <div className="rounded-xl border border-border bg-card p-4 text-sm sm:col-span-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">Creation patterns (IST, selected period)</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="min-w-[8rem] flex-1">
            <p className="mb-1 text-[10px] text-muted-foreground">By weekday</p>
            <div className="flex items-end gap-1">
              {advanced.volume.weekdayCreated.map((w) => (
                <div
                  key={w.weekday}
                  title={`${WEEKDAY_LABELS[w.weekday - 1]} — ${w.created} created`}
                  className="flex min-w-[1.4rem] flex-col items-center gap-0.5"
                >
                  <div
                    className="w-full min-h-[4px] rounded-sm bg-sky-500/70"
                    style={{ height: `${8 + (w.created / maxWeekday) * 36}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground">{WEEKDAY_LABELS[w.weekday - 1]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-[12rem] flex-[2]">
            <p className="mb-1 text-[10px] text-muted-foreground">By hour</p>
            <div className="flex flex-wrap gap-0.5">
              {advanced.volume.hourCreatedHeatmap.map((h) => (
                <div
                  key={h.hourIst}
                  title={`${h.hourIst}:00 — ${h.created} created`}
                  className="flex min-w-[1.05rem] flex-col items-center justify-end rounded-sm bg-sky-500/20 text-[9px] tabular-nums"
                  style={{
                    opacity: 0.25 + (h.created / maxHour) * 0.75,
                    height: `${16 + (h.created / maxHour) * 28}px`,
                  }}
                >
                  {h.created > 0 ? h.created : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-sm sm:col-span-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Open ticket aging (import snapshot)</p>
        <p className="mt-1 text-xs text-muted-foreground">{advanced.backlogAging.label}</p>
        <p className="mt-2 flex flex-wrap gap-2 text-xs">
          {advanced.backlogAging.buckets.map((b) => (
            <span key={b.bucket} className="rounded-md bg-muted px-2 py-1">
              {b.bucket}: {formatNumber(b.count)}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function DateRangeControls({
  draftFrom,
  draftTo,
  setDraftFrom,
  setDraftTo,
  onApply,
}: {
  draftFrom: string;
  draftTo: string;
  setDraftFrom: (v: string) => void;
  setDraftTo: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <>
      <DateFieldInput label="From (IST)" value={draftFrom} onChange={setDraftFrom} />
      <DateFieldInput label="To (IST)" value={draftTo} onChange={setDraftTo} />
      <Button size="sm" onClick={onApply}>
        Apply range
      </Button>
    </>
  );
}

function DateFieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="date" className="h-9 w-40" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ImportedDataCoverageBlock({
  coverage,
  importedSpan,
  reportingFrom,
  reportingTo,
}: {
  coverage: HistoricalOverview["coverage"];
  importedSpan: { from: string; to: string } | null;
  reportingFrom: string;
  reportingTo: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-3 text-sm">
      <p className="font-medium text-foreground">Imported data on file</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNumber(coverage.canonicalTicketCount)} tickets from {formatNumber(coverage.successfulImports)} successful
        import(s)
        {importedSpan ? (
          <>
            {" "}
            · ticket <strong>created</strong> dates in files span {formatCalendarDate(importedSpan.from)} –{" "}
            {formatCalendarDate(importedSpan.to)} (IST)
          </>
        ) : null}
      </p>
      {reportingFrom && reportingTo && importedSpan ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reporting period {formatCalendarDate(reportingFrom)} – {formatCalendarDate(reportingTo)} is a view over this
          stored data. To add tickets from other dates, use Manage Historical Data.
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, onDrill }: { title: string; value: number; onDrill?: () => void }) {
  return (
    <button
      type="button"
      onClick={onDrill}
      className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40"
    >
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
    </button>
  );
}

function TimingCard({ title, metric }: { title: string; metric: DurationMetric }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      {metric.available ? (
        <p className="mt-2 text-lg font-semibold">
          Avg {formatMs(metric.averageMs)} · Median {formatMs(metric.medianMs)} (n={metric.count})
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">—</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
    </div>
  );
}

