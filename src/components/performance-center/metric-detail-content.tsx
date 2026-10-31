import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/bits";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentDashboard, MetricDrillDown } from "./types";
import { fmtNum, fmtPercent } from "./types";
import { kpiPerformanceHref, productFeedbackHref, qaModuleHref } from "./performance-deep-links";

function ViewMoreDetails({ to }: { to: string }) {
  return (
    <div className="border-t pt-4">
      <Button variant="default" size="sm" asChild>
        <Link to={to}>View more details</Link>
      </Button>
    </div>
  );
}

export function MetricDetailContent({ metric, data }: { metric: MetricDrillDown; data: AgentDashboard }) {
  switch (metric) {
    case "pg-reviews":
      return (
        <div className="space-y-4">
          <RecordList
            emptyTitle="No reviews in this period"
            emptyBody="No Product Guide reviews were recorded for the selected dates."
            rows={data.productGuides.submissions.map((s) => ({
              key: s.id,
              title: s.guideTitle,
              meta: `${formatCalendarDate(s.reviewDateIst)}${s.voluntary ? " · voluntary" : ""}${s.hasIssues ? " · issues flagged" : ""}`,
              href: s.href,
            }))}
          />
          <ViewMoreDetails to="/product-guides/daily-review" />
        </div>
      );
    case "pg-compliance":
      return (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Working days</dt>
              <dd className="text-lg font-semibold tabular-nums">{data.productGuides.eligibleWorkingDays}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Completed</dt>
              <dd className="text-lg font-semibold tabular-nums">{data.productGuides.completedRequiredReviews}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missed</dt>
              <dd
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  data.productGuides.missedRequiredReviews > 0 && "text-amber-700 dark:text-amber-300",
                )}
              >
                {data.productGuides.missedRequiredReviews}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Product Guide compliance</dt>
              <dd className="text-lg font-semibold tabular-nums">{fmtPercent(data.productGuides.compliancePercent)}</dd>
            </div>
          </dl>
          {data.productGuides.weeklyOffConfigured === false ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              No weekly-off schedule applies in this period for this agent. Every calendar day in the range counts as a
              working day except company holidays and approved full-day leave. Configure weekly offs in Shift Calendar
              settings if required reviews should exclude specific days.
            </p>
          ) : null}
          <ul className="divide-y rounded-lg border">
            {data.productGuides.dailyHistory
              .filter((d) => d.required)
              .slice(0, 31)
              .map((d) => (
                <li key={d.dateIst} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>{formatCalendarDate(d.dateIst)}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      d.completed ? "text-muted-foreground" : "text-destructive",
                    )}
                  >
                    {d.completed ? "Completed" : "Missed"}
                  </span>
                </li>
              ))}
          </ul>
          <ViewMoreDetails to="/product-guides/daily-review" />
        </div>
      );
    case "feedback":
      if (data.productFeedback.available !== true) {
        return <Empty title="Not available" body="You do not have permission to view Product Feedback for this agent." />;
      }
      return (
        <div className="space-y-4">
          <RecordList
            emptyTitle="No feedback submitted"
            emptyBody="No Product Feedback records in this period."
            rows={data.productFeedback.items.map((f) => ({
              key: f.id,
              title: f.category,
              meta: `${f.supervisorReview} · ${formatWhen(f.createdAt)}`,
              href: f.href,
            }))}
          />
          <ViewMoreDetails to={productFeedbackHref(data)} />
        </div>
      );
    case "ri-resolved":
      return (
        <div className="space-y-4">
          <RecordList
            emptyTitle="No resolved issues"
            emptyBody="No Reported Issues were resolved during this period."
            rows={data.reportedIssues.period.resolved.map((r) => ({
              key: r.id,
              title: r.title,
              meta: r.resolvedAt ? formatWhen(r.resolvedAt) : "—",
              href: r.href,
            }))}
          />
          <ViewMoreDetails to="/reported-issues" />
        </div>
      );
    case "qa":
      if (data.qa.available !== true) {
        return (
          <Empty
            title="Not available"
            body={"reason" in data.qa && data.qa.reason ? data.qa.reason : "QA details are not available for this agent."}
          />
        );
      }
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {fmtNum(data.qa.reviewCount)} review{data.qa.reviewCount === 1 ? "" : "s"}
            {data.qa.averageScore != null ? ` · average ${data.qa.averageScore}` : ""}
          </p>
          <RecordList
            emptyTitle="No QA reviews"
            emptyBody="No QA reviews in this period."
            rows={data.qa.reviews.map((r) => ({
              key: r.id,
              title: `Ticket ${r.ticketRef}`,
              meta: [
                formatWhen(r.reviewedAt),
                r.reviewerName ? `Reviewer: ${r.reviewerName}` : null,
                `Score ${r.overallScore}`,
                r.acknowledgementStatus && r.acknowledgementStatus !== "not_required"
                  ? `Ack: ${r.acknowledgementStatus}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
              href: r.href,
            }))}
          />
          {data.qa.appeals.items.length > 0 ? (
            <>
              <p className="text-xs font-medium uppercase text-muted-foreground">Appeals in period</p>
              <RecordList
                rows={data.qa.appeals.items.map((a) => ({
                  key: a.id,
                  title: a.status,
                  meta: formatWhen(a.submittedAt),
                  href: a.href,
                }))}
              />
            </>
          ) : null}
          <ViewMoreDetails to={qaModuleHref(data)} />
        </div>
      );
    case "kpi": {
      const card = data.kpi.scorecard;
      if (!card) {
        return (
          <Empty
            title="No KPI scorecard"
            body={data.kpi.note || "Choose a week or month preset to align with KPI reporting periods."}
          />
        );
      }
      const grainLabel =
        data.kpi.grain === "weekly"
          ? `Weekly · ${data.kpi.periodKey ?? "—"}`
          : data.kpi.grain === "monthly"
            ? `Monthly · ${data.kpi.periodKey ?? "—"}`
            : null;
      return (
        <div className="space-y-4 text-sm">
          {grainLabel ? <p className="text-xs text-muted-foreground">KPI reporting: {grainLabel}</p> : null}
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Overall KPI score</p>
            <p className="text-2xl font-semibold tabular-nums">{card.compositeDisplay}</p>
            {card.statusMessage ? <p className="mt-1 text-xs text-muted-foreground">{card.statusMessage}</p> : null}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] table-fixed text-sm">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[29%]" />
                <col className="w-[29%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Component</th>
                  <th className="px-3 py-2.5 font-medium">Actual</th>
                  <th className="px-3 py-2.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {card.metrics.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 align-top leading-snug">{m.label}</td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">{m.actualLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{m.pointsDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ViewMoreDetails to={kpiPerformanceHref(data)} />
        </div>
      );
    }
    default:
      return null;
  }
}

function RecordList({
  rows,
  emptyTitle,
  emptyBody,
}: {
  rows: { key: string; title: string; meta: string; href?: string }[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (rows.length === 0 && emptyTitle) {
    return <Empty title={emptyTitle} body={emptyBody || ""} />;
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {rows.map((row) => (
        <li key={row.key}>
          {row.href ? (
            <Link
              to={row.href}
              className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-foreground">{row.title}</span>
              <span className="text-xs text-muted-foreground">{row.meta}</span>
            </Link>
          ) : (
            <div className="px-4 py-3">
              <span className="font-medium">{row.title}</span>
              <p className="text-xs text-muted-foreground">{row.meta}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
