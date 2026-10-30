import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  MessageSquarePlus,
  Scale,
} from "lucide-react";
import { MetricCard } from "@/components/design/metric-card";
import { SectionHeader } from "@/components/bits";
import { ActivityTimeline } from "./activity-timeline";
import { ResponsibilitiesSection } from "./responsibilities-section";
import type { AgentDashboard, MetricDrillDown, PeriodPreset } from "./types";
import { fmtPercent } from "./types";

type Props = {
  data: AgentDashboard;
  preset: PeriodPreset;
  customFrom: string;
  customTo: string;
  onOpenDetails: (metric: MetricDrillDown) => void;
  isRefreshing?: boolean;
};

export function AgentPerformanceView({
  data,
  preset,
  customFrom,
  customTo,
  onOpenDetails,
  isRefreshing,
}: Props) {
  const d = data;

  return (
    <div className={isRefreshing ? "space-y-8 opacity-80 transition-opacity" : "space-y-8"}>
      <section className="space-y-4">
        <SectionHeader
          title="Work completed"
          description={`${d.agent.name} · ${d.period.label}`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Product Guide reviews"
            value={d.overview.productGuideReviewsCompleted}
            icon={BookOpen}
            interactive
            onClick={() => onOpenDetails("pg-reviews")}
          />
          <MetricCard
            label="Product Guide compliance"
            value={fmtPercent(d.overview.productGuideCompliancePercent)}
            note={
              d.overview.eligibleWorkingDays > 0
                ? `${d.overview.productGuideReviewsCompleted} of ${d.overview.eligibleWorkingDays} working days`
                : undefined
            }
            icon={ClipboardCheck}
            tone={
              d.overview.productGuideCompliancePercent != null && d.overview.productGuideCompliancePercent < 100
                ? "warning"
                : "default"
            }
            interactive
            onClick={() => onOpenDetails("pg-compliance")}
          />
          <MetricCard
            label="Product Feedback"
            value={d.overview.productFeedbackSubmitted == null ? "—" : d.overview.productFeedbackSubmitted}
            note={d.overview.productFeedbackSubmitted == null ? "Not available" : undefined}
            icon={MessageSquarePlus}
            interactive={d.overview.productFeedbackSubmitted != null}
            onClick={d.overview.productFeedbackSubmitted != null ? () => onOpenDetails("feedback") : undefined}
          />
          <MetricCard
            label="Reported Issues resolved"
            value={d.overview.reportedIssuesResolved}
            icon={CheckCircle2}
            interactive
            onClick={() => onOpenDetails("ri-resolved")}
          />
          <MetricCard
            label="QA average"
            value={d.overview.qaAverageScore != null ? d.overview.qaAverageScore : "—"}
            note={
              d.overview.qaReviewCount != null
                ? `${d.overview.qaReviewCount} review${d.overview.qaReviewCount === 1 ? "" : "s"}`
                : d.qa.available === false
                  ? "Not available"
                  : undefined
            }
            icon={Scale}
            interactive={d.qa.available === true}
            onClick={d.qa.available === true ? () => onOpenDetails("qa") : undefined}
          />
          <MetricCard
            label="KPI score"
            value={d.overview.kpiComposite ?? "—"}
            note={d.kpi.note && !d.kpi.scorecard ? d.kpi.note : undefined}
            icon={BarChart3}
            interactive={Boolean(d.kpi.scorecard)}
            onClick={d.kpi.scorecard ? () => onOpenDetails("kpi") : undefined}
          />
        </div>
      </section>

      <ResponsibilitiesSection data={d} />

      <section className="space-y-3">
        <SectionHeader title="Activity timeline" description="Events for a selected day in this period (IST)." />
        <ActivityTimeline
          agentId={d.agent.id}
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          periodStartIst={d.period.startIst}
          periodEndIst={d.period.endIst}
          events={d.timeline.events}
        />
      </section>
    </div>
  );
}
