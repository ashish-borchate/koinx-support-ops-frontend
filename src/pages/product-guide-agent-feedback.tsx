import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilterStat, StatCard } from "@/components/filter-stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { ProductGuideTabLink } from "@/components/product-guide-tabs";

type FeedbackSummary = {
  stats: { totalReviews: number; reviewsWithIssues: number; guidesWithFeedback: number; reviewsToday: number };
  guides: {
    guideId: string;
    guideTitle: string;
    productArea: string;
    reviewCount: number;
    issuesCount: number;
    latestReviewedAt: string;
    latestReviewerName: string;
  }[];
};

function canViewFeedback(roleKey?: string) {
  return roleKey === "admin" || roleKey === "supervisor";
}

export function ProductGuideAgentFeedbackPage() {
  const { effective } = useAuth();
  const [params, setParams] = useSearchParams();
  const hasIssues = params.get("hasIssues") || "all";

  const summary = useQuery({
    queryKey: ["pg-agent-feedback", hasIssues],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (hasIssues === "true") qs.set("hasIssues", "true");
      if (hasIssues === "false") qs.set("hasIssues", "false");
      return api<FeedbackSummary>(`/api/product-guides/agent-feedback?${qs.toString()}`);
    },
    enabled: canViewFeedback(effective?.roleKey),
    staleTime: STALE.operational,
    refetchOnMount: "always",
  });

  if (!canViewFeedback(effective?.roleKey)) {
    return <ErrorBlock message="Agent Feedback is available to Supervisor and Admin only." />;
  }
  if (summary.isLoading) return <LoadingBlock />;
  if (summary.isError || !summary.data) return <ErrorBlock message={summary.error?.message || "Unable to load feedback"} />;

  const data = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Knowledge" title="Agent Feedback" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterStat label="Total reviews" value={data.stats.totalReviews} active={hasIssues === "all"} onClick={() => setParams({})} />
        <FilterStat
          label="Reviews with issues"
          value={data.stats.reviewsWithIssues}
          active={hasIssues === "true"}
          onClick={() => setParams({ hasIssues: "true" })}
        />
        <StatCard label="Guides with feedback" value={data.stats.guidesWithFeedback} />
        <StatCard label="Reviews today" value={data.stats.reviewsToday} />
      </div>
      {data.guides.length === 0 ? (
        <Empty title="No agent reviews yet" body="Submitted daily reviews will appear here grouped by guide." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Guide</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Reviews</th>
                <th className="px-3 py-3 font-medium">With issues</th>
                <th className="px-3 py-3 font-medium">Latest</th>
              </tr>
            </thead>
            <tbody>
              {data.guides.map((row) => (
                <tr key={row.guideId} className="border-t border-border/60 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link to={`/product-guides/agent-feedback/${row.guideId}`} className="font-medium hover:text-primary">
                      {row.guideTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{row.productArea}</td>
                  <td className="px-3 py-3">{row.reviewCount}</td>
                  <td className="px-3 py-3">{row.issuesCount}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.latestReviewerName} · {formatWhen(row.latestReviewedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProductGuideAgentFeedbackDetailPage() {
  const { guideId } = useParams();
  const { effective } = useAuth();
  const [searchParams] = useSearchParams();
  const hasIssues = searchParams.get("hasIssues");

  const detail = useQuery({
    queryKey: ["pg-agent-feedback", guideId, hasIssues],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (hasIssues === "true") qs.set("hasIssues", "true");
      if (hasIssues === "false") qs.set("hasIssues", "false");
      return api<{
        guide: { id: string; title: string; productArea: string; status: string };
        reviews: {
          id: string;
          agentName: string;
          reviewedAt: string;
          reviewDateIst: string;
          rotationId: string;
          hasIssues: boolean;
          answers: Record<string, { answer?: string; details?: string; suggestions?: string }>;
        }[];
      }>(`/api/product-guides/agent-feedback/${guideId}?${qs.toString()}`);
    },
    enabled: Boolean(guideId) && canViewFeedback(effective?.roleKey),
    refetchOnMount: "always",
  });

  if (!canViewFeedback(effective?.roleKey)) {
    return <ErrorBlock message="Agent Feedback is available to Supervisor and Admin only." />;
  }
  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorBlock message={detail.error?.message || "Not found"} />;

  const { guide, reviews } = detail.data;

  return (
    <div className="space-y-6">
      <Link to="/product-guides/agent-feedback" className="text-sm text-muted-foreground hover:text-foreground">← Agent Feedback</Link>
      <PageHeader eyebrow={guide.productArea} title={guide.title} />
      <div className="flex flex-wrap gap-2">
        <ProductGuideTabLink id={guide.id} title={guide.title} className="text-sm text-primary hover:underline">
          Open product guide →
        </ProductGuideTabLink>
      </div>
      <div className="space-y-4">
        {reviews.map((rev) => (
          <Card key={rev.id} className={rev.hasIssues ? "border-amber-200/80" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <span>{rev.agentName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatCalendarDate(rev.reviewDateIst)} · {formatWhen(rev.reviewedAt)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    rev.hasIssues ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {rev.hasIssues ? "Issues identified" : "No issues reported"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Information correct:</strong> {rev.answers.informationCorrect?.answer}
                {rev.answers.informationCorrect?.details ? ` — ${rev.answers.informationCorrect.details}` : ""}</p>
              <p><strong>Screenshots/UI:</strong> {rev.answers.screenshotsAccurate?.answer}
                {rev.answers.screenshotsAccurate?.details ? ` — ${rev.answers.screenshotsAccurate.details}` : ""}</p>
              <p><strong>Missing information:</strong> {rev.answers.missingInformation?.answer}
                {rev.answers.missingInformation?.details ? ` — ${rev.answers.missingInformation.details}` : ""}</p>
              <p><strong>Links:</strong> {rev.answers.linksWorking?.answer}
                {rev.answers.linksWorking?.details ? ` — ${rev.answers.linksWorking.details}` : ""}</p>
              {(rev.answers as { suggestions?: string }).suggestions ? (
                <p><strong>Suggestions:</strong> {(rev.answers as { suggestions?: string }).suggestions}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Rotation · {rev.rotationId.slice(0, 8)}…</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
