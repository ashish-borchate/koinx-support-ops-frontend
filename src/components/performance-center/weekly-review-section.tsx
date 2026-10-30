import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Empty, LoadingBlock, SectionHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatWeek, lastCompletedWeekStart, recentWeeks } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WeeklyReview = {
  id: string;
  agentId: string;
  weekStartIst: string;
  weekEndIst: string;
  status: string;
  metricsSnapshot: Record<string, unknown> | null;
  strengths: string;
  areasForImprovement: string;
  discussionNotes: string;
  reviewerComments: string;
  actionItems: { title: string; targetDateIst?: string; status?: string; notes?: string }[];
  finalizedAt: string | null;
};

type Props = {
  agentId: string;
  weekStartIst: string;
  selectedReviewId: string;
  onWeekChange: (weekStartIst: string) => void;
  onReviewSelect: (reviewId: string) => void;
  readOnly: boolean;
};

export function WeeklyReviewSection({
  agentId,
  weekStartIst,
  selectedReviewId,
  onWeekChange,
  onReviewSelect,
  readOnly,
}: Props) {
  const { can } = useAuth();
  const canManage = can("weekly_reviews.manage");
  const canView = canManage || can("weekly_reviews.view_team") || can("weekly_reviews.view_own");
  const queryClient = useQueryClient();

  const listQ = useQuery({
    queryKey: ["weekly-reviews", agentId],
    queryFn: () => api<{ reviews: WeeklyReview[] }>(`/api/weekly-agent-reviews?agentId=${agentId}`),
    enabled: canView && Boolean(agentId),
  });

  const detailQ = useQuery({
    queryKey: ["weekly-review", selectedReviewId],
    queryFn: () => api<{ review: WeeklyReview }>(`/api/weekly-agent-reviews/${selectedReviewId}`),
    enabled: Boolean(selectedReviewId),
  });

  const review = detailQ.data?.review;
  const [draft, setDraft] = useState<Partial<WeeklyReview>>({});

  useEffect(() => {
    if (review) {
      setDraft({
        strengths: review.strengths,
        areasForImprovement: review.areasForImprovement,
        discussionNotes: review.discussionNotes,
        reviewerComments: review.reviewerComments,
        actionItems: review.actionItems,
      });
    }
  }, [review?.id]);

  useEffect(() => {
    if (weekStartIst) return;
    onWeekChange(lastCompletedWeekStart());
  }, [weekStartIst, onWeekChange]);

  useEffect(() => {
    if (!weekStartIst || !listQ.data?.reviews?.length) return;
    const match = listQ.data.reviews.find((r) => r.weekStartIst === weekStartIst);
    if (match) onReviewSelect(match.id);
  }, [weekStartIst, listQ.data, onReviewSelect]);

  const history = listQ.data?.reviews ?? [];
  const visibleHistory = canManage ? history : history.filter((r) => r.status === "finalized");
  const activeWeek = weekStartIst || review?.weekStartIst || lastCompletedWeekStart();

  const generateM = useMutation({
    mutationFn: () =>
      api<{ review: WeeklyReview }>("/api/weekly-agent-reviews/generate", {
        method: "POST",
        body: JSON.stringify({ agentId, weekStartIst: activeWeek, refresh: true }),
      }),
    onSuccess: (data) => {
      onReviewSelect(data.review.id);
      onWeekChange(data.review.weekStartIst);
      void queryClient.invalidateQueries({ queryKey: ["weekly-reviews", agentId] });
    },
  });

  const saveM = useMutation({
    mutationFn: () =>
      api<{ review: WeeklyReview }>(`/api/weekly-agent-reviews/${review!.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, refreshMetrics: false }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["weekly-review", selectedReviewId] }),
  });

  const finalizeM = useMutation({
    mutationFn: () =>
      api<{ review: WeeklyReview }>(`/api/weekly-agent-reviews/${review!.id}/finalize`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["weekly-reviews", agentId] });
      void queryClient.invalidateQueries({ queryKey: ["weekly-review", selectedReviewId] });
    },
  });

  if (!canView) return null;

  const metrics = review?.metricsSnapshot as {
    productGuides?: { eligibleWorkingDays?: number; completedRequiredReviews?: number; missedRequiredReviews?: number; compliancePercent?: number | null };
    reportedIssues?: { periodResolved?: number; currentlyOverdue?: number; asOfIst?: string };
    qa?: { available?: boolean; averageScore?: number | null; reviewCount?: number };
  } | null;

  const weekOptions = recentWeeks(16);
  const hasDraftForWeek = history.some((r) => r.weekStartIst === activeWeek && r.status === "draft");
  const showGenerate = canManage && (hasDraftForWeek || !history.some((r) => r.weekStartIst === activeWeek));

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Weekly performance review"
        description="Frozen metrics after finalization. Drafts pull live Hub data until you finalize."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card/60 p-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Review week (Mon–Sun, IST)</p>
          <Select
            value={activeWeek}
            onValueChange={(w) => {
              onWeekChange(w);
              const existing = history.find((r) => r.weekStartIst === w);
              if (existing) onReviewSelect(existing.id);
              else onReviewSelect("");
            }}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((w) => (
                <SelectItem key={w} value={w}>
                  {formatWeek(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && showGenerate ? (
          <Button
            size="sm"
            disabled={readOnly || !activeWeek || generateM.isPending}
            onClick={() => generateM.mutate()}
          >
            {hasDraftForWeek ? "Refresh draft" : "Generate draft"}
          </Button>
        ) : null}
      </div>

      {listQ.isLoading ? <LoadingBlock /> : null}

      {visibleHistory.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleHistory.slice(0, 12).map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === selectedReviewId ? "default" : "outline"}
              className={cn(r.status === "finalized" && r.id !== selectedReviewId && "border-emerald-600/30")}
              onClick={() => {
                onReviewSelect(r.id);
                onWeekChange(r.weekStartIst);
              }}
            >
              {formatWeek(r.weekStartIst)}
              <span className="ml-1.5 capitalize opacity-80">{r.status === "finalized" ? "Finalized" : "Draft"}</span>
            </Button>
          ))}
        </div>
      ) : !listQ.isLoading && !canManage ? (
        <Empty title="No finalized reviews" body="Your supervisor will publish weekly reviews here after finalization." />
      ) : !listQ.isLoading ? (
        <Empty title="No reviews yet" body="Generate a draft for a week or wait for scheduled preparation." />
      ) : null}

      {review ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold">Snapshot metrics {review.status === "finalized" ? "(frozen)" : "(live draft)"}</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>Eligible working days: {metrics?.productGuides?.eligibleWorkingDays ?? "—"}</li>
              <li>
                PG completed / missed: {metrics?.productGuides?.completedRequiredReviews ?? "—"} /{" "}
                {metrics?.productGuides?.missedRequiredReviews ?? "—"} ({metrics?.productGuides?.compliancePercent ?? "—"}%)
              </li>
              <li>Reported Issues resolved: {metrics?.reportedIssues?.periodResolved ?? "—"}</li>
              <li>
                Overdue RIs (as of {metrics?.reportedIssues?.asOfIst ?? "—"}): {metrics?.reportedIssues?.currentlyOverdue ?? "—"}
              </li>
              <li>
                QA:{" "}
                {metrics?.qa?.available
                  ? `${metrics.qa.averageScore ?? "—"} avg (${metrics.qa.reviewCount ?? 0} reviews)`
                  : "—"}
              </li>
            </ul>
          </div>

          {canManage && review.status === "draft" ? (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h3 className="font-semibold text-sm">Reviewer notes</h3>
              {(["strengths", "areasForImprovement", "discussionNotes", "reviewerComments"] as const).map((field) => (
                <label key={field} className="block space-y-1 text-sm">
                  <span className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}</span>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border bg-background p-2 text-sm"
                    value={(draft[field] as string) || ""}
                    disabled={readOnly}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={readOnly || saveM.isPending} onClick={() => saveM.mutate()}>
                  Save draft
                </Button>
                <Button size="sm" variant="secondary" disabled={readOnly || finalizeM.isPending} onClick={() => finalizeM.mutate()}>
                  Finalize review
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
              <h3 className="font-semibold">Management feedback</h3>
              <p>{review.strengths || "—"}</p>
              <p className="text-muted-foreground">{review.areasForImprovement}</p>
              <p>{review.discussionNotes}</p>
              <p>{review.reviewerComments}</p>
              {review.finalizedAt ? (
                <p className="text-xs text-muted-foreground">Finalized {new Date(review.finalizedAt).toLocaleString()}</p>
              ) : null}
              {review.actionItems?.length ? (
                <ul className="mt-2 space-y-1 border-t pt-2 text-muted-foreground">
                  {review.actionItems.map((item, i) => (
                    <li key={i}>
                      {item.title}
                      {item.targetDateIst ? ` · ${item.targetDateIst}` : ""}
                      {item.status ? ` · ${item.status}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : selectedReviewId && detailQ.isLoading ? (
        <LoadingBlock />
      ) : null}
    </section>
  );
}
