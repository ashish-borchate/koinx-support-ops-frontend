import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/bits";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentDashboard, MetricDrillDown } from "./types";
import { fmtNum, fmtPercent } from "./types";

const TITLES: Record<MetricDrillDown, string> = {
  "pg-reviews": "Product Guide reviews",
  "pg-compliance": "Product Guide compliance",
  feedback: "Product Feedback",
  "ri-resolved": "Reported Issues resolved",
  qa: "QA reviews",
  kpi: "KPI scorecard",
};

function kpiTrackerHref(data: AgentDashboard) {
  if (data.kpi.grain === "weekly" && data.kpi.periodKey) {
    return `/kpi?periodType=weekly&week=${data.kpi.periodKey}`;
  }
  if (data.kpi.grain === "monthly" && data.kpi.periodKey) {
    return `/kpi?periodType=monthly&month=${data.kpi.periodKey}`;
  }
  return "/kpi";
}

type Props = {
  open: boolean;
  metric: MetricDrillDown | null;
  data: AgentDashboard;
  onOpenChange: (open: boolean) => void;
};

export function MetricDetailSheet({ open, metric, data, onOpenChange }: Props) {
  const title = metric ? TITLES[metric] : "";

  return (
    <Sheet open={open && Boolean(metric)} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b px-4 py-4 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="break-words">{data.period.label}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-8">
          {metric ? <Body metric={metric} data={data} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Body({ metric, data }: { metric: MetricDrillDown; data: AgentDashboard }) {
  switch (metric) {
    case "pg-reviews":
      return (
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
      );
    case "pg-compliance":
      return (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <dt className="text-xs text-muted-foreground">Eligible working days</dt>
              <dd className="text-lg font-semibold tabular-nums">{data.productGuides.eligibleWorkingDays}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Completed (required days)</dt>
              <dd className="text-lg font-semibold tabular-nums">{data.productGuides.completedRequiredReviews}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missed required days</dt>
              <dd className={cn("text-lg font-semibold tabular-nums", data.productGuides.missedRequiredReviews > 0 && "text-amber-700 dark:text-amber-300")}>
                {data.productGuides.missedRequiredReviews}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Compliance</dt>
              <dd className="text-lg font-semibold tabular-nums">{fmtPercent(data.productGuides.compliancePercent)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Daily eligibility (required working days only)</p>
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
                      d.completed ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
                    )}
                  >
                    {d.completed ? "Completed" : "Missed"}
                  </span>
                </li>
              ))}
          </ul>
          <Button variant="outline" size="sm" asChild>
            <Link to="/product-guides/daily-review">Open daily review</Link>
          </Button>
        </div>
      );
    case "feedback":
      if (data.productFeedback.available !== true) {
        return <Empty title="Not available" body="You do not have permission to view Product Feedback for this agent." />;
      }
      return (
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
      );
    case "ri-resolved":
      return (
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
        <div className="space-y-3">
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
      return (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Overall</p>
            <p className="text-2xl font-semibold tabular-nums">{card.compositeDisplay}</p>
            {card.statusMessage ? <p className="mt-1 text-xs text-muted-foreground">{card.statusMessage}</p> : null}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[280px] table-fixed text-sm">
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[27%]" />
                <col className="w-[27%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Metric</th>
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
          <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
            <Link to={kpiTrackerHref(data)}>Open KPI tracker</Link>
          </Button>
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
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.key}>
          {row.href ? (
            <Link
              to={row.href}
              className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-foreground">{row.title}</span>
              <span className="text-xs text-muted-foreground">{row.meta}</span>
            </Link>
          ) : (
            <div className="px-3 py-2.5">
              <span className="font-medium">{row.title}</span>
              <p className="text-xs text-muted-foreground">{row.meta}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
