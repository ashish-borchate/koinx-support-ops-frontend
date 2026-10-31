import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MoreHorizontal, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { IstDatePicker } from "@/components/ui/ist-date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTableShell, Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { api, download } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compareKpiTone, earnedPointsTone, kpiToneBorder } from "@/lib/kpi-metric-tone";
import {
  formatDurationHours,
  formatMonth,
  formatNumber,
  formatWeek,
  currentWeekStart,
  monthKey,
  recentMonths,
  recentWeeks,
  type Metric,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { KpiBreakdownDialog, type KpiBreakdownRequest } from "@/components/kpi-breakdown-dialog";
import { KpiFreshdeskImportDialog } from "@/components/kpi-freshdesk-import-dialog";
import { KpiDurationField } from "@/components/kpi-duration-field";
import { MetricBreakdownCardGrid, type MetricBreakdownCardItem } from "@/components/kpi/scorecard-breakdown-panel";
import { hoursToDurationComponents } from "@/lib/kpi-duration";

type KpiGoals = {
  firstResponseHours: number;
  resolutionHours: number;
  csatPercent: number;
  slaPercent: number;
  scheduleAdherencePercent: number;
};

type KpiScoreMetricRow = {
  id: string;
  label: string;
  actualLabel: string;
  target: number | null;
  weight: number;
  points: number | null;
  pointsDisplay: string;
};

type KpiScorecard = {
  scoringConfigured: boolean;
  compositeScore: number | null;
  compositeDisplay: string;
  statusMessage: string | null;
  qaEvaluationCount: number;
  qaAverage: number | null;
  metrics: KpiScoreMetricRow[];
};

type KpiScoringConfig = {
  weights: Record<string, number>;
  targets: Record<string, number | null>;
  targetsExplicit: Record<string, boolean>;
  scoringConfigured: boolean;
  versionId?: string;
  versionNumber?: number;
  effectiveFrom?: string;
  configurationLabel?: string;
};

type KpiConfigVersionRow = {
  id: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveMonthLabel: string;
  status: "active" | "scheduled" | "historical" | "cancelled";
  targets: Record<string, number | null>;
  weights: Record<string, number>;
  changeReason: string;
  source: string;
  createdAt: string;
  createdByName: string;
  cancelledAt?: string | null;
  revisions: {
    at: string;
    actorName: string;
    reason: string;
    previousTargets: Record<string, number | null>;
    previousWeights: Record<string, number>;
  }[];
};

type RecordRow = {
  id: string;
  agentId: string;
  agentName: string;
  periodType?: "weekly" | "monthly";
  periodStart?: string;
  periodEnd?: string;
  weekStart: string;
  ticketsHandled: Metric;
  firstResponseHours: Metric;
  averageResponseHours: Metric;
  resolutionHours: Metric;
  csatPercent: Metric;
  dsatPercent: Metric;
  slaPercent: Metric;
  csatPositiveCount: Metric;
  csatNegativeCount: Metric;
  csatNeutralCount: Metric;
  csatInputMode?: "survey_counts" | "percent_only" | "none";
  legacyPercentOnly?: boolean;
  reportingComplete?: boolean;
  surveyTotalAnswered?: number | null;
  zeroSurveyResponses?: boolean;
  reopened: Metric;
  coachingHours: Metric;
  scheduleAdherencePercent: Metric;
  notes: string;
  scorecard?: KpiScorecard;
};

type TeamSummary = {
  ticketsHandled: number;
  firstResponseHours: Metric | null;
  averageResponseHours: Metric | null;
  resolutionHours: Metric | null;
  csatPercent: Metric | null;
  dsatPercent: Metric | null;
  slaPercent: Metric | null;
  surveyTotals?: {
    positive: number;
    negative: number;
    neutral: number;
    totalAnswered: number;
    zeroSurveys: boolean;
  };
};

type AgentDirectoryEntry = { id: string; name: string };

type WeeklyTeamArtRecord = {
  weekStart: string;
  averageResponseHours: number;
  duration: { hours: number; minutes: number; seconds: number; milliseconds: number };
};

type KpiPayload = {
  periodType?: "weekly" | "monthly";
  month?: string;
  periodStart?: string;
  periodEnd?: string;
  weekStart: string;
  label: string;
  partial: boolean;
  goals: KpiGoals;
  scoringConfig: KpiScoringConfig;
  teamSummary: TeamSummary | null;
  weeklyTeamArt?: WeeklyTeamArtRecord | null;
  qaTeamAverage: number | null;
  qaByAgent: Record<string, number>;
  qaByAgentCounts?: Record<string, number>;
  qaTeamAgentCount?: number;
  qaReviewCount?: number;
  scorecardsByAgent?: Record<string, KpiScorecard>;
  records: RecordRow[];
  agents?: AgentDirectoryEntry[];
};

type KpiDisplayRow = RecordRow & { hasKpiData: boolean };

type SummaryMetric = {
  id: string;
  label: string;
  value: string;
  target: string;
  weightLine: string;
  tone: "success" | "warning" | "critical" | "neutral";
};

const toneBorder = kpiToneBorder;

function metricValue(metric: Metric | null | undefined) {
  return metric?.value ?? null;
}

const compareTone = compareKpiTone;

function previewCsatFromCounts(positive: number, negative: number, neutral: number) {
  const total = positive + negative + neutral;
  if (total <= 0) return { total: 0, csatPercent: 0, dsatPercent: 0, zeroSurveys: true };
  return {
    total,
    csatPercent: Math.round((positive / total) * 1000) / 10,
    dsatPercent: Math.round(((negative + neutral) / total) * 1000) / 10,
    zeroSurveys: false,
  };
}

function csatDisplayLabel(row: RecordRow | null, team: TeamSummary | null, csat: number | null) {
  if (row?.zeroSurveyResponses || team?.surveyTotals?.zeroSurveys) return "No survey responses";
  if (csat == null) return "N/A";
  return `${formatNumber(csat, 1)}%`;
}

const SUMMARY_SCORECARD_IDS = ["frt", "avgResponse", "resolution", "sla", "csat", "qa"] as const;
const SUMMARY_TO_SCORECARD: Record<(typeof SUMMARY_SCORECARD_IDS)[number], string> = {
  frt: "frt",
  avgResponse: "art",
  resolution: "resolution",
  sla: "sla",
  csat: "csat",
  qa: "qa",
};

const SUMMARY_TARGET_KEYS: Record<(typeof SUMMARY_SCORECARD_IDS)[number], keyof KpiScoringConfig["targets"]> = {
  frt: "firstResponseHours",
  avgResponse: "averageResponseHours",
  resolution: "resolutionHours",
  sla: "slaPercent",
  csat: "csatPercent",
  qa: "qaPercent",
};

const SCORECARD_TO_SUMMARY: Record<string, (typeof SUMMARY_SCORECARD_IDS)[number]> = {
  frt: "frt",
  art: "avgResponse",
  resolution: "resolution",
  sla: "sla",
  csat: "csat",
  qa: "qa",
};

const SUMMARY_WEIGHT_KEYS: Record<(typeof SUMMARY_SCORECARD_IDS)[number], keyof KpiScoringConfig["weights"]> = {
  frt: "firstResponseHours",
  avgResponse: "averageResponseHours",
  resolution: "resolutionHours",
  sla: "slaPercent",
  csat: "csatPercent",
  qa: "qaPercent",
};

function configuredTargetValue(config: KpiScoringConfig, summaryId: (typeof SUMMARY_SCORECARD_IDS)[number]): number | null {
  if (!config.scoringConfigured) return null;
  const key = SUMMARY_TARGET_KEYS[summaryId];
  if (!config.targetsExplicit[key]) return null;
  const value = config.targets[key];
  return value == null || Number.isNaN(value) ? null : value;
}

function summaryTargetLabel(config: KpiScoringConfig, summaryId: (typeof SUMMARY_SCORECARD_IDS)[number]): string {
  const t = configuredTargetValue(config, summaryId);
  if (t == null) return "Target not configured";
  if (summaryId === "frt" || summaryId === "avgResponse" || summaryId === "resolution") {
    return `Target ≤ ${formatDurationHours(t)}`;
  }
  if (summaryId === "qa") return `Target ≥ ${formatNumber(t, 0)}/100`;
  return `Target ≥ ${formatNumber(t, 0)}%`;
}

function summaryMetricWeight(config: KpiScoringConfig, summaryId: (typeof SUMMARY_SCORECARD_IDS)[number]): number {
  return config.weights[SUMMARY_WEIGHT_KEYS[summaryId]];
}

function buildSummaryMetrics(
  scoringConfig: KpiScoringConfig,
  team: TeamSummary | null,
  qaTeam: number | null,
  record: RecordRow | null,
  qaAgent: number | null,
  scorecard?: KpiScorecard | null,
  options?: {
    agentId: string | null;
    qaCount: number;
    teamOverview: boolean;
    qaTeamReviewCount: number;
    qaTeamAgentCount: number;
  },
): SummaryMetric[] {
  const frt = record ? metricValue(record.firstResponseHours) : metricValue(team?.firstResponseHours);
  const art = record ? metricValue(record.averageResponseHours) : metricValue(team?.averageResponseHours);
  const res = record ? metricValue(record.resolutionHours) : metricValue(team?.resolutionHours);
  const sla = record ? metricValue(record.slaPercent) : metricValue(team?.slaPercent);
  const csat = record ? metricValue(record.csatPercent) : metricValue(team?.csatPercent);
  const teamOverview = options?.teamOverview ?? false;
  const qaCount = teamOverview
    ? options?.qaTeamReviewCount ?? 0
    : options?.agentId != null
      ? options.qaCount
      : record?.scorecard?.qaEvaluationCount ?? scorecard?.qaEvaluationCount ?? 0;
  const qaTeamAgentCount = options?.qaTeamAgentCount ?? 0;
  const qa = teamOverview ? qaTeam : options?.agentId != null ? qaAgent : record ? qaAgent : qaTeam;

  const toneFor = (summaryId: (typeof SUMMARY_SCORECARD_IDS)[number], value: number | null, direction: "lte" | "gte") => {
    const goal = configuredTargetValue(scoringConfig, summaryId);
    return compareTone(value, goal, direction);
  };

  const metrics = [
    {
      id: "frt",
      label: "First Response Time",
      value: formatDurationHours(frt),
      target: summaryTargetLabel(scoringConfig, "frt"),
      tone: toneFor("frt", frt, "lte"),
      weightLine: "",
    },
    {
      id: "avgResponse",
      label: "Average Response Time",
      value:
        teamOverview && art == null
          ? "Not recorded"
          : teamOverview && art != null
            ? formatDurationHours(art)
            : formatDurationHours(art),
      target: summaryTargetLabel(scoringConfig, "avgResponse"),
      tone: teamOverview && art == null ? "neutral" : toneFor("avgResponse", art, "lte"),
      weightLine: "",
    },
    {
      id: "resolution",
      label: "Resolution Time",
      value: formatDurationHours(res),
      target: summaryTargetLabel(scoringConfig, "resolution"),
      tone: toneFor("resolution", res, "lte"),
      weightLine: "",
    },
    {
      id: "sla",
      label: "SLA",
      value: sla == null ? "N/A" : `${formatNumber(sla, 1)}%`,
      target: summaryTargetLabel(scoringConfig, "sla"),
      tone: toneFor("sla", sla, "gte"),
      weightLine: "",
    },
    {
      id: "csat",
      label: "CSAT",
      value: csatDisplayLabel(record, team, csat),
      target: summaryTargetLabel(scoringConfig, "csat"),
      tone: toneFor("csat", csat, "gte"),
      weightLine: "",
    },
    {
      id: "qa",
      label: "QA",
      value:
        qaCount === 0 && (record != null || options?.agentId != null || teamOverview)
          ? "No QA evaluations"
          : qa == null
            ? "N/A"
            : `${formatNumber(qa, 1)}/100`,
      target: summaryTargetLabel(scoringConfig, "qa"),
      tone: toneFor("qa", qa, "gte"),
      weightLine: "",
    },
  ] satisfies SummaryMetric[];

  return metrics.map((item) => {
    const scoreId = SUMMARY_TO_SCORECARD[item.id as (typeof SUMMARY_SCORECARD_IDS)[number]];
    const scored = scorecard?.metrics.find((m) => m.id === scoreId);
    const weight = summaryMetricWeight(scoringConfig, item.id as (typeof SUMMARY_SCORECARD_IDS)[number]);
    let weightLine: string;
    if (!scoringConfig.scoringConfigured) {
      weightLine = "Weights not configured";
    } else if (teamOverview && item.id === "qa" && qaTeamAgentCount > 0) {
      weightLine = `${qaTeamAgentCount} evaluated agents · ${qaCount} reviews`;
    } else if (teamOverview) {
      weightLine = `Weight ${weight}`;
    } else if (item.id === "qa" && qaCount > 0) {
      weightLine = `${qaCount} review${qaCount === 1 ? "" : "s"}`;
    } else if (scored?.points != null) {
      weightLine = `Weight ${scored.weight} · Earned ${scored.pointsDisplay}`;
    } else if (scored) {
      weightLine = `Weight ${scored.weight}`;
    } else {
      weightLine = `Weight ${weight}`;
    }
    return { ...item, weightLine };
  });
}

function emptyKpiMetric(): Metric {
  return { value: null, freshdeskValue: null, source: "manual", provenance: "user" };
}

function buildKpiDisplayRows(agents: AgentDirectoryEntry[], records: RecordRow[]): KpiDisplayRow[] {
  const byAgent = new Map(records.map((row) => [row.agentId, row]));
  return agents.map((agent) => {
    const rec = byAgent.get(agent.id);
    if (rec) return { ...rec, hasKpiData: true };
    return {
      id: `missing-kpi-${agent.id}`,
      agentId: agent.id,
      agentName: agent.name,
      weekStart: "",
      hasKpiData: false,
      ticketsHandled: emptyKpiMetric(),
      firstResponseHours: emptyKpiMetric(),
      averageResponseHours: emptyKpiMetric(),
      resolutionHours: emptyKpiMetric(),
      csatPercent: emptyKpiMetric(),
      dsatPercent: emptyKpiMetric(),
      slaPercent: emptyKpiMetric(),
      csatPositiveCount: emptyKpiMetric(),
      csatNegativeCount: emptyKpiMetric(),
      csatNeutralCount: emptyKpiMetric(),
      reopened: emptyKpiMetric(),
      coachingHours: emptyKpiMetric(),
      scheduleAdherencePercent: emptyKpiMetric(),
      notes: "",
    };
  });
}

function agentStatus(
  row: KpiDisplayRow,
  scoringConfig: KpiScoringConfig,
  periodType: "weekly" | "monthly",
) {
  if (!row.hasKpiData) {
    return {
      label: periodType === "monthly" ? "Monthly data not entered" : "Weekly data not entered",
      className: "text-muted-foreground",
    };
  }
  const slaGoal = configuredTargetValue(scoringConfig, "sla") ?? null;
  const csatGoal = configuredTargetValue(scoringConfig, "csat") ?? null;
  if (row.legacyPercentOnly) {
    return { label: "Legacy CSAT % only", className: "text-muted-foreground" };
  }
  if (!row.reportingComplete) {
    return { label: "Incomplete", className: "text-amber-800 dark:text-amber-200" };
  }
  const sla = row.slaPercent.value;
  const csat = row.csatPercent.value;
  if (sla == null && csat == null) return { label: "Complete", className: "text-muted-foreground" };
  const needs =
    (sla != null && slaGoal != null && sla < slaGoal) || (csat != null && csatGoal != null && csat < csatGoal);
  return needs
    ? { label: "Complete · Needs attention", className: "text-amber-800 dark:text-amber-200" }
    : { label: "Complete", className: "text-emerald-800 dark:text-emerald-200" };
}

function totalChats(records: RecordRow[]) {
  return records.reduce((sum, row) => sum + (row.ticketsHandled.value ?? 0), 0);
}

function WeeklyTeamArtCard({
  week,
  weekLabel,
  record,
  canEdit,
}: {
  week: string;
  weekLabel: string;
  record: WeeklyTeamArtRecord | null | undefined;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const [hours, setHours] = useState("");
  const [editing, setEditing] = useState(false);

  const persisted = record != null;
  const savedHours = record ? String(record.averageResponseHours) : "";

  useEffect(() => {
    if (editing) {
      setHours(savedHours);
    } else {
      setHours(savedHours);
    }
  }, [record, week, editing, savedHours]);

  const save = useMutation({
    mutationFn: () => {
      if (hours.trim() === "" || Number.isNaN(Number(hours))) {
        throw new Error("Enter team average response time.");
      }
      const duration = hoursToDurationComponents(Number(hours));
      return api("/api/kpi/weekly-team-art", {
        method: "PUT",
        body: JSON.stringify({ weekStart: week, duration }),
      });
    },
    onSuccess: () => {
      toast.success(persisted ? "Team ART updated" : "Team ART saved");
      setEditing(false);
      void client.invalidateQueries({ queryKey: ["kpi"] });
      void client.invalidateQueries({ queryKey: ["management-overview"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const readOnlyDisplay = !canEdit || (persisted && !editing);
  const dirty = hours.trim() !== savedHours.trim();

  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Weekly team ART</p>
            {persisted && !editing ? (
              <span className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">
                Saved
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Reporting week: <span className="font-medium text-foreground">{weekLabel}</span>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Copy Average Response Time from Freshdesk Analytics → Helpdesk Performance → Response Time. Select the
            reporting week and relevant support group, and leave the Agent filter unselected.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-52">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Team ART (h)</Label>
            {canEdit && persisted && !editing ? (
              <Button type="button" size="sm" className="h-8 shrink-0" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
          </div>
          <KpiDurationField
            label="Team average response time"
            value={hours}
            onChange={setHours}
            disabled={readOnlyDisplay}
          />
          {!persisted && hours.trim() === "" ? (
            <p className="mt-1 text-[11px] text-muted-foreground" role="status">
              Not recorded
            </p>
          ) : null}
          {canEdit && (editing || !persisted) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {persisted && editing ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setHours(savedHours);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={save.isPending || hours.trim() === "" || (persisted && !dirty)}
                onClick={() => save.mutate()}
              >
                {persisted ? "Save changes" : "Save team ART"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function KpiPage() {
  const { can, canMutate } = useAuth();
  const [searchParams] = useSearchParams();
  const teamView = can("kpi.view_team");
  const ownKpiView = can("kpi.view_own");
  const canViewTeamAggregate = teamView || ownKpiView;
  const showAgentFilter = teamView || ownKpiView;
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [week, setWeek] = useState(() => currentWeekStart());
  const [month, setMonth] = useState(monthKey());
  const [agentFilter, setAgentFilter] = useState("all");

  useEffect(() => {
    const pt = searchParams.get("periodType");
    const weekParam = searchParams.get("week");
    const monthParam = searchParams.get("month");
    const agentParam = searchParams.get("agentId");
    if (pt === "monthly" && monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      setPeriodType("monthly");
      setMonth(monthParam);
    } else if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      setPeriodType("weekly");
      setWeek(weekParam);
    }
    if (agentParam && showAgentFilter) {
      setAgentFilter(agentParam);
    }
  }, [searchParams, showAgentFilter]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addPrefillAgentId, setAddPrefillAgentId] = useState<string | null>(null);
  const [editPrefill, setEditPrefill] = useState<{
    periodType: "weekly" | "monthly";
    week: string;
    month: string;
    agentId: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [breakdownRequest, setBreakdownRequest] = useState<KpiBreakdownRequest | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const openMetricBreakdown = (metricId: string, agentId?: string) => {
    const useTeam = canViewTeamAggregate && agentFilter === "all";
    setBreakdownRequest({
      periodType,
      week,
      month,
      scope: useTeam ? "team" : "agent",
      metric: metricId,
      agentId: useTeam ? undefined : agentId ?? (agentFilter !== "all" ? agentFilter : query.data?.records[0]?.agentId),
    });
    setBreakdownOpen(true);
  };

  const openOverallBreakdown = (agentId: string) => {
    setBreakdownRequest({
      periodType,
      week,
      month,
      scope: "agent",
      metric: "overall",
      agentId,
    });
    setBreakdownOpen(true);
  };

  const openAddKpi = (prefillAgentId?: string) => {
    setAddPrefillAgentId(prefillAgentId ?? null);
    setAddOpen(true);
  };

  const openEditKpi = (prefill?: {
    periodType?: "weekly" | "monthly";
    week?: string;
    month?: string;
    agentId?: string;
  }) => {
    setAddOpen(false);
    const agentId =
      prefill?.agentId ??
      (agentFilter !== "all" ? agentFilter : null) ??
      query.data?.agents?.[0]?.id ??
      query.data?.records[0]?.agentId ??
      "";
    setEditPrefill({
      periodType: prefill?.periodType ?? periodType,
      week: prefill?.week ?? week,
      month: prefill?.month ?? month,
      agentId,
    });
    setEditOpen(true);
  };

  const query = useQuery({
    queryKey: ["kpi", periodType, week, month],
    queryFn: () => {
      const params = new URLSearchParams({ periodType });
      if (periodType === "monthly") params.set("month", month);
      else params.set("week", week);
      return api<KpiPayload>(`/api/kpi?${params.toString()}`);
    },
  });

  const selectedRecord = useMemo(() => {
    if (!query.data) return null;
    if (agentFilter === "all") return null;
    return query.data.records.find((row) => row.agentId === agentFilter) ?? null;
  }, [agentFilter, query.data]);

  const activeScorecard = useMemo(() => {
    if (!query.data) return null;
    if (selectedRecord?.scorecard) return selectedRecord.scorecard;
    if (agentFilter !== "all") return query.data.scorecardsByAgent?.[agentFilter] ?? null;
    return null;
  }, [agentFilter, query.data, selectedRecord]);

  const summaryMetrics = useMemo(() => {
    if (!query.data) return [];
    const useTeam = canViewTeamAggregate && agentFilter === "all";
    const focusedAgentId = agentFilter !== "all" ? agentFilter : selectedRecord?.agentId ?? null;
    const qaAgent = focusedAgentId ? query.data.qaByAgent[focusedAgentId] ?? null : null;
    const qaCount = focusedAgentId ? query.data.qaByAgentCounts?.[focusedAgentId] ?? 0 : 0;
    return buildSummaryMetrics(
      query.data.scoringConfig,
      useTeam ? query.data.teamSummary : null,
      useTeam ? query.data.qaTeamAverage : null,
      selectedRecord,
      qaAgent,
      activeScorecard,
      {
        agentId: focusedAgentId,
        qaCount,
        teamOverview: useTeam,
        qaTeamReviewCount: query.data.qaReviewCount ?? 0,
        qaTeamAgentCount: query.data.qaTeamAgentCount ?? 0,
      },
    );
  }, [activeScorecard, agentFilter, canViewTeamAggregate, query.data, selectedRecord]);

  const workloadLabel = useMemo(() => {
    if (!query.data) return null;
    const chats =
      agentFilter === "all"
        ? query.data.teamSummary?.ticketsHandled ?? totalChats(query.data.records)
        : selectedRecord?.ticketsHandled.value;
    if (chats == null) return null;
    return `${formatNumber(chats, 0)} chats handled`;
  }, [agentFilter, query.data, selectedRecord]);

  const agents = useMemo(() => query.data?.agents ?? [], [query.data]);

  const displayRows = useMemo(() => {
    if (!query.data || !teamView) return [];
    const rows = buildKpiDisplayRows(agents, query.data.records).map((row) => ({
      ...row,
      scorecard: row.scorecard ?? query.data.scorecardsByAgent?.[row.agentId],
    }));
    if (agentFilter === "all") return rows;
    return rows.filter((row) => row.agentId === agentFilter);
  }, [agentFilter, agents, query.data, teamView]);

  const showAgentKpiEmpty =
    showAgentFilter &&
    agentFilter !== "all" &&
    query.data != null &&
    !query.data.records.some((row) => row.agentId === agentFilter) &&
    (query.data.qaByAgentCounts?.[agentFilter] ?? 0) === 0;

  const periodToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={periodType} onValueChange={(value) => setPeriodType(value as "weekly" | "monthly")}>
        <SelectTrigger className="h-9 w-[7.5rem] bg-card" aria-label="Period type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </SelectContent>
      </Select>
      {periodType === "weekly" ? (
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger className="h-9 w-[11rem] bg-card" aria-label="Reporting period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...recentWeeks()].reverse().map((item) => (
              <SelectItem key={item} value={item}>{formatWeek(item)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-[11rem] bg-card" aria-label="Reporting month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...recentMonths()].reverse().map((item) => (
              <SelectItem key={item} value={item}>{formatMonth(item)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showAgentFilter ? (
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-9 w-[10rem] bg-card" aria-label="Agent filter">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canMutate("kpi.edit") ? (
        <>
          <Button size="sm" className="h-9" onClick={() => setImportOpen(true)}>
            Import Freshdesk PDF
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => openAddKpi()}>
            <Plus className="size-4" />
            Add KPI Data
          </Button>
          <Button size="sm" className="h-9" onClick={() => openEditKpi()}>
            Edit KPI Data
          </Button>
        </>
      ) : null}
      {canMutate("kpi.manage_goals") ? (
        <Button size="sm" variant="outline" className="h-9 w-9 px-0" aria-label="KPI settings" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-4" />
        </Button>
      ) : null}
      {can("kpi.view_team") ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-9 w-9 px-0" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={periodType === "monthly"}
              onClick={() => {
                if (periodType === "monthly") return;
                download(`/api/kpi/export?week=${week}`, `kpi-${week}.csv`).catch((error) => toast.error(error.message));
              }}
            >
              Export CSV (weekly)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="KPI Performance"
        description=""
        className="mb-2 gap-3 sm:items-start"
        secondaryAction={periodToolbar}
        action={headerActions}
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}

      {query.data ? (
        <>
          {periodType === "weekly" ? (
            <p className="text-xs text-muted-foreground">
              Weekly agent performance across support and quality metrics.
              {query.data.scoringConfig?.configurationLabel ? (
                <>
                  <br />
                  Scoring Targets configuration: {query.data.scoringConfig.configurationLabel}
                  {query.data.partial ? (
                    <> | This week is still open. Numbers may change until the week closes.</>
                  ) : null}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Monthly agent performance from independently entered calendar-month KPI records.
              {query.data.scoringConfig?.configurationLabel ? (
                <>
                  <br />
                  Scoring Targets configuration: {query.data.scoringConfig.configurationLabel}
                  {query.data.partial ? (
                    <> | This calendar month is still in progress. Enter monthly Freshdesk metrics when available.</>
                  ) : null}
                </>
              ) : null}
            </p>
          )}

          {periodType === "weekly" && canViewTeamAggregate ? (
            <WeeklyTeamArtCard
              week={week}
              weekLabel={query.data.label}
              record={query.data.weeklyTeamArt}
              canEdit={canMutate("kpi.edit")}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {summaryMetrics.map((metric) => (
              <button
                type="button"
                key={metric.id}
                onClick={() => openMetricBreakdown(metric.id)}
                className={cn(
                  "flex min-h-[7.25rem] flex-col rounded-lg border px-3 py-3 text-left shadow-[var(--shadow-card)] transition-colors",
                  "cursor-pointer hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  toneBorder[metric.tone],
                )}
              >
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{metric.label}</p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">{metric.value}</p>
                <div className="mt-auto pt-2">
                  <p className="text-[11px] leading-snug text-muted-foreground">{metric.target}</p>
                  <div className="my-2 border-t border-border/40" aria-hidden />
                  <p className="text-[11px] tabular-nums text-muted-foreground">{metric.weightLine}</p>
                </div>
              </button>
            ))}
          </div>

          {activeScorecard && agentFilter !== "all" ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const id = agentFilter !== "all" ? agentFilter : selectedRecord?.agentId ?? query.data?.records[0]?.agentId;
                  if (id) openOverallBreakdown(id);
                }}
                className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
              >
                <p className="text-sm font-medium text-muted-foreground">Overall KPI score</p>
                <p className="text-center text-xs font-medium text-primary">Click for detailed view</p>
                <p className="text-right text-2xl font-semibold tabular-nums tracking-tight">{activeScorecard.compositeDisplay}</p>
              </button>
              {activeScorecard.statusMessage ? (
                <p className="text-xs text-muted-foreground">{activeScorecard.statusMessage}</p>
              ) : null}
              {!selectedRecord && (query.data.qaByAgentCounts?.[agentFilter] ?? 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Freshdesk KPI metrics are not entered for this period. QA is included from Agent QA reviews.
                </p>
              ) : null}
            </div>
          ) : canViewTeamAggregate && agentFilter === "all" ? (
            <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
              Select an agent to view an individual overall KPI score. Team composite scores are not shown.
            </p>
          ) : query.data.scoringConfig && !query.data.scoringConfig.scoringConfigured ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              KPI scoring not configured — an admin must set all six targets and weights.
            </p>
          ) : null}

          {teamView ? (
            <>
              {showAgentKpiEmpty ? (
                <div className="space-y-3">
                  <Empty
                    title="No KPI data for this period"
                    body={
                      periodType === "monthly"
                        ? "Monthly KPI has not been entered for this agent yet."
                        : "Weekly KPI has not been entered for this agent yet."
                    }
                  />
                  {canMutate("kpi.edit") ? (
                    <Button size="sm" onClick={() => openAddKpi(agentFilter)}>Add KPI data</Button>
                  ) : null}
                </div>
              ) : (
                <AgentPerformanceSection
                  rows={displayRows}
                  periodType={periodType}
                  scoringConfig={query.data.scoringConfig}
                  qaByAgent={query.data.qaByAgent}
                  workloadLabel={workloadLabel}
                  expandedId={expandedId}
                  canAddKpi={canMutate("kpi.edit")}
                  onAddKpi={openAddKpi}
                  onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                  onOverallClick={openOverallBreakdown}
                />
              )}
            </>
          ) : ownKpiView && agentFilter !== "all" ? (
            showAgentKpiEmpty ? (
              <Empty
                title="No KPI data for this period"
                body={
                  periodType === "monthly"
                    ? "Monthly KPI has not been entered for you yet."
                    : "Weekly KPI has not been entered for you yet."
                }
              />
            ) : (
              <OwnPerformanceSection
                record={selectedRecord ?? undefined}
                scoringConfig={query.data.scoringConfig}
                qa={query.data.qaByAgent[agentFilter]}
              />
            )
          ) : null}
        </>
      ) : null}

      {addOpen && query.data ? (
        <KpiDataEntryDialog
          mode="add"
          periodType={periodType}
          week={week}
          month={month}
          agents={agents}
          initialAgentId={addPrefillAgentId}
          onClose={() => {
            setAddOpen(false);
            setAddPrefillAgentId(null);
          }}
          onSwitchToEdit={(prefill) => {
            setAddOpen(false);
            setAddPrefillAgentId(null);
            openEditKpi(prefill);
          }}
        />
      ) : null}
      {editOpen && query.data ? (
        <KpiDataEntryDialog
          mode="edit"
          periodType={editPrefill?.periodType ?? periodType}
          week={editPrefill?.week ?? week}
          month={editPrefill?.month ?? month}
          agents={agents}
          initialAgentId={editPrefill?.agentId ?? null}
          onClose={() => {
            setEditOpen(false);
            setEditPrefill(null);
          }}
        />
      ) : null}
      {settingsOpen ? <KpiSettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
      <KpiBreakdownDialog
        request={breakdownRequest}
        open={breakdownOpen}
        onOpenChange={(next) => {
          setBreakdownOpen(next);
          if (!next) setBreakdownRequest(null);
        }}
      />
      <KpiFreshdeskImportDialog open={importOpen} onOpenChange={setImportOpen} agents={agents} />
    </div>
  );
}

function AgentPerformanceSection({
  rows,
  periodType,
  scoringConfig,
  qaByAgent,
  workloadLabel,
  expandedId,
  canAddKpi,
  onAddKpi,
  onToggle,
  onOverallClick,
}: {
  rows: KpiDisplayRow[];
  periodType: "weekly" | "monthly";
  scoringConfig: KpiScoringConfig;
  qaByAgent: Record<string, number>;
  workloadLabel: string | null;
  expandedId: string | null;
  canAddKpi: boolean;
  onAddKpi: (agentId: string) => void;
  onToggle: (id: string) => void;
  onOverallClick: (agentId: string) => void;
}) {
  return (
    <section>
      <SectionHeader
        title="Agent performance"
        action={workloadLabel ? <span className="text-xs text-muted-foreground">{workloadLabel}</span> : null}
      />
      <DataTableShell className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[44rem] table-fixed text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[28%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Agent</th>
              <th className="px-3 py-2.5 font-medium text-right">Overall KPI</th>
              <th className="px-3 py-2.5 font-medium text-right">Chats</th>
              <th className="px-3 py-2.5 font-medium text-right">SLA</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="w-10 px-2 py-2.5 font-medium" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {periodType === "monthly" ? "No active agents to display." : "No active agents to display."}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const status = agentStatus(row, scoringConfig, periodType);
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    className="border-t border-border/50 hover:bg-muted/25 cursor-pointer"
                    onClick={() => onToggle(row.id)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{row.agentName}</td>
                    <td className="px-3 py-2 text-right">
                      {row.scorecard?.compositeScore != null ? (
                        <button
                          type="button"
                          className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOverallClick(row.agentId);
                          }}
                        >
                          {formatNumber(row.scorecard.compositeScore, 1)}/100
                        </button>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.hasKpiData ? row.scorecard?.compositeDisplay ?? "N/A" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {row.hasKpiData ? formatNumber(row.ticketsHandled.value, 0) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {!row.hasKpiData || row.slaPercent.value == null ? "—" : `${formatNumber(row.slaPercent.value, 1)}%`}
                    </td>
                    <td className={cn("px-3 py-2 text-xs font-medium", status.className)}>{status.label}</td>
                    <td className="px-2 py-2">
                      <span
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground"
                        aria-hidden
                      >
                        <ChevronDown className={cn("size-4 motion-safe:transition-transform", expanded && "rotate-180")} />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t border-border/40 bg-muted/20">
                    <td colSpan={6} className="p-0">
                      <div
                        className={cn(
                          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200",
                          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                        )}
                      >
                        <div className="overflow-hidden">
                          <AgentBreakdown
                            row={row}
                            scoringConfig={scoringConfig}
                            qaScore={qaByAgent[row.agentId] ?? null}
                            canAddKpi={canAddKpi}
                            onAddKpi={() => onAddKpi(row.agentId)}
                            className="px-3 py-3"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const status = agentStatus(row, scoringConfig, periodType);
          const expanded = expandedId === row.id;
          return (
            <article key={row.id} className="rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                onClick={() => onToggle(row.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{row.agentName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.hasKpiData
                      ? `${formatNumber(row.ticketsHandled.value, 0)} chats · SLA ${
                          row.slaPercent.value == null ? "N/A" : `${formatNumber(row.slaPercent.value, 1)}%`
                        }`
                      : "No KPI data entered"}
                  </p>
                </div>
                <span className={cn("text-xs font-medium", status.className)}>{status.label}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform", expanded && "rotate-180")} />
              </button>
              <div className={cn("grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <AgentBreakdown
                    row={row}
                    scoringConfig={scoringConfig}
                    qaScore={qaByAgent[row.agentId] ?? null}
                    canAddKpi={canAddKpi}
                    onAddKpi={() => onAddKpi(row.agentId)}
                    className="border-t border-border/50 px-3 py-3"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OwnPerformanceSection({
  record,
  scoringConfig,
  qa,
}: {
  record?: RecordRow;
  scoringConfig: KpiScoringConfig;
  qa?: number;
}) {
  if (!record) {
    return <p className="text-sm text-muted-foreground">No KPI data for this week yet.</p>;
  }
  return (
    <section>
      <SectionHeader title="Your performance" />
      <AgentBreakdown
        row={{ ...record, hasKpiData: true }}
        scoringConfig={scoringConfig}
        qaScore={qa ?? null}
        className="rounded-lg border border-border/60 bg-card px-3 py-3 shadow-[var(--shadow-card)]"
      />
    </section>
  );
}

function AgentBreakdown({
  row,
  scoringConfig,
  qaScore,
  canAddKpi,
  onAddKpi,
  className,
}: {
  row: KpiDisplayRow;
  scoringConfig: KpiScoringConfig;
  qaScore: number | null;
  canAddKpi?: boolean;
  onAddKpi?: () => void;
  className?: string;
}) {
  if (!row.hasKpiData) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">No KPI metrics entered for this period.</p>
        {canAddKpi && onAddKpi ? (
          <Button size="sm" className="mt-2" onClick={onAddKpi}>Add KPI data</Button>
        ) : null}
      </div>
    );
  }
  const csatLabel =
    row.zeroSurveyResponses && row.csatInputMode === "survey_counts"
      ? "No survey responses"
      : row.csatPercent.value == null
        ? "N/A"
        : `${formatNumber(row.csatPercent.value, 1)}%`;
  const scoreById = new Map(row.scorecard?.metrics.map((m) => [m.id, m]) ?? []);
  const targetShort = (summaryId: (typeof SUMMARY_SCORECARD_IDS)[number]) => {
    const label = summaryTargetLabel(scoringConfig, summaryId);
    return label.replace(/^Target /, "");
  };
  const metrics = [
    { id: "frt", label: "First Response Time", value: formatDurationHours(row.firstResponseHours.value), target: targetShort("frt") },
    { id: "art", label: "Average Response Time", value: formatDurationHours(row.averageResponseHours?.value), target: targetShort("avgResponse") },
    { id: "resolution", label: "Resolution Time", value: formatDurationHours(row.resolutionHours.value), target: targetShort("resolution") },
    { id: "sla", label: "SLA", value: row.slaPercent.value == null ? "N/A" : `${formatNumber(row.slaPercent.value, 1)}%`, target: targetShort("sla") },
    { id: "csat", label: "CSAT", value: csatLabel, target: targetShort("csat") },
    {
      id: "qa",
      label: "QA",
      value: qaScore == null ? "N/A" : `${formatNumber(qaScore, 1)}/100`,
      target: targetShort("qa"),
    },
  ];

  const surveyLine =
    row.csatInputMode === "survey_counts"
      ? `Positive ${formatNumber(row.csatPositiveCount?.value ?? 0, 0)} · Negative ${formatNumber(row.csatNegativeCount?.value ?? 0, 0)} · Neutral ${formatNumber(row.csatNeutralCount?.value ?? 0, 0)}`
      : row.legacyPercentOnly
        ? "Historical CSAT stored as percentage only"
        : null;

  const cards: MetricBreakdownCardItem[] = metrics.map((item) => {
    const scored = scoreById.get(item.id);
    return {
      id: item.id,
      label: item.label,
      value: item.value,
      targetLabel: item.target,
      weight: scored?.weight ?? (scoringConfig.scoringConfigured ? summaryMetricWeight(scoringConfig, SCORECARD_TO_SUMMARY[item.id] ?? "frt") : undefined),
      pointsDisplay: scored?.points != null ? scored.pointsDisplay : null,
      tone: scored?.points != null ? earnedPointsTone(scored.points, scored.weight) : "neutral",
    };
  });

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-foreground">Metric breakdown</p>
      {surveyLine ? <p className="mt-1 text-[11px] text-muted-foreground">{surveyLine}</p> : null}
      <MetricBreakdownCardGrid items={cards} className="mt-2" />
      {row.scorecard?.compositeDisplay ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Overall KPI: <span className="font-medium text-foreground">{row.scorecard.compositeDisplay}</span>
        </p>
      ) : null}
    </div>
  );
}

function findKpiRecordForPeriod(
  records: RecordRow[],
  agentId: string,
  periodType: "weekly" | "monthly",
  week: string,
  month: string,
) {
  return records.find((row) => {
    if (row.agentId !== agentId) return false;
    if (periodType === "weekly") return (row.periodType || "weekly") === "weekly" && row.weekStart === week;
    return row.periodType === "monthly" && (row.periodStart ?? "").startsWith(month);
  });
}

function applyRecordToKpiForm(
  match: RecordRow | undefined,
  setters: {
    setTickets: (v: string) => void;
    setFrtHours: (v: string) => void;
    setArtHours: (v: string) => void;
    setResolutionHours: (v: string) => void;
    setSla: (v: string) => void;
    setCsatPositive: (v: string) => void;
    setCsatNegative: (v: string) => void;
    setCsatNeutral: (v: string) => void;
  },
) {
  if (!match) {
    setters.setTickets("");
    setters.setFrtHours("");
    setters.setArtHours("");
    setters.setResolutionHours("");
    setters.setSla("");
    setters.setCsatPositive("");
    setters.setCsatNegative("");
    setters.setCsatNeutral("");
    return;
  }
  setters.setTickets(match.ticketsHandled.value != null ? String(match.ticketsHandled.value) : "");
  setters.setFrtHours(match.firstResponseHours.value != null ? String(match.firstResponseHours.value) : "");
  setters.setArtHours(match.averageResponseHours?.value != null ? String(match.averageResponseHours.value) : "");
  setters.setResolutionHours(match.resolutionHours.value != null ? String(match.resolutionHours.value) : "");
  setters.setSla(match.slaPercent.value != null ? String(match.slaPercent.value) : "");
  if (match.csatInputMode === "survey_counts") {
    setters.setCsatPositive(match.csatPositiveCount?.value != null ? String(match.csatPositiveCount.value) : "");
    setters.setCsatNegative(match.csatNegativeCount?.value != null ? String(match.csatNegativeCount.value) : "");
    setters.setCsatNeutral(match.csatNeutralCount?.value != null ? String(match.csatNeutralCount.value) : "");
  } else {
    setters.setCsatPositive("");
    setters.setCsatNegative("");
    setters.setCsatNeutral("");
  }
}

function KpiDataEntryDialog({
  mode,
  periodType: dashboardPeriodType,
  week: dashboardWeek,
  month: dashboardMonth,
  agents,
  initialAgentId,
  onClose,
  onSwitchToEdit,
}: {
  mode: "add" | "edit";
  periodType: "weekly" | "monthly";
  week: string;
  month: string;
  agents: AgentDirectoryEntry[];
  initialAgentId?: string | null;
  onClose: () => void;
  onSwitchToEdit?: (prefill: { periodType: "weekly" | "monthly"; week: string; month: string; agentId: string }) => void;
}) {
  const client = useQueryClient();
  const [periodType, setPeriodType] = useState(dashboardPeriodType);
  const [week, setWeek] = useState(dashboardWeek);
  const [month, setMonth] = useState(dashboardMonth);
  const [agentId, setAgentId] = useState(initialAgentId || agents[0]?.id || "");

  useEffect(() => {
    if (initialAgentId) setAgentId(initialAgentId);
  }, [initialAgentId]);
  useEffect(() => {
    setPeriodType(dashboardPeriodType);
    setWeek(dashboardWeek);
    setMonth(dashboardMonth);
  }, [dashboardPeriodType, dashboardWeek, dashboardMonth]);
  const [tickets, setTickets] = useState("");
  const [frtHours, setFrtHours] = useState("");
  const [artHours, setArtHours] = useState("");
  const [resolutionHours, setResolutionHours] = useState("");
  const [sla, setSla] = useState("");
  const [csatPositive, setCsatPositive] = useState("");
  const [csatNegative, setCsatNegative] = useState("");
  const [csatNeutral, setCsatNeutral] = useState("");
  const [formError, setFormError] = useState("");

  const periodRecordsQuery = useQuery({
    queryKey: ["kpi", "entry-form", periodType, week, month],
    queryFn: () => {
      const params = new URLSearchParams({ periodType });
      if (periodType === "monthly") params.set("month", month);
      else params.set("week", week);
      return api<KpiPayload>(`/api/kpi?${params.toString()}`);
    },
  });
  const records = periodRecordsQuery.data?.records ?? [];

  const agentOptions = useMemo(() => agents, [agents]);

  const existingRecord = useMemo(
    () => findKpiRecordForPeriod(records, agentId, periodType, week, month),
    [agentId, month, periodType, records, week],
  );

  const periodLabel = periodType === "weekly" ? formatWeek(week) : formatMonth(month);

  useEffect(() => {
    const setters = {
      setTickets,
      setFrtHours,
      setArtHours,
      setResolutionHours,
      setSla,
      setCsatPositive,
      setCsatNegative,
      setCsatNeutral,
    };
    if (mode === "add") {
      applyRecordToKpiForm(undefined, setters);
    } else {
      applyRecordToKpiForm(existingRecord, setters);
    }
    setFormError("");
  }, [agentId, existingRecord, mode, month, periodType, week]);

  const surveyPreview = useMemo(() => {
    const pos = csatPositive === "" ? null : Number(csatPositive);
    const neg = csatNegative === "" ? null : Number(csatNegative);
    const neu = csatNeutral === "" ? null : Number(csatNeutral);
    if (pos == null || neg == null || neu == null) return null;
    if (![pos, neg, neu].every((n) => Number.isInteger(n) && n >= 0)) return null;
    return previewCsatFromCounts(pos, neg, neu);
  }, [csatPositive, csatNegative, csatNeutral]);

  function parseEntryPayload() {
    const required = [
      { label: "Tickets handled", raw: tickets },
      { label: "First response time", raw: frtHours },
      { label: "Average response time", raw: artHours },
      { label: "Resolution time", raw: resolutionHours },
      { label: "SLA compliance", raw: sla },
      { label: "Positive responses", raw: csatPositive },
      { label: "Negative responses", raw: csatNegative },
      { label: "Neutral responses", raw: csatNeutral },
    ];
    for (const field of required) {
      if (field.raw.trim() === "") throw new Error(`${field.label} is required.`);
    }
    const ticketsHandled = Number(tickets);
    const firstResponseHours = Number(frtHours);
    const averageResponseHours = Number(artHours);
    const resolutionHoursVal = Number(resolutionHours);
    const slaPercent = Number(sla);
    const csatPositiveCount = Number(csatPositive);
    const csatNegativeCount = Number(csatNegative);
    const csatNeutralCount = Number(csatNeutral);
    const intFields = [
      ["Tickets handled", ticketsHandled],
      ["Positive responses", csatPositiveCount],
      ["Negative responses", csatNegativeCount],
      ["Neutral responses", csatNeutralCount],
    ] as const;
    for (const [label, value] of intFields) {
      if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a whole number ≥ 0.`);
    }
    const numFields = [
      ["First response time", firstResponseHours],
      ["Average response time", averageResponseHours],
      ["Resolution time", resolutionHoursVal],
    ] as const;
    for (const [label, value] of numFields) {
      if (Number.isNaN(value) || value < 0) throw new Error(`${label} must be a number ≥ 0.`);
    }
    if (Number.isNaN(slaPercent) || slaPercent < 0 || slaPercent > 100) {
      throw new Error("SLA compliance must be between 0 and 100.");
    }
    return {
      ticketsHandled,
      firstResponseHours,
      averageResponseHours,
      resolutionHours: resolutionHoursVal,
      slaPercent,
      csatPositiveCount,
      csatNegativeCount,
      csatNeutralCount,
    };
  }

  const duplicateForAdd = mode === "add" && Boolean(existingRecord);
  const missingForEdit = mode === "edit" && agentId && !periodRecordsQuery.isLoading && !existingRecord;

  const save = useMutation({
    mutationFn: () => {
      const metrics = parseEntryPayload();
      if (mode === "add") {
        const body: Record<string, unknown> = { agentId, periodType, ...metrics };
        if (periodType === "weekly") body.weekStart = week;
        else body.month = month;
        return api("/api/kpi/entries", { method: "POST", body: JSON.stringify(body) });
      }
      if (!existingRecord?.id) throw new Error("No KPI record to update for this agent and period.");
      return api(`/api/kpi/${existingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({ entry: metrics }),
      });
    },
    onSuccess: () => {
      toast.success(mode === "add" ? "KPI data added" : "KPI data updated");
      void client.invalidateQueries({ queryKey: ["kpi"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  function submitEntry() {
    if (!agentId) {
      toast.error("Select an agent");
      return;
    }
    if (duplicateForAdd) return;
    if (missingForEdit) {
      toast.error("No KPI data exists for this agent and period.");
      return;
    }
    try {
      parseEntryPayload();
      setFormError("");
      save.mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check all required fields.";
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(90svh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,52rem)]">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>{mode === "add" ? "Add KPI data" : "Edit KPI data"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {mode === "add"
              ? "Create a new KPI record for an agent and reporting period. Existing records must be updated via Edit KPI Data."
              : "Update an existing KPI record. Choose the agent and reporting period first."}
            {" "}QA scores come from the QA module; CSAT and DSAT are calculated from survey counts.
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Reporting details</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Period type</Label>
                  <Select value={periodType} onValueChange={(value) => setPeriodType(value as "weekly" | "monthly")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{periodType === "weekly" ? "Reporting week" : "Reporting month"}</Label>
                  {periodType === "weekly" ? (
                    <Select value={week} onValueChange={setWeek}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...recentWeeks()].reverse().map((item) => (
                          <SelectItem key={item} value={item}>{formatWeek(item)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...recentMonths()].reverse().map((item) => (
                          <SelectItem key={item} value={item}>{formatMonth(item)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Agent</Label>
                  <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>
                      {agentOptions.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            <section className="space-y-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Freshdesk metrics</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tickets</Label>
                  <Input
                    className="mt-1.5 h-8 text-sm"
                    inputMode="numeric"
                    value={tickets}
                    onChange={(event) => setTickets(event.target.value)}
                    placeholder="142"
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">FRT (h)</Label>
                  <KpiDurationField
                    label="First response time"
                    value={frtHours}
                    onChange={setFrtHours}
                    nestedInDialog
                    compact
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ART (h)</Label>
                  <KpiDurationField
                    label="Average response time"
                    value={artHours}
                    onChange={setArtHours}
                    nestedInDialog
                    compact
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resolution (h)</Label>
                  <Input
                    className="mt-1.5 h-8 text-sm"
                    inputMode="decimal"
                    value={resolutionHours}
                    onChange={(event) => setResolutionHours(event.target.value)}
                    placeholder="9.39"
                  />
                </div>
                <div className="col-span-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 sm:col-span-1 lg:col-span-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SLA (%)</Label>
                  <Input
                    className="mt-1.5 h-8 text-sm"
                    inputMode="decimal"
                    value={sla}
                    onChange={(event) => setSla(event.target.value)}
                    placeholder="97"
                  />
                </div>
              </div>
            </section>
            <section className="space-y-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">CSAT survey responses</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Positive</Label>
                  <Input inputMode="numeric" value={csatPositive} onChange={(event) => setCsatPositive(event.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Negative</Label>
                  <Input inputMode="numeric" value={csatNegative} onChange={(event) => setCsatNegative(event.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Neutral</Label>
                  <Input inputMode="numeric" value={csatNeutral} onChange={(event) => setCsatNeutral(event.target.value)} placeholder="0" />
                </div>
              </div>
            </section>
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-border/60 bg-muted/25 px-3 py-2.5 text-xs">
              <span className="font-medium text-foreground">Calculated preview</span>
              <span className="text-muted-foreground">
                Total answered: <span className="tabular-nums text-foreground">{surveyPreview ? formatNumber(surveyPreview.total, 0) : "—"}</span>
              </span>
              <span className="text-muted-foreground">
                CSAT:{" "}
                <span className="tabular-nums text-foreground">
                  {surveyPreview ? (surveyPreview.zeroSurveys ? "0%" : `${formatNumber(surveyPreview.csatPercent, 1)}%`) : "—"}
                </span>
              </span>
              <span className="text-muted-foreground">
                DSAT: <span className="tabular-nums text-foreground">{surveyPreview ? `${formatNumber(surveyPreview.dsatPercent, 1)}%` : "—"}</span>
              </span>
            </div>
            {duplicateForAdd ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
                <p>
                  KPI data for <span className="font-medium">{periodLabel}</span> is already added for this agent.
                  Edit the record if you need to change numbers.
                </p>
                {onSwitchToEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      onSwitchToEdit({ periodType, week, month, agentId })
                    }
                  >
                    Edit KPI Data
                  </Button>
                ) : null}
              </div>
            ) : null}
            {missingForEdit ? (
              <p className="text-sm text-muted-foreground" role="status">
                No KPI data for this agent in {periodLabel}. Use Add KPI Data to create a new record.
              </p>
            ) : null}
            {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
          </div>
        </div>
        <DialogFooter className="!mx-0 !mb-0 shrink-0 rounded-b-xl border-t border-border bg-background px-5 py-4">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={save.isPending || !agentId || duplicateForAdd || Boolean(missingForEdit)}
            onClick={submitEntry}
          >
            {mode === "add" ? "Add KPI Data" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type KpiReportingConfig = {
  launchDateIst: string | null;
};

/** Strip % and commas; reject empty/invalid so JSON never sends null from NaN. */
function parseKpiSettingsNumber(raw: string, label: string): number {
  const cleaned = raw.trim().replace(/%/g, "").replace(/,/g, "");
  if (!cleaned) throw new Error(`${label} is required.`);
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number (do not include “%”).`);
  return n;
}

function formatIstDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function scoringFormSnapshot(config: KpiScoringConfig) {
  const t = config.targets;
  return JSON.stringify({
    frt: t.firstResponseHours != null ? String(t.firstResponseHours) : "",
    art: t.averageResponseHours != null ? String(t.averageResponseHours) : "",
    resolution: t.resolutionHours != null ? String(t.resolutionHours) : "",
    csat: t.csatPercent != null ? String(t.csatPercent) : "",
    sla: t.slaPercent != null ? String(t.slaPercent) : "",
    qa: t.qaPercent != null ? String(t.qaPercent) : "",
    wFrt: String(config.weights.firstResponseHours),
    wArt: String(config.weights.averageResponseHours),
    wRes: String(config.weights.resolutionHours),
    wSla: String(config.weights.slaPercent),
    wCsat: String(config.weights.csatPercent),
    wQa: String(config.weights.qaPercent),
  });
}

function applyScoringConfigToForm(config: KpiScoringConfig, setters: {
  setFrt: (v: string) => void;
  setArt: (v: string) => void;
  setResolution: (v: string) => void;
  setCsat: (v: string) => void;
  setSla: (v: string) => void;
  setQa: (v: string) => void;
  setWFrt: (v: string) => void;
  setWArt: (v: string) => void;
  setWRes: (v: string) => void;
  setWSla: (v: string) => void;
  setWCsat: (v: string) => void;
  setWQa: (v: string) => void;
}) {
  const t = config.targets;
  setters.setFrt(t.firstResponseHours != null ? String(t.firstResponseHours) : "");
  setters.setArt(t.averageResponseHours != null ? String(t.averageResponseHours) : "");
  setters.setResolution(t.resolutionHours != null ? String(t.resolutionHours) : "");
  setters.setCsat(t.csatPercent != null ? String(t.csatPercent) : "");
  setters.setSla(t.slaPercent != null ? String(t.slaPercent) : "");
  setters.setQa(t.qaPercent != null ? String(t.qaPercent) : "");
  setters.setWFrt(String(config.weights.firstResponseHours));
  setters.setWArt(String(config.weights.averageResponseHours));
  setters.setWRes(String(config.weights.resolutionHours));
  setters.setWSla(String(config.weights.slaPercent));
  setters.setWCsat(String(config.weights.csatPercent));
  setters.setWQa(String(config.weights.qaPercent));
}

const KPI_TARGET_LABELS: Record<string, string> = {
  firstResponseHours: "FRT (hours)",
  averageResponseHours: "ART (hours)",
  resolutionHours: "Resolution (hours)",
  slaPercent: "SLA (%)",
  csatPercent: "CSAT (%)",
  qaPercent: "QA (%)",
};

function KpiSettingsDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const goalsQuery = useQuery({
    queryKey: ["kpi-goals"],
    queryFn: () =>
      api<{
        goals: KpiGoals;
        scoringConfig: KpiScoringConfig;
        activeConfig: KpiScoringConfig;
        scheduledConfig: KpiScoringConfig | null;
        nextScheduleEffectiveFrom: string;
      }>("/api/kpi/goals"),
  });
  const [historyTabOpen, setHistoryTabOpen] = useState(false);
  const versionsQuery = useQuery({
    queryKey: ["kpi-config-versions"],
    queryFn: () =>
      api<{ versions: KpiConfigVersionRow[]; nextScheduleEffectiveFrom: string }>("/api/kpi/config/versions"),
    enabled: historyTabOpen,
  });
  const reportingQuery = useQuery({
    queryKey: ["kpi-reporting"],
    queryFn: () => api<{ reporting: KpiReportingConfig }>("/api/kpi/reporting"),
  });
  const [reportingLaunchDate, setReportingLaunchDate] = useState("");
  const [frt, setFrt] = useState("");
  const [art, setArt] = useState("");
  const [resolution, setResolution] = useState("");
  const [csat, setCsat] = useState("");
  const [sla, setSla] = useState("");
  const [qa, setQa] = useState("");
  const [wFrt, setWFrt] = useState("10");
  const [wArt, setWArt] = useState("10");
  const [wRes, setWRes] = useState("15");
  const [wSla, setWSla] = useState("15");
  const [wCsat, setWCsat] = useState("25");
  const [wQa, setWQa] = useState("25");
  const [settingsTab, setSettingsTab] = useState("reporting");
  const [reportingBaseline, setReportingBaseline] = useState({ launch: "" });
  const [scoringBaseline, setScoringBaseline] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  const weightTotal = useMemo(() => {
    const parts = [wFrt, wArt, wRes, wSla, wCsat, wQa].map((v) => Number(v));
    if (parts.some((n) => Number.isNaN(n))) return null;
    return parts.reduce((sum, n) => sum + n, 0);
  }, [wArt, wCsat, wFrt, wQa, wRes, wSla]);

  const reportingDirty =
    reportingLaunchDate !== reportingBaseline.launch;
  const scoringSnapshot = JSON.stringify({ frt, art, resolution, csat, sla, qa, wFrt, wArt, wRes, wSla, wCsat, wQa });
  const scoringDirty = scoringBaseline !== "" && scoringSnapshot !== scoringBaseline;

  function requestClose() {
    if (reportingDirty || scoringDirty) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    onClose();
  }

  useEffect(() => {
    const data = goalsQuery.data;
    if (!data) return;
    const editConfig = data.scheduledConfig ?? data.activeConfig;
    applyScoringConfigToForm(editConfig, {
      setFrt,
      setArt,
      setResolution,
      setCsat,
      setSla,
      setQa,
      setWFrt,
      setWArt,
      setWRes,
      setWSla,
      setWCsat,
      setWQa,
    });
    setScoringBaseline(scoringFormSnapshot(editConfig));
  }, [goalsQuery.data]);

  useEffect(() => {
    setHistoryTabOpen(settingsTab === "history");
  }, [settingsTab]);

  useEffect(() => {
    const reporting = reportingQuery.data?.reporting;
    if (!reporting) return;
    const launch = reporting.launchDateIst ?? "";
    setReportingLaunchDate(launch);
    setReportingBaseline({ launch });
  }, [reportingQuery.data]);

  const saveReporting = useMutation({
    mutationFn: () =>
      api<{ reporting: KpiReportingConfig }>("/api/kpi/reporting", {
        method: "PUT",
        body: JSON.stringify({
          launchDateIst: reportingLaunchDate.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Daily DSAT launch date updated");
      setReportingBaseline({ launch: reportingLaunchDate });
      void client.invalidateQueries({ queryKey: ["kpi-reporting"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelScheduled = useMutation({
    mutationFn: (cancelReason: string) =>
      api("/api/kpi/config/scheduled", {
        method: "DELETE",
        body: JSON.stringify({ cancelReason }),
      }),
    onSuccess: () => {
      toast.success("Scheduled configuration cancelled");
      void client.invalidateQueries({ queryKey: ["kpi-goals"] });
      void client.invalidateQueries({ queryKey: ["kpi-config-versions"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: () => {
      const reason = changeReason.trim();
      if (reason.length < 3) throw new Error("Change reason is required (at least 3 characters).");
      const weights = {
        firstResponseHours: parseKpiSettingsNumber(wFrt, "FRT weight"),
        averageResponseHours: parseKpiSettingsNumber(wArt, "ART weight"),
        resolutionHours: parseKpiSettingsNumber(wRes, "Resolution weight"),
        slaPercent: parseKpiSettingsNumber(wSla, "SLA weight"),
        csatPercent: parseKpiSettingsNumber(wCsat, "CSAT weight"),
        qaPercent: parseKpiSettingsNumber(wQa, "QA weight"),
      };
      const total = Object.values(weights).reduce((sum, n) => sum + n, 0);
      if (total !== 100) throw new Error("Metric weights must total 100.");
      return api("/api/kpi/goals", {
        method: "PUT",
        body: JSON.stringify({
          targets: {
            firstResponseHours: parseKpiSettingsNumber(frt, "First response (hours)"),
            averageResponseHours: parseKpiSettingsNumber(art, "Average response (hours)"),
            resolutionHours: parseKpiSettingsNumber(resolution, "Resolution (hours)"),
            slaPercent: parseKpiSettingsNumber(sla, "SLA (%)"),
            csatPercent: parseKpiSettingsNumber(csat, "CSAT (%)"),
            qaPercent: parseKpiSettingsNumber(qa, "QA score (%)"),
          },
          weights,
          changeReason: reason,
        }),
      });
    },
    onSuccess: () => {
      const hasActive = goalsQuery.data?.activeConfig?.scoringConfigured;
      toast.success(
        hasActive
          ? "KPI targets and weights scheduled for the next calendar month"
          : "KPI scoring configuration saved",
      );
      setScoringBaseline(scoringSnapshot);
      setChangeReason("");
      void client.invalidateQueries({ queryKey: ["kpi"] });
      void client.invalidateQueries({ queryKey: ["kpi-goals"] });
      void client.invalidateQueries({ queryKey: ["kpi-config-versions"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const activeConfig = goalsQuery.data?.activeConfig;
  const scheduledConfig = goalsQuery.data?.scheduledConfig;
  const nextEffective = goalsQuery.data?.nextScheduleEffectiveFrom ?? "";
  const schedulingActive = Boolean(activeConfig?.scoringConfigured);
  const scheduleNotice = schedulingActive && nextEffective
    ? `Changes to KPI targets and weights will take effect on ${formatIstDateLabel(nextEffective)}. Current and previous months will remain unchanged.${
        scheduledConfig ? " Saving will revise the scheduled configuration for that month." : ""
      }`
    : schedulingActive
      ? null
      : "First save activates scoring for the current calendar month (IST).";

  const targetFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label>First response (hours)</Label><Input inputMode="decimal" value={frt} onChange={(e) => setFrt(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Average response (hours)</Label><Input inputMode="decimal" value={art} onChange={(e) => setArt(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Resolution (hours)</Label><Input inputMode="decimal" value={resolution} onChange={(e) => setResolution(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>SLA (%)</Label><Input inputMode="decimal" value={sla} onChange={(e) => setSla(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>CSAT (%)</Label><Input inputMode="decimal" value={csat} onChange={(e) => setCsat(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>QA score (%)</Label><Input inputMode="decimal" value={qa} onChange={(e) => setQa(e.target.value)} /></div>
    </div>
  );

  const weightFields = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>FRT weight</Label><Input inputMode="numeric" value={wFrt} onChange={(e) => setWFrt(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>ART weight</Label><Input inputMode="numeric" value={wArt} onChange={(e) => setWArt(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Resolution weight</Label><Input inputMode="numeric" value={wRes} onChange={(e) => setWRes(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>SLA weight</Label><Input inputMode="numeric" value={wSla} onChange={(e) => setWSla(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>CSAT weight</Label><Input inputMode="numeric" value={wCsat} onChange={(e) => setWCsat(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>QA weight</Label><Input inputMode="numeric" value={wQa} onChange={(e) => setWQa(e.target.value)} /></div>
      </div>
      <p className={cn("text-sm tabular-nums", weightTotal === 100 ? "text-muted-foreground" : "font-medium text-destructive")}>
        Total weight: {weightTotal ?? "—"} / 100
      </p>
    </div>
  );

  const activeSummary = activeConfig?.scoringConfigured ? (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        Active now{activeConfig.configurationLabel ? `: ${activeConfig.configurationLabel}` : ""}
      </p>
      <p className="mt-1 tabular-nums">
        SLA {activeConfig.targets.slaPercent}% · QA {activeConfig.targets.qaPercent}% · weights total 100
      </p>
    </div>
  ) : null;

  const scheduledSummary = scheduledConfig ? (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">
        Scheduled{nextEffective ? ` for ${formatIstDateLabel(nextEffective)}` : ""}
        {scheduledConfig.configurationLabel ? ` · ${scheduledConfig.configurationLabel}` : ""}
      </p>
      <p className="mt-1 tabular-nums text-muted-foreground">
        SLA {scheduledConfig.targets.slaPercent}% · QA {scheduledConfig.targets.qaPercent}%
      </p>
      <Button
        type="button"
        variant="link"
        className="mt-1 h-auto p-0 text-xs"
        disabled={cancelScheduled.isPending}
        onClick={() => {
          const reason = window.prompt("Reason for cancelling the scheduled configuration?");
          if (!reason || reason.trim().length < 3) {
            if (reason !== null) toast.error("Cancellation reason is required.");
            return;
          }
          cancelScheduled.mutate(reason.trim());
        }}
      >
        Cancel scheduled change
      </Button>
    </div>
  ) : null;

  const scoringScheduleBlock = scheduleNotice ? (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
      {scheduleNotice}
    </p>
  ) : null;

  const changeReasonField = (
    <div className="space-y-1.5">
      <Label>Change reason</Label>
      <Textarea
        value={changeReason}
        onChange={(e) => setChangeReason(e.target.value)}
        placeholder="Why are these targets or weights changing?"
        rows={2}
      />
    </div>
  );

  const compareBase = versionsQuery.data?.versions.find((v) => v.id === compareVersionId) ?? null;

  function renderVersionDetail(version: KpiConfigVersionRow, compareTo?: KpiConfigVersionRow | null) {
    const keys = Object.keys(KPI_TARGET_LABELS);
    return (
      <div className="mt-2 space-y-2 text-xs">
        <div className="grid gap-1 sm:grid-cols-2">
          {keys.map((key) => {
            const cur = version.targets[key];
            const prev = compareTo?.targets[key];
            const changed = compareTo && prev !== cur;
            return (
              <p key={key} className={cn(changed && "font-medium text-foreground")}>
                {KPI_TARGET_LABELS[key]}: {cur ?? "—"}
                {changed ? ` (was ${prev ?? "—"})` : ""}
              </p>
            );
          })}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {keys.map((key) => {
            const cur = version.weights[key];
            const prev = compareTo?.weights[key];
            const changed = compareTo && prev !== cur;
            return (
              <p key={`w-${key}`} className={cn("text-muted-foreground", changed && "font-medium text-foreground")}>
                Weight {KPI_TARGET_LABELS[key]}: {cur}
                {changed ? ` (was ${prev})` : ""}
              </p>
            );
          })}
        </div>
        {version.revisions.length > 0 ? (
          <div className="border-t border-border/40 pt-2">
            <p className="font-medium">Scheduled revisions</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {version.revisions.map((r, i) => (
                <li key={i}>
                  {r.actorName} · {new Date(r.at).toLocaleString()} — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const historyPanel = (
    <div className="space-y-3">
      {versionsQuery.isLoading ? <LoadingBlock /> : null}
      {versionsQuery.isError ? <ErrorBlock message={versionsQuery.error.message} /> : null}
      {versionsQuery.data ? (
        <div className="space-y-2">
          {versionsQuery.data.versions
            .filter((v) => v.status !== "cancelled")
            .map((version) => (
              <div key={version.id} className="rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      V{version.versionNumber} · {version.effectiveMonthLabel}
                      <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{version.status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {version.createdByName} · {new Date(version.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{version.changeReason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedVersionId((id) => (id === version.id ? null : version.id))
                      }
                    >
                      {expandedVersionId === version.id ? "Hide" : "View"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCompareVersionId(version.id)}
                    >
                      Compare
                    </Button>
                  </div>
                </div>
                {expandedVersionId === version.id
                  ? renderVersionDetail(version, compareBase && compareBase.id !== version.id ? compareBase : null)
                  : null}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="flex max-h-[min(90svh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,56rem)]">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>KPI settings</DialogTitle>
          <p className="text-xs text-muted-foreground">Daily DSAT schedule, scoring targets, and metric weights.</p>
        </DialogHeader>
        {goalsQuery.isLoading || reportingQuery.isLoading ? (
          <div className="px-5 py-6"><LoadingBlock /></div>
        ) : null}
        {goalsQuery.isError ? <div className="px-5"><ErrorBlock message={goalsQuery.error.message} /></div> : null}
        {reportingQuery.isError ? <div className="px-5"><ErrorBlock message={reportingQuery.error.message} /></div> : null}
        {goalsQuery.data && reportingQuery.data ? (
          <Tabs value={settingsTab} onValueChange={setSettingsTab} className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="mx-5 mt-3 w-full flex-wrap justify-start sm:w-auto">
              <TabsTrigger value="reporting">Reporting</TabsTrigger>
              <TabsTrigger value="targets">KPI targets</TabsTrigger>
              <TabsTrigger value="weights">Metric weights</TabsTrigger>
              <TabsTrigger value="history">Configuration history</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TabsContent value="reporting" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Daily DSAT Deep Dive is handled by Senior Agents (Monday–Saturday IST). Set the launch date to start derived
                  dashboard tasks. Supervisors own weekly and monthly KPI reporting completion on the dashboard.
                </p>
                <div className="grid gap-3 sm:max-w-md">
                  <div className="space-y-1.5">
                    <Label>DSAT launch date (IST)</Label>
                    <IstDatePicker value={reportingLaunchDate} onChange={setReportingLaunchDate} aria-label="Reporting launch date" />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="targets" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  All six targets must be saved together before composite KPI scores appear on the dashboard.
                </p>
                {activeSummary}
                {scheduledSummary}
                {scoringScheduleBlock}
                {targetFields}
                {changeReasonField}
              </TabsContent>
              <TabsContent value="weights" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">Weights are saved with targets and must total exactly 100.</p>
                {activeSummary}
                {scheduledSummary}
                {scoringScheduleBlock}
                {weightFields}
                {changeReasonField}
              </TabsContent>
              <TabsContent value="history" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Versions are immutable once active. Scheduled versions can be revised or cancelled before their effective date.
                </p>
                {historyPanel}
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
        <DialogFooter className="!mx-0 !mb-0 shrink-0 rounded-b-xl border-t border-border bg-background px-5 py-4">
          <Button variant="outline" type="button" onClick={requestClose}>Cancel</Button>
          {settingsTab === "reporting" ? (
            <Button type="button" disabled={saveReporting.isPending || !reportingDirty} onClick={() => saveReporting.mutate()}>
              Save reporting configuration
            </Button>
          ) : settingsTab === "history" ? null : (
            <Button
              type="button"
              disabled={save.isPending || weightTotal !== 100 || changeReason.trim().length < 3}
              onClick={() => save.mutate()}
            >
              {schedulingActive ? "Schedule scoring changes" : "Save scoring settings"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
