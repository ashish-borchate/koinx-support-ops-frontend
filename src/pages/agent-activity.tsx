import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { DateRangeDialog } from "@/components/date-range-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Preset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

type DashboardPayload = {
  agent: { id: string; name: string; active: boolean };
  period: { preset: Preset; startIst: string; endIst: string; label: string };
  overview: {
    eligibleWorkingDays: number;
    productGuideReviewsCompleted: number;
    productGuideCompliancePercent: number | null;
    productFeedbackSubmitted: number | null;
    reportedIssuesResolved: number;
    qaAverageScore: number | null;
    qaReviewCount: number | null;
    kpiComposite: string | null;
    current: {
      reportedIssuesOverdue: number;
      reportedIssuesOpen: number;
      qaAckPending: number | null;
      coachingOpen: number | null;
      coachingOverdue: number | null;
    };
  };
  productGuides: {
    eligibleWorkingDays: number;
    completedRequiredReviews: number;
    missedRequiredReviews: number;
    compliancePercent: number | null;
    submissions: { guideTitle: string; reviewDateIst: string; hasIssues: boolean; voluntary: boolean }[];
  };
  reportedIssues: {
    current: { assignedCount: number; overdueCount: number; items: { id: string; title: string; status: string; effectiveFollowUpDateIst: string; overdue: boolean; href: string }[] };
    period: { resolvedCount: number };
  };
  qa: { available: boolean; averageScore: number | null; reviewCount: number; trend: { weekStartIst: string; average: number | null; count: number }[]; pending: { acknowledgements: number } };
  productFeedback: { available: boolean; submittedInPeriod: number; pendingReviewNow: number };
  coaching: { available: boolean; current: { openCount: number; overdueCount: number } };
  kpi: { grain: string; scorecard: { compositeDisplay: string } | null; note?: string };
  timeline: { events: { id: string; label: string; description: string; occurredAt: string; href: string | null }[] };
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

function MetricCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function fmtPercent(v: number | null) {
  if (v == null) return "—";
  return `${v}%`;
}

export function AgentActivityPage() {
  const { user, can } = useAuth();
  const [searchParams] = useSearchParams();
  const canTeam = can("agent_activity.view_team");
  const [agentId, setAgentId] = useState(user?.id || "");
  const [preset, setPreset] = useState<Preset>("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("agentId");
    if (fromUrl && /^[a-f\d]{24}$/i.test(fromUrl)) {
      setAgentId(fromUrl);
    }
  }, [searchParams]);

  const effectiveAgentId = canTeam ? agentId : user?.id || "";

  const rosterQ = useQuery({
    queryKey: ["agent-activity-roster"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/agent-activity/roster"),
    enabled: canTeam,
  });

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ agentId: effectiveAgentId, preset });
    if (preset === "custom" && customFrom && customTo) {
      p.set("from", customFrom);
      p.set("to", customTo);
    }
    return p.toString();
  }, [effectiveAgentId, preset, customFrom, customTo]);

  const dashQ = useQuery({
    queryKey: ["agent-activity-dashboard", queryString],
    queryFn: () => api<DashboardPayload>(`/api/agent-activity/dashboard?${queryString}`),
    enabled: Boolean(effectiveAgentId) && (preset !== "custom" || Boolean(customFrom && customTo)),
  });

  const d = dashQ.data;

  if (!can("agent_activity.view_own") && !canTeam) {
    return <Empty title="No access" body="You do not have permission to view Agent Performance." />;
  }

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Agent Performance"
        description="Completed work, compliance, and current responsibilities for the selected period (IST)."
      />

      <div className="flex flex-wrap items-end gap-4">
        {canTeam ? (
          <div className="min-w-[220px] space-y-1">
            <p className="text-xs text-muted-foreground">Agent</p>
            <Select value={effectiveAgentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {(rosterQ.data?.agents || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="min-w-[180px] space-y-1">
          <p className="text-xs text-muted-foreground">Period</p>
          <Select
            value={preset}
            onValueChange={(v) => {
              const next = v as Preset;
              setPreset(next);
              if (next === "custom") setRangeOpen(true);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" ? (
          <Button variant="outline" size="sm" onClick={() => setRangeOpen(true)}>
            {customFrom && customTo ? `${customFrom} – ${customTo}` : "Choose dates"}
          </Button>
        ) : null}
      </div>

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialFrom={customFrom}
        initialTo={customTo}
        onConfirm={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
          setPreset("custom");
        }}
      />

      {dashQ.isLoading ? <LoadingBlock /> : null}
      {dashQ.isError ? (
        <div className="space-y-2">
          <ErrorBlock message={(dashQ.error as Error).message} />
          <Button type="button" variant="outline" size="sm" onClick={() => void dashQ.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {d ? (
        <>
          <p className="text-sm text-muted-foreground">
            {d.agent.name} · {d.period.label}
          </p>

          <SectionHeader title="Performance overview" description="Activity during the selected period unless labeled current." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Eligible working days" value={String(d.overview.eligibleWorkingDays)} />
            <MetricCard title="Guide reviews (required days)" value={String(d.overview.productGuideReviewsCompleted)} />
            <MetricCard title="Guide compliance" value={fmtPercent(d.overview.productGuideCompliancePercent)} />
            <MetricCard
              title="Product Feedback submitted"
              value={d.overview.productFeedbackSubmitted == null ? "—" : String(d.overview.productFeedbackSubmitted)}
            />
            <MetricCard title="Reported Issues resolved" value={String(d.overview.reportedIssuesResolved)} />
            <MetricCard
              title="QA average"
              value={d.overview.qaAverageScore != null ? String(d.overview.qaAverageScore) : "—"}
              hint={d.overview.qaReviewCount != null ? `${d.overview.qaReviewCount} reviews in period` : undefined}
            />
            <MetricCard title="KPI composite" value={d.overview.kpiComposite ?? "—"} hint={d.kpi.note || d.kpi.grain} />
            <MetricCard
              title="Currently overdue (RI)"
              value={String(d.overview.current.reportedIssuesOverdue)}
              hint={`${d.overview.current.reportedIssuesOpen} open assigned`}
            />
          </div>

          <SectionHeader title="Product Guide reviews" />
          <p className="text-sm text-muted-foreground">
            Missed required reviews: {d.productGuides.missedRequiredReviews} · Voluntary off-day reviews excluded from
            compliance.
          </p>
          <ul className="divide-y rounded-lg border">
            {d.productGuides.submissions.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">No reviews in this period.</li>
            ) : (
              d.productGuides.submissions.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {s.guideTitle} · {s.reviewDateIst}
                    {s.voluntary ? " (voluntary)" : ""}
                    {s.hasIssues ? " · issues flagged" : ""}
                  </span>
                  <Link className="text-primary underline-offset-4 hover:underline" to="/product-guides/daily-review">
                    Open
                  </Link>
                </li>
              ))
            )}
          </ul>

          <SectionHeader title="Reported Issues (assigned work)" />
          <ul className="divide-y rounded-lg border">
            {d.reportedIssues.current.items.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">No open assigned issues.</li>
            ) : (
              d.reportedIssues.current.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className={cn(item.overdue && "text-destructive font-medium")}>
                    {item.title} · {item.status}
                    {item.effectiveFollowUpDateIst ? ` · due ${item.effectiveFollowUpDateIst}` : ""}
                    {item.overdue ? " · overdue" : ""}
                  </span>
                  <Link className="text-primary underline-offset-4 hover:underline" to={item.href}>
                    View
                  </Link>
                </li>
              ))
            )}
          </ul>

          {d.qa.available ? (
            <>
              <SectionHeader title="QA performance" />
              {d.qa.trend.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {d.qa.trend.map((t) => (
                    <div key={t.weekStartIst} className="rounded-md border px-3 py-2 text-xs">
                      Wk {t.weekStartIst}: {t.average ?? "—"} ({t.count})
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">Pending acknowledgements (current): {d.qa.pending.acknowledgements}</p>
            </>
          ) : null}

          {d.kpi.scorecard ? (
            <>
              <SectionHeader title="KPI scorecard" />
              <p className="text-lg font-semibold">{d.kpi.scorecard.compositeDisplay}</p>
            </>
          ) : null}

          <SectionHeader title="Activity timeline" description="Chronological events in the selected period." />
          <ul className="divide-y rounded-lg border">
            {d.timeline.events.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">No activity in this period.</li>
            ) : (
              d.timeline.events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium">{ev.label}</p>
                    <p className="text-muted-foreground">{ev.description}</p>
                    <p className="text-xs text-muted-foreground">{formatWhen(ev.occurredAt)}</p>
                  </div>
                  {ev.href ? (
                    <Link className="text-primary underline-offset-4 hover:underline" to={ev.href}>
                      Open
                    </Link>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}
