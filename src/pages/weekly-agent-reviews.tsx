import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Review = {
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
  amendments: unknown[];
};

export function WeeklyAgentReviewsPage() {
  const { can, viewAs } = useAuth();
  const canManage = can("weekly_reviews.manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [weekStartIst, setWeekStartIst] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("id") || "");
  const readOnly = Boolean(viewAs);

  const rosterQ = useQuery({
    queryKey: ["agent-activity-roster"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/agent-activity/roster"),
    enabled: canManage,
  });

  const suggestedQ = useQuery({
    queryKey: ["weekly-review-suggested-week"],
    queryFn: () => api<{ weekStartIst: string; weekEndIst: string }>("/api/weekly-agent-reviews/suggested-week"),
    enabled: canManage,
  });

  useEffect(() => {
    if (suggestedQ.data?.weekStartIst && !weekStartIst) setWeekStartIst(suggestedQ.data.weekStartIst);
  }, [suggestedQ.data, weekStartIst]);

  useEffect(() => {
    const w = searchParams.get("weekStartIst");
    if (w) setWeekStartIst(w);
    const id = searchParams.get("id");
    if (id) setSelectedId(id);
  }, [searchParams]);

  const listQ = useQuery({
    queryKey: ["weekly-reviews", agentId, weekStartIst],
    queryFn: () => {
      const p = new URLSearchParams();
      if (agentId) p.set("agentId", agentId);
      if (weekStartIst) p.set("weekStartIst", weekStartIst);
      return api<{ reviews: Review[] }>(`/api/weekly-agent-reviews?${p.toString()}`);
    },
  });

  const detailQ = useQuery({
    queryKey: ["weekly-review", selectedId],
    queryFn: () => api<{ review: Review }>(`/api/weekly-agent-reviews/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const review = detailQ.data?.review || listQ.data?.reviews?.[0];
  const [draft, setDraft] = useState<Partial<Review>>({});

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

  const generateM = useMutation({
    mutationFn: () =>
      api<{ review: Review }>("/api/weekly-agent-reviews/generate", {
        method: "POST",
        body: JSON.stringify({ agentId, weekStartIst, refresh: true }),
      }),
    onSuccess: (data) => {
      setSelectedId(data.review.id);
      void queryClient.invalidateQueries({ queryKey: ["weekly-reviews"] });
    },
  });

  const saveM = useMutation({
    mutationFn: () =>
      api<{ review: Review }>(`/api/weekly-agent-reviews/${review!.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, refreshMetrics: false }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["weekly-review", selectedId] }),
  });

  const finalizeM = useMutation({
    mutationFn: () =>
      api<{ review: Review }>(`/api/weekly-agent-reviews/${review!.id}/finalize`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["weekly-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["weekly-review", selectedId] });
    },
  });

  const metrics = review?.metricsSnapshot as {
    productGuides?: { eligibleWorkingDays?: number; completedRequiredReviews?: number; missedRequiredReviews?: number; compliancePercent?: number | null };
    reportedIssues?: { periodResolved?: number; currentlyOverdue?: number; asOfIst?: string };
    qa?: { available?: boolean; averageScore?: number | null; reviewCount?: number };
  } | null;

  if (!can("weekly_reviews.view_own") && !canManage && !can("weekly_reviews.view_team")) {
    return <ErrorBlock message="You do not have access to weekly reviews." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Agent Reviews"
        description="Permanent finalized records with frozen metric snapshots. Drafts refresh from live Hub data until finalized."
        action={
          <Button variant="outline" asChild>
            <Link to="/team-performance">Team Performance</Link>
          </Button>
        }
      />

      {canManage ? (
        <div className="flex flex-wrap gap-3">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {(rosterQ.data?.agents ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={weekStartIst}
            onChange={(e) => setWeekStartIst(e.target.value)}
            placeholder="Week start (Mon YYYY-MM-DD)"
          />
          <Button disabled={readOnly || !agentId || !weekStartIst || generateM.isPending} onClick={() => generateM.mutate()}>
            Generate / refresh draft
          </Button>
        </div>
      ) : null}

      {listQ.isLoading ? <LoadingBlock label="Loading reviews…" /> : null}
      {listQ.data?.reviews.length ? (
        <div className="flex flex-wrap gap-2">
          {listQ.data.reviews.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === selectedId ? "default" : "outline"}
              onClick={() => {
                setSelectedId(r.id);
                setSearchParams({ id: r.id });
              }}
            >
              {r.weekStartIst} · {r.status}
            </Button>
          ))}
        </div>
      ) : (
        !listQ.isLoading && (
          <Empty title="No reviews" body="Generate a draft for an agent and week, or wait for scheduled preparation." />
        )
      )}

      {review ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold">
              Metrics {review.status === "finalized" ? "(snapshot)" : "(live draft)"}
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
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
                {metrics?.qa?.available ? `${metrics.qa.averageScore ?? "—"} avg (${metrics.qa.reviewCount} reviews)` : "—"}
              </li>
            </ul>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/agent-activity?agentId=${review.agentId}`}>Agent dashboard</Link>
            </Button>
          </section>

          {canManage && review.status === "draft" ? (
            <section className="space-y-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold">Reviewer notes</h2>
              {(["strengths", "areasForImprovement", "discussionNotes", "reviewerComments"] as const).map((field) => (
                <label key={field} className="block space-y-1 text-sm">
                  <span className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}</span>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border bg-background p-2"
                    value={(draft[field] as string) || ""}
                    disabled={readOnly}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button disabled={readOnly || saveM.isPending} onClick={() => saveM.mutate()}>
                  Save draft
                </Button>
                <Button variant="secondary" disabled={readOnly || finalizeM.isPending} onClick={() => finalizeM.mutate()}>
                  Finalize review
                </Button>
              </div>
            </section>
          ) : (
            <section className="space-y-2 rounded-xl border bg-card p-4 text-sm shadow-[var(--shadow-card)]">
              <h2 className="font-semibold">Management feedback</h2>
              <p>{review.strengths || "—"}</p>
              <p className="text-muted-foreground">{review.areasForImprovement}</p>
              <p>{review.reviewerComments}</p>
              {review.finalizedAt ? (
                <p className="text-xs text-muted-foreground">Finalized {new Date(review.finalizedAt).toLocaleString()}</p>
              ) : null}
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
