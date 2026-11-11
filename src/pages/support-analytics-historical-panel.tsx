import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { ErrorBlock, LoadingBlock, SectionHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiFormData } from "@/lib/api";
import { toast } from "sonner";
import { formatCalendarDate, formatNumber } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { type DatePresetId, resolveDatePreset } from "@/lib/support-analytics-date-presets";
import { SupportAnalyticsActivityCalendar } from "@/components/support-analytics/activity-calendar";
import { HistoricalDayDetailDialog } from "@/components/support-analytics/historical-day-detail-dialog";
import {
  HistoricalCountCard,
  HistoricalCsatCard,
  HistoricalDurationInline,
  type DurationMetricUi,
  type CsatMetricUi,
} from "@/components/support-analytics/historical-metric-card";
import { HistoricalOperationalInsights } from "@/components/support-analytics/historical-operational-insights";
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

type DurationMetric = DurationMetricUi & { note?: string; resolutionTimestampPolicy?: string };

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
    netChange: number;
    firstResponseTime: DurationMetric;
    resolutionTime: DurationMetric;
    csat: CsatMetricUi;
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

type AdvancedAnalytics = {
  volume: {
    createdInRange: number;
    resolvedInRange: number;
    netChange: number;
    dailyTrend: { date: string; created: number; resolved: number; net: number }[];
    weekdayCreated: { weekday: number; created: number }[];
    hourCreatedHeatmap: { hourIst: number; created: number }[];
    unusualDay?: { date: string; created: number; resolved: number; net: number } | null;
  };
  backlogAging: { label: string; buckets: { bucket: string; count: number }[] };
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
  const [manageDataOpen, setManageDataOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
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

  function openDayActivity(date: string, kind: "created" | "resolved") {
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
        <p className="text-sm text-muted-foreground">Imported Freshdesk exports only — not combined with Live sync.</p>
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
        <SectionHeader className="mb-2" title="Reporting period" />
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
        <ImportedDataCoverageBlock coverage={data.coverage} importedSpan={importedSpan} />
      ) : null}

      {overview.isLoading ? <LoadingBlock label="Loading historical analytics…" /> : null}
      {overview.isError ? <ErrorBlock message="Could not load historical analytics." /> : null}

      {data ? (
        <>
          <SectionHeader title="Key metrics" className="mt-2" />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <HistoricalCountCard
              label="Created"
              value={data.periodActivity.ticketsCreated}
              onClick={() => openPeriodActivity("created")}
            />
            <HistoricalCountCard
              label="Resolved"
              value={data.periodActivity.ticketsResolved}
              onClick={() => openPeriodActivity("resolved")}
            />
            <HistoricalCountCard
              label="Net change"
              value={data.periodActivity.netChange ?? data.periodActivity.ticketsCreated - data.periodActivity.ticketsResolved}
              tone={
                (data.periodActivity.netChange ?? 0) > 0
                  ? "negative"
                  : (data.periodActivity.netChange ?? 0) < 0
                    ? "positive"
                    : "neutral"
              }
              hint="Created minus resolved in the reporting period."
            />
            <HistoricalDurationInline
              label="First response"
              metric={data.periodActivity.firstResponseTime}
              sublabel="Tickets created in period"
            />
            <HistoricalDurationInline
              label="Resolution time"
              metric={data.periodActivity.resolutionTime}
              sublabel="Tickets resolved in period"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <HistoricalCsatCard csat={data.periodActivity.csat} />
          </div>

          {dailyForCalendar.length > 0 && appliedFrom && appliedTo ? (
            <>
              <SectionHeader title="Daily activity" className="mt-2" />
              <SupportAnalyticsActivityCalendar
                from={appliedFrom}
                to={appliedTo}
                daily={dailyForCalendar}
                selectedDate={dayDetailDate}
                onDayClick={(date) => setDayDetailDate(date)}
              />
            </>
          ) : null}

          {advanced.data ? <HistoricalOperationalInsights advanced={advanced.data} /> : null}

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

      <HistoricalDayDetailDialog
        dateIst={dayDetailDate}
        open={dayDetailDate != null}
        onOpenChange={(open) => {
          if (!open) setDayDetailDate(null);
        }}
        onExploreCreated={(date) => {
          setDayDetailDate(null);
          openDayActivity(date, "created");
        }}
        onExploreResolved={(date) => {
          setDayDetailDate(null);
          openDayActivity(date, "resolved");
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
}: {
  coverage: HistoricalOverview["coverage"];
  importedSpan: { from: string; to: string } | null;
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
    </div>
  );
}

