import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { QaModuleNav } from "@/components/qa-module-nav";
import { QaPerformanceHeader } from "@/components/qa-section-shell";
import type { QaMode, Review } from "@/pages/qa-types";
import {
  asRandomAuditDetail,
  QaRandomAuditIndicator,
  RandomAuditFormDialog,
  RandomAuditPanel,
} from "@/pages/qa-random-audit-ui";
import type { QaRandomAuditDetail } from "@/pages/qa-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DataTableShell, Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currentWeekStart, formatMonth, formatNumber, formatWeek, formatWhen, monthKey, recentMonths, recentWeeks } from "@/lib/format";
import { cn } from "@/lib/utils";
import { teamQaAverageFromAgentReviews } from "@/lib/qa-team-aggregate";
import { qaRatingValidationMessage } from "@/lib/qa-rating-validation";
import { QaCriterionScoreGrid } from "@/components/qa-criterion-score-card";
import { QaOverallScoreTrigger } from "@/components/qa-overall-score-breakdown";
import { QaKoinxCriterionCard, QaLegacyCriterionField } from "@/components/qa-koinx-criterion-card";
import {
  effectiveQaScore,
  formatQaTotal,
  isKoinxRubric,
  QA_RUBRIC_KOINX_V1,
  qaScoreAdjusted,
  ratingFromCriterion,
  weightedPointsFromRating,
  type QaCriterionMeta,
} from "@/lib/qa-rubric";
import { QaAppealSubmitDialog } from "@/components/qa-appeal-submit-dialog";
import { QaWorkflowSummaryCards, useQaWorkflowSummary } from "@/components/qa-workflow-summary-cards";

type AgentDirectoryEntry = { id: string; name: string };

function hasActiveRandomAudit(review: Review) {
  const detail = asRandomAuditDetail(review.randomAudit);
  if (detail) return detail.isActive;
  return Boolean(review.supervisorRandomAuditAt) && !review.legacyRandomAuditOnly;
}

function canAuditThisQa(review: Review, canPerform: boolean, actorId: string) {
  return (
    canPerform &&
    (review.qaMode ?? "agent_qa") === "agent_qa" &&
    review.reviewerRoleKey === "senior_agent" &&
    review.reviewerId !== actorId &&
    !hasActiveRandomAudit(review) &&
    !review.legacyRandomAuditOnly
  );
}

function showRandomAuditSection(review: Review) {
  return Boolean(review.randomAudit) || Boolean(review.legacyRandomAuditOnly);
}

function randomAuditDetailFromReview(review: Review): QaRandomAuditDetail | null {
  return asRandomAuditDetail(review.randomAudit);
}

type QaListResponse = {
  qaMode?: QaMode;
  average: number | null;
  reviewsCompleted: number;
  coachingNeeded: number;
  agentsReviewed: number;
  seniorAgentsReviewed?: number;
  reviews: Review[];
  agents?: AgentDirectoryEntry[];
};

function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToDateInput(iso: string) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return localDateInputValue(new Date(iso));
}

function formatReviewDate(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function hasOpenCoaching(review: Review) {
  return Boolean(review.coachingRequired) || review.coachingItems.some((item) => item.status === "open");
}

function QaSummaryCard({
  label,
  value,
  note,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  value: string;
  note?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = cn(
    "w-full rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left shadow-[var(--shadow-card)]",
    onClick && !disabled && "cursor-pointer transition-colors",
    onClick && !disabled && !selected && "hover:bg-muted/30",
    onClick && !disabled && selected && "hover:bg-primary/30",
    selected && "border-transparent bg-primary/25 shadow-none dark:bg-primary/30",
    disabled && "cursor-not-allowed opacity-50",
  );
  const inner = (
    <>
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-muted-foreground">{note}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function QaListPage() {
  const { can, canMutate, user, effective } = useAuth();
  const [searchParams] = useSearchParams();
  const ackFilter = searchParams.get("ack");
  const criticalOnly = searchParams.get("critical") === "1";
  const qaMode: QaMode = searchParams.get("qaMode") === "senior_agent_qa" ? "senior_agent_qa" : "agent_qa";
  const isSeniorMode = qaMode === "senior_agent_qa";
  const roleKey = effective?.roleKey ?? "";
  const isCanonicalAgent = roleKey === "agent" || roleKey === "tech_agent";
  const isSeniorAgentRole = roleKey === "senior_agent";
  const teamView = can("qa.view_team");
  const showSubjectFilter = teamView && !(isSeniorAgentRole && isSeniorMode);
  const showNewReviewButton = isSeniorMode ? canMutate("qa.senior_agent_qa") : canMutate("qa.create");

  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [week, setWeek] = useState(() => currentWeekStart());
  const [month, setMonth] = useState(monthKey());
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [coachingOnly, setCoachingOnly] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

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
    if (agentParam && showSubjectFilter) {
      setAgentFilter(agentParam);
    }
  }, [searchParams, showSubjectFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQ(search.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setCoachingOnly(false);
  }, [week, month, periodType, agentFilter, qaMode]);

  const workflowSummary = useQaWorkflowSummary();

  const query = useQuery({
    queryKey: ["qa", qaMode, periodType, week, month, agentFilter],
    queryFn: () => {
      const params = new URLSearchParams({ periodType, qaMode });
      if (periodType === "weekly") params.set("week", week);
      else params.set("month", month);
      if (isSeniorAgentRole && isSeniorMode && effective?.id) {
        params.set("agentId", effective.id);
      } else if (showSubjectFilter && agentFilter !== "all") {
        params.set("agentId", agentFilter);
      }
      return api<QaListResponse>(`/api/qa?${params.toString()}`);
    },
  });

  const agents = useMemo(() => query.data?.agents ?? [], [query.data]);

  const reviews = useMemo(() => {
    if (!query.data) return [];
    let list = query.data.reviews;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (review) =>
          review.ticketRef.toLowerCase().includes(q) ||
          review.ticketSubject.toLowerCase().includes(q) ||
          review.agentName.toLowerCase().includes(q),
      );
    }
    if (ackFilter === "pending") {
      list = list.filter((review) => review.acknowledgementStatus === "pending");
    }
    if (criticalOnly) {
      list = list.filter((review) => review.criticalError?.flagged);
    }
    if (coachingOnly) {
      list = list.filter((review) => hasOpenCoaching(review));
    }
    return list;
  }, [query.data, searchQ, ackFilter, criticalOnly, coachingOnly]);

  const visibleStats = useMemo(() => {
    if (query.data && !searchQ) {
      return {
        average: query.data.average,
        reviewsCompleted: query.data.reviewsCompleted,
        coachingNeeded: query.data.coachingNeeded,
        agentsReviewed: query.data.agentsReviewed,
        seniorAgentsReviewed: query.data.seniorAgentsReviewed ?? 0,
      };
    }
    const coachingNeeded = reviews.filter((review) => hasOpenCoaching(review)).length;
    if (!isSeniorMode) {
      const agg = teamQaAverageFromAgentReviews(
        reviews.map((review) => ({
          agentId: review.agentId,
          overallScore: review.overallScore,
          effectiveOverallScore: review.effectiveOverallScore,
        })),
      );
      return {
        average: agg.teamAverage,
        reviewsCompleted: agg.reviewCount,
        coachingNeeded,
        agentsReviewed: agg.teamAgentCount,
        seniorAgentsReviewed: 0,
      };
    }
    const scores = reviews.map((review) => effectiveQaScore(review));
    const average = scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null;
    const subjects = new Set(reviews.map((review) => review.agentId)).size;
    return {
      average,
      reviewsCompleted: reviews.length,
      coachingNeeded,
      agentsReviewed: 0,
      seniorAgentsReviewed: subjects,
    };
  }, [isSeniorMode, query.data, reviews, searchQ]);

  const selected = reviews.find((review) => review.id === drawerId) ?? query.data?.reviews.find((review) => review.id === drawerId) ?? null;
  const coachingPct =
    visibleStats.reviewsCompleted > 0
      ? `${Math.round((visibleStats.coachingNeeded / visibleStats.reviewsCompleted) * 100)}% of reviews`
      : undefined;

  const emptyMessage = coachingOnly
    ? "No QA evaluations need coaching for this period."
    : searchQ
      ? "No QA evaluations match these filters."
      : agentFilter !== "all"
        ? "No QA evaluations for this period."
      : periodType === "weekly"
        ? "No QA evaluations for this week."
        : "No QA evaluations for this month.";

  if ((isCanonicalAgent || roleKey === "tech_agent") && isSeniorMode) {
    return <Navigate to="/qa" replace />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <QaPerformanceHeader />
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto shrink-0">
          <Select value={periodType} onValueChange={(value) => setPeriodType(value as "weekly" | "monthly")}>
            <SelectTrigger className="h-8 w-[7.5rem]" aria-label="Period type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          {periodType === "weekly" ? (
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Period">
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
              <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...recentMonths()].reverse().map((item) => (
                  <SelectItem key={item} value={item}>{formatMonth(item)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showSubjectFilter ? (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-8 w-[9.5rem]" aria-label={isSeniorMode ? "Senior Agent" : "Agent"}>
                <SelectValue placeholder={isSeniorMode ? "All senior agents" : "All agents"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isSeniorMode ? "All senior agents" : "All agents"}</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {showNewReviewButton ? (
            <Button size="sm" className="h-8 gap-1" asChild>
              <Link to={isSeniorMode ? "/qa/new?qaMode=senior_agent_qa" : "/qa/new"}>
                <Plus className="size-3.5" />
                New QA Review
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <QaModuleNav />
      <QaWorkflowSummaryCards counters={workflowSummary.data?.counters} />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}

      {query.data ? (
        <>
          <div className={cn("grid gap-2", teamView ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
            <QaSummaryCard
              label={teamView && !isSeniorMode && agentFilter === "all" ? "Team QA" : "QA score"}
              value={visibleStats.average == null ? "N/A" : `${formatNumber(visibleStats.average, 1)}/100`}
              note={
                teamView && !isSeniorMode && agentFilter === "all" && visibleStats.agentsReviewed > 0
                  ? `${visibleStats.agentsReviewed} evaluated agents · ${visibleStats.reviewsCompleted} reviews`
                  : teamView && !isSeniorMode && agentFilter !== "all" && visibleStats.reviewsCompleted > 0
                    ? `${visibleStats.reviewsCompleted} review${visibleStats.reviewsCompleted === 1 ? "" : "s"}`
                    : "Agent QA average"
              }
            />
            <QaSummaryCard label="Reviews completed" value={formatNumber(visibleStats.reviewsCompleted, 0)} note="This period" />
            <QaSummaryCard
              label="Need coaching"
              value={formatNumber(visibleStats.coachingNeeded, 0)}
              note={coachingOnly ? "Filter on · click to clear" : coachingPct}
              selected={coachingOnly}
              disabled={visibleStats.coachingNeeded === 0}
              onClick={() => setCoachingOnly((on) => !on)}
            />
            {teamView ? (
              <QaSummaryCard
                label={isSeniorMode ? "Senior agents reviewed" : "Agents reviewed"}
                value={formatNumber(isSeniorMode ? visibleStats.seniorAgentsReviewed ?? 0 : visibleStats.agentsReviewed, 0)}
                note="This period"
              />
            ) : null}
          </div>

          <section className="space-y-3">
            <SectionHeader title="QA evaluations" />
            <Input
              className="h-8 max-w-md"
              placeholder="Search ticket ID, subject, or agent…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search QA evaluations"
            />

            {reviews.length === 0 ? <Empty title="No evaluations" body={emptyMessage} /> : null}

            <DataTableShell className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ticket</th>
                    <th className="px-3 py-2 font-medium">Ticket date</th>
                    <th className="px-3 py-2 font-medium">{isSeniorMode ? "Senior Agent" : "Agent"}</th>
                    <th className="px-3 py-2 font-medium">Query category</th>
                    <th className="px-3 py-2 font-medium">QA score</th>
                    <th className="px-3 py-2 font-medium">Need coaching</th>
                    <th className="px-3 py-2 font-medium">Reviewed by</th>
                    <th className="w-10 px-2 py-2" aria-label="View" />
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr
                      key={review.id}
                      className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                      onClick={() => setDrawerId(review.id)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">#{review.ticketRef}</p>
                        <p className="max-w-[14rem] truncate text-xs text-muted-foreground">{review.ticketSubject}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{review.ticketDate ? formatReviewDate(review.ticketDate) : "N/A"}</td>
                      <td className="px-3 py-2.5">{review.agentName}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 text-muted-foreground" title={review.queryCategory || undefined}>
                        {review.queryCategory || "N/A"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium">
                        <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          <span>{formatQaTotal(effectiveQaScore(review))}</span>
                          {qaScoreAdjusted(review) ? (
                            <span className="text-xs font-normal text-muted-foreground">
                              (was {formatQaTotal(review.overallScore)})
                            </span>
                          ) : null}
                          {review.randomAudit ? (
                            <QaRandomAuditIndicator outcome={review.randomAudit.outcome} />
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{review.coachingRequired || hasOpenCoaching(review) ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{review.reviewerName}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <div className="space-y-2 md:hidden">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left shadow-[var(--shadow-card)]"
                  onClick={() => setDrawerId(review.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">#{review.ticketRef} · {review.agentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{review.ticketSubject}</p>
                  </div>
                  <span className="inline-flex flex-col items-end gap-0.5 text-sm font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {formatQaTotal(effectiveQaScore(review))}
                      {review.randomAudit ? <QaRandomAuditIndicator outcome={review.randomAudit.outcome} /> : null}
                    </span>
                    {qaScoreAdjusted(review) ? (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        was {formatQaTotal(review.overallScore)}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <QaReviewDialog review={selected} actorId={user?.id ?? ""} open={Boolean(selected)} onClose={() => setDrawerId(null)} />
    </div>
  );
}

function QaDeleteConfirmDialog({
  review,
  open,
  onOpenChange,
  onDeleted,
}: {
  review: Pick<Review, "id" | "ticketRef" | "agentName">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const removeReview = useMutation({
    mutationFn: () => api<{ ok: boolean }>(`/api/qa/${review.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("QA review deleted");
      onOpenChange(false);
      onDeleted();
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Do you want to delete?</DialogTitle>
          <DialogDescription>
            QA review for ticket #{review.ticketRef} ({review.agentName}) will be removed permanently. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={removeReview.isPending} onClick={() => removeReview.mutate()}>
            Delete review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QaReviewDialog({
  review,
  actorId,
  open,
  onClose,
}: {
  review: Review | null;
  actorId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { canMutate, user, readOnly } = useAuth();
  const client = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const canPerformAudit = canMutate("qa.random_audit.perform");

  const detailQuery = useQuery({
    queryKey: ["qa", review?.id],
    queryFn: () =>
      api<{ review: Review; appealContext?: { canSubmitAppeal: boolean } | null }>(`/api/qa/${review!.id}`),
    enabled: open && Boolean(review?.id),
  });
  const displayReview = detailQuery.data?.review ?? review;

  const acknowledge = useMutation({
    mutationFn: () => api(`/api/qa/${displayReview?.id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Review acknowledged");
      void detailQuery.refetch();
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["qa-workflow-summary"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!review || !displayReview) return null;

  const needCoaching = hasOpenCoaching(displayReview);
  const isOwnReview = user?.id === displayReview.agentId;
  const showAcknowledge =
    isOwnReview &&
    !readOnly &&
    displayReview.acknowledgementStatus === "pending" &&
    (displayReview.qaMode ?? "agent_qa") === "agent_qa";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="grid max-h-[90vh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="border-b border-border/50 px-5 py-4 pr-12">
            <DialogTitle className="text-base">QA review · #{displayReview.ticketRef}</DialogTitle>
            <DialogDescription className="line-clamp-2 text-left">{displayReview.ticketSubject}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-3 sm:gap-x-6">
              <QaMetaCell label="Agent" value={displayReview.agentName} />
              <QaMetaCell
                label="Ticket date"
                value={displayReview.ticketDate ? formatReviewDate(displayReview.ticketDate) : "N/A"}
              />
              <QaMetaCell label="Evaluation date" value={formatReviewDate(displayReview.reviewedAt)} />
              <QaMetaCell label="Query category" value={displayReview.queryCategory || "N/A"} />
              <QaMetaCell label="Reviewed by" value={displayReview.reviewerName} />
              <QaMetaCell label="Need coaching" value={needCoaching ? "Yes" : "No"} />
            </div>

            {canAuditThisQa(displayReview, canPerformAudit, actorId) ? (
              <Button size="sm" variant="secondary" onClick={() => setAuditOpen(true)}>Audit this QA</Button>
            ) : null}

            {showRandomAuditSection(displayReview) ? (
              <RandomAuditPanel
                audit={randomAuditDetailFromReview(displayReview)}
                legacyOnly={displayReview.legacyRandomAuditOnly}
                onChanged={() => {
                  void client.invalidateQueries({ queryKey: ["qa"] });
                  void detailQuery.refetch();
                }}
              />
            ) : null}

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evaluation</p>
              <QaCriterionScoreGrid
                className="mt-2.5"
                criteria={displayReview.criteria}
                showRating={isKoinxRubric(displayReview.rubricVersion)}
              />
              <p className="mt-2.5 text-xs text-muted-foreground">
                Criterion comments and reviewer notes are on the full evaluation page.
              </p>
              <div className={cn("mt-3", qaDialogInsetRow)}>
                <span className="text-xs font-semibold text-muted-foreground">Overall QA score</span>
                <QaOverallScoreTrigger
                  size="sm"
                  displayScore={displayReview.effectiveOverallScore ?? displayReview.overallScore}
                  originalScore={
                    displayReview.effectiveOverallScore != null &&
                    displayReview.effectiveOverallScore !== displayReview.overallScore
                      ? displayReview.overallScore
                      : null
                  }
                  criteria={displayReview.criteria}
                />
              </div>
            </div>

            {displayReview.summary ? (
              <div className={qaDialogInsetBlock}>
                <p className="text-xs font-semibold text-muted-foreground">Reviewer comments</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{displayReview.summary}</p>
              </div>
            ) : null}

            {needCoaching && displayReview.linkedCoaching ? (
              <div className={qaDialogInsetRow}>
                <span className="text-xs font-semibold text-muted-foreground">Coaching Center</span>
                <Button size="sm" variant="outline" className="h-8 shrink-0" asChild>
                  <Link to={displayReview.linkedCoaching.href} onClick={() => onClose()}>
                    {displayReview.linkedCoaching.status}
                    <ChevronRight className="size-3.5 opacity-70" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-border/50 bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {canMutate("qa.delete") ? (
                <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {showAcknowledge ? (
                <Button size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
                  Acknowledge review
                </Button>
              ) : null}
              {canMutate("qa.edit") ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/qa/${displayReview.id}/edit`} onClick={() => onClose()}>Edit review</Link>
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/qa/${displayReview.id}`} onClick={() => onClose()}>Full page</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QaDeleteConfirmDialog
        review={review}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onClose}
      />

      {auditOpen ? (
        <RandomAuditFormDialog
          qaReviewId={review.id}
          ticketRef={review.ticketRef}
          open={auditOpen}
          onClose={() => {
            setAuditOpen(false);
            void client.invalidateQueries({ queryKey: ["qa"] });
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

const qaDialogInsetRow =
  "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5";
const qaDialogInsetBlock = "rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5";

function QaMetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium leading-snug break-words text-foreground">{value}</p>
    </div>
  );
}

export function QaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { canMutate, user, readOnly, effective } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const workflowSummary = useQaWorkflowSummary();
  const query = useQuery({
    queryKey: ["qa", id],
    queryFn: () =>
      api<{
        review: Review;
        appealContext: {
          canSubmitAppeal: boolean;
          appealWindowOpen: boolean;
          appealDeadline: string;
          canEscalate?: boolean;
          escalationDeadline?: string | null;
          activeAppeal: { id: string; status: string; href: string } | null;
          latestAppeal: { id: string; status: string; href: string } | null;
          agentAppealAction?: {
            kind: string;
            label: string;
            href?: string;
            status?: string;
            escalationDeadline?: string;
          } | null;
        } | null;
      }>(`/api/qa/${id}`),
  });
  const acknowledge = useMutation({
    mutationFn: () => api(`/api/qa/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Review acknowledged");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const supervisorCriticalAck = useMutation({
    mutationFn: (resolutionNote: string) =>
      api(`/api/qa/${id}/critical-error/supervisor-acknowledge`, {
        method: "POST",
        body: JSON.stringify({ resolutionNote }),
      }),
    onSuccess: () => {
      toast.success("Critical error review recorded");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const review = query.data!.review;
  const appealContext = query.data!.appealContext;
  const canSupervisorCriticalAck =
    (effective?.roleKey === "supervisor" || effective?.roleKey === "admin") &&
    review.criticalError?.flagged &&
    !review.criticalError.supervisorAcknowledgedAt;
  const performAudit =
    review.canPerformRandomAudit ?? canAuditThisQa(review, canMutate("qa.random_audit.perform"), user?.id ?? "");
  const isOwnReview = user?.id === review.agentId;
  const showAcknowledge =
    isOwnReview && !readOnly && review.acknowledgementStatus === "pending" && (review.qaMode ?? "agent_qa") === "agent_qa";
  const displayScore = review.effectiveOverallScore ?? review.overallScore;
  const agentAppealAction = appealContext?.agentAppealAction;
  const showAppealButton =
    isOwnReview &&
    !readOnly &&
    agentAppealAction?.kind === "submit" &&
    appealContext?.canSubmitAppeal &&
    isKoinxRubric(review.rubricVersion);

  return (
    <div className="space-y-4">
      <QaModuleNav />
      <QaWorkflowSummaryCards counters={workflowSummary.data?.counters} />
      <PageHeader
        eyebrow={review.ticketRef}
        title={review.ticketSubject?.trim() ? review.ticketSubject : `Ticket ${review.ticketRef}`}
        action={
          canMutate("qa.edit") || canMutate("qa.delete") ? (
            <div className="flex flex-wrap items-center gap-2">
              {canMutate("qa.edit") ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/qa/${review.id}/edit`}>Edit review</Link>
                </Button>
              ) : null}
              {canMutate("qa.delete") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
      <QaDeleteConfirmDialog
        review={review}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate("/qa")}
      />
      {performAudit ? (
        <div>
          <Button size="sm" variant="secondary" onClick={() => setAuditOpen(true)}>Audit this QA</Button>
        </div>
      ) : null}
      {showRandomAuditSection(review) ? (
        <RandomAuditPanel
          audit={randomAuditDetailFromReview(review)}
          legacyOnly={review.legacyRandomAuditOnly}
          onChanged={() => void query.refetch()}
        />
      ) : null}
      {auditOpen ? (
        <RandomAuditFormDialog
          qaReviewId={review.id}
          ticketRef={review.ticketRef}
          open={auditOpen}
          onClose={() => {
            setAuditOpen(false);
            void query.refetch();
          }}
        />
      ) : null}
      <p className="text-sm text-muted-foreground">{review.agentName} · scored by {review.reviewerName} · {new Date(review.reviewedAt).toLocaleDateString("en-IN")}</p>
      {review.criticalError?.flagged ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-semibold">Critical error flagged</p>
          <p className="mt-1">
            {review.criticalError.categoryLabel || review.criticalError.category}
            {review.criticalError.description ? ` — ${review.criticalError.description}` : ""}
          </p>
          {review.criticalError.supervisorAcknowledgedAt ? (
            <p className="mt-2 text-xs">
              Supervisor review recorded
              {review.criticalError.supervisorAcknowledgedByName
                ? ` by ${review.criticalError.supervisorAcknowledgedByName}`
                : ""}
              {review.criticalError.supervisorAckResolutionNote
                ? ` — ${review.criticalError.supervisorAckResolutionNote}`
                : ""}
            </p>
          ) : canSupervisorCriticalAck ? (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={supervisorCriticalAck.isPending}
              onClick={() => {
                const note = window.prompt("Optional resolution note:") || "";
                supervisorCriticalAck.mutate(note);
              }}
            >
              Acknowledge critical error review
            </Button>
          ) : null}
        </div>
      ) : null}
      {review.acknowledgementStatus && review.acknowledgementStatus !== "not_required" ? (
        <p className="text-sm text-muted-foreground">
          Acknowledgement:{" "}
          <span className="font-medium text-foreground">
            {review.acknowledgementStatus === "pending" ? "Pending" : "Acknowledged"}
            {review.acknowledgedAt ? ` · ${formatWhen(review.acknowledgedAt)}` : ""}
          </span>
        </p>
      ) : null}
      {isOwnReview && isKoinxRubric(review.rubricVersion) && appealContext && agentAppealAction?.kind === "escalate" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Reviewer decision recorded</p>
          <p className="mt-1 text-muted-foreground">
            If you disagree with the reviewer&apos;s decision, you can request a final review by your supervisor before
            the escalation deadline
            {appealContext.escalationDeadline ? ` (${formatWhen(appealContext.escalationDeadline)})` : ""}.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {showAcknowledge ? (
          <Button size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
            Acknowledge review
          </Button>
        ) : null}
        {showAppealButton && appealContext ? (
          <Button size="sm" variant="secondary" onClick={() => setAppealOpen(true)}>
            {agentAppealAction?.label || "Submit Appeal"}
          </Button>
        ) : null}
        {!readOnly &&
        isOwnReview &&
        agentAppealAction &&
        agentAppealAction.kind !== "submit" &&
        agentAppealAction.href ? (
          <Button
            size="sm"
            variant={agentAppealAction.kind === "escalate" ? "default" : "outline"}
            asChild
          >
            <Link to={agentAppealAction.href}>{agentAppealAction.label}</Link>
          </Button>
        ) : null}
        {appealContext && !appealContext.appealWindowOpen && isOwnReview && isKoinxRubric(review.rubricVersion) && !appealContext.latestAppeal ? (
          <p className="text-sm text-muted-foreground self-center">Appeal window closed.</p>
        ) : null}
        {appealContext?.appealWindowOpen && isOwnReview && isKoinxRubric(review.rubricVersion) && !appealContext.latestAppeal ? (
          <p className="text-sm text-muted-foreground self-center">
            Appeal deadline: {formatWhen(appealContext.appealDeadline)}
          </p>
        ) : null}
      </div>
      {showAppealButton && appealContext ? (
        <QaAppealSubmitDialog
          review={review}
          appealDeadline={appealContext.appealDeadline}
          open={appealOpen}
          onOpenChange={setAppealOpen}
        />
      ) : null}
      <QaOverallScoreTrigger
        displayScore={displayScore}
        originalScore={displayScore !== review.overallScore ? review.overallScore : null}
        criteria={review.criteria}
      />
      {review.summary ? <p className="max-w-2xl text-sm">{review.summary}</p> : null}
      <div>
        <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evaluation</p>
        <QaCriterionScoreGrid
          criteria={review.criteria}
          showRating={isKoinxRubric(review.rubricVersion)}
          showComment
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Need coaching</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {review.coachingItems.length === 0 ? <p className="text-muted-foreground">No coaching items.</p> : null}
          {review.coachingItems.map((item) => (
            <p key={item.id || item.text}>{item.status === "done" ? "Done" : "Open"} · {item.text}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function QaFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const qaMode: QaMode = searchParams.get("qaMode") === "senior_agent_qa" ? "senior_agent_qa" : "agent_qa";
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = useQuery({
    queryKey: ["qa", id],
    queryFn: () => api<{ review: Review }>(`/api/qa/${id}`),
    enabled: Boolean(id),
  });
  const formModeEarly = existing.data?.review?.qaMode ?? qaMode;
  const meta = useQuery({
    queryKey: ["qa-meta", formModeEarly],
    queryFn: () =>
      api<{
        defaultRubricVersion: string;
        criteria: QaCriterionMeta[];
        rubrics?: Record<string, QaCriterionMeta[]>;
        criticalErrorCategories: { key: string; label: string }[];
        queryCategories: string[];
        agents: { id: string; name: string }[];
        seniorAgents: { id: string; name: string }[];
      }>(`/api/qa/meta?qaMode=${formModeEarly}`),
  });
  const review = existing.data?.review;
  const [agentId, setAgentId] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [queryCategory, setQueryCategory] = useState("");
  const [ticketDate, setTicketDate] = useState("");
  const [evaluationDate, setEvaluationDate] = useState(localDateInputValue());
  const [summary, setSummary] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [coachingRequired, setCoachingRequired] = useState(false);
  const [coachingNote, setCoachingNote] = useState("");
  const [criticalErrorFlagged, setCriticalErrorFlagged] = useState(false);
  const [criticalErrorCategory, setCriticalErrorCategory] = useState("");
  const [criticalErrorDescription, setCriticalErrorDescription] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [criterionCommentErrors, setCriterionCommentErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id && !review) return;
    if (!id && hydrated) return;
    if (review) {
      setAgentId(review.agentId);
      setTicketRef(review.ticketRef);
      setQueryCategory(review.queryCategory || "");
      setTicketDate(review.ticketDate || "");
      setEvaluationDate(isoToDateInput(review.reviewedAt));
      setSummary(review.summary);
      setCoachingRequired(Boolean(review.coachingRequired ?? review.coachingItems.length > 0));
      setCoachingNote(review.coachingItems.map((item) => item.text).join("\n"));
      setCriticalErrorFlagged(Boolean(review.criticalError?.flagged));
      setCriticalErrorCategory(review.criticalError?.category || "");
      setCriticalErrorDescription(review.criticalError?.description || "");
      const nextRatings: Record<string, string> = {};
      const nextScores: Record<string, string> = {};
      const nextComments: Record<string, string> = {};
      for (const item of review.criteria) {
        nextComments[item.key] = item.comment || "";
        if (isKoinxRubric(review.rubricVersion)) {
          nextRatings[item.key] = String(ratingFromCriterion(item));
        } else {
          nextScores[item.key] = String(item.score);
        }
      }
      setRatings(nextRatings);
      setScores(nextScores);
      setComments(nextComments);
    }
    setHydrated(true);
  }, [hydrated, id, review]);

  const formMode = review?.qaMode ?? qaMode;
  const rubricVersion = review?.rubricVersion ?? meta.data?.defaultRubricVersion ?? QA_RUBRIC_KOINX_V1;
  const useKoinx = isKoinxRubric(rubricVersion);
  const criteria: QaCriterionMeta[] =
    (meta.data?.rubrics?.[rubricVersion] as QaCriterionMeta[] | undefined) ||
    review?.criteria.map((c) => ({
      key: c.key,
      label: c.label,
      maxScore: c.maxScore,
      description: "",
    })) ||
    meta.data?.criteria ||
    [];

  const ready = meta.data && (!id || review);
  const scoreFor = (key: string) => scores[key] ?? String(review?.criteria.find((item) => item.key === key)?.score ?? "");
  const ratingFor = (key: string) => {
    if (ratings[key] !== undefined) return ratings[key];
    const row = review?.criteria.find((item) => item.key === key);
    if (!row) return "";
    return isKoinxRubric(review?.rubricVersion) ? String(ratingFromCriterion(row)) : "";
  };
  const commentFor = (key: string) => comments[key] ?? review?.criteria.find((item) => item.key === key)?.comment ?? "";

  const total = useMemo(() => {
    if (useKoinx) {
      let sum = 0;
      let complete = true;
      for (const item of criteria) {
        const raw = ratingFor(item.key);
        if (!raw) {
          complete = false;
          continue;
        }
        sum += weightedPointsFromRating(Number(raw), item.maxScore);
      }
      return complete ? Math.round(sum * 100) / 100 : null;
    }
    return criteria.reduce((sum, item) => sum + (Number(scoreFor(item.key)) || 0), 0);
  }, [criteria, useKoinx, ratings, scores, review]);

  const save = useMutation({
    mutationFn: () => {
      if (useKoinx) {
        const errors: Record<string, string> = {};
        for (const item of criteria) {
          const raw = ratingFor(item.key);
          if (!raw) {
            toast.error(`Enter a rating for “${item.label}”.`);
            throw new Error("Missing ratings");
          }
          const invalid = qaRatingValidationMessage(raw);
          if (invalid) {
            toast.error(`${item.label}: ${invalid}`);
            throw new Error("Invalid rating");
          }
          const rating = Number(raw);
          if (rating < 10 && commentFor(item.key).trim().length < 3) {
            errors[item.key] = "Comment required when rating is below 10.";
          }
        }
        setCriterionCommentErrors(errors);
        if (Object.keys(errors).length > 0) {
          throw new Error("Add required criterion comments");
        }
        if (criticalErrorFlagged) {
          if (!criticalErrorCategory) throw new Error("Select a critical-error category");
          if (criticalErrorDescription.trim().length < 3) throw new Error("Critical-error description is required");
        }
      }
      return api<{ review: Review }>(id ? `/api/qa/${id}` : "/api/qa", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          qaMode: review?.qaMode ?? qaMode,
          agentId: agentId || review?.agentId,
          ticketRef,
          queryCategory,
          ticketDate: ticketDate || "",
          reviewedAt: `${evaluationDate}T12:00:00+05:30`,
          summary,
          coachingRequired,
          criticalError: {
            flagged: criticalErrorFlagged,
            category: criticalErrorCategory,
            description: criticalErrorDescription,
          },
          criteria: criteria.map((item) =>
            useKoinx
              ? { key: item.key, rating: Number(ratingFor(item.key)), comment: commentFor(item.key) }
              : { key: item.key, score: Number(scoreFor(item.key)) || 0, comment: commentFor(item.key) },
          ),
          coachingItems:
            coachingRequired && coachingNote.trim()
              ? coachingNote
                  .split("\n")
                  .map((text) => text.trim())
                  .filter(Boolean)
                  .map((text) => ({ text, status: "open" as const }))
              : [],
        }),
      });
    },
    onSuccess: (data) => {
      toast.success("Review saved");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/qa/${data.review.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (existing.isLoading || meta.isLoading) return <LoadingBlock />;
  if (existing.isError || meta.isError) return <ErrorBlock message="Could not load the review form." />;
  const agents = formMode === "senior_agent_qa" ? meta.data?.seniorAgents ?? [] : meta.data?.agents ?? [];
  const queryCategories = meta.data?.queryCategories || [];

  return (
    <form
      className="mx-auto max-w-4xl pb-28"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) save.mutate();
      }}
    >
      <PageHeader
        title={id ? "Edit QA Review" : formMode === "senior_agent_qa" ? "New Senior Agent QA" : "New Agent QA Review"}
        className="mb-3"
      />

      <section className="space-y-3 rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Review details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{formMode === "senior_agent_qa" ? "Senior Agent" : "Agent"}</Label>
            <Select value={agentId || review?.agentId || ""} onValueChange={setAgentId}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={formMode === "senior_agent_qa" ? "Choose a senior agent" : "Choose an agent"} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ticket ID</Label>
            <Input className="h-9" value={ticketRef} onChange={(event) => setTicketRef(event.target.value)} placeholder="e.g. 18244" />
          </div>
          <div className="space-y-1.5">
            <Label>Ticket date</Label>
            <Input className="h-9" type="date" value={ticketDate} onChange={(event) => setTicketDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Evaluation date</Label>
            <Input className="h-9" type="date" value={evaluationDate} onChange={(event) => setEvaluationDate(event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Query category</Label>
            <Select value={queryCategory || undefined} onValueChange={setQueryCategory}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select query category" />
              </SelectTrigger>
              <SelectContent>
                {queryCategories.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evaluation criteria</p>
        {useKoinx ? (
          <p className="text-xs text-muted-foreground">
            Rate each criterion 0–10 (0.5 steps). Weighted points update automatically. One issue belongs in one criterion only.
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {criteria.map((item) =>
            useKoinx ? (
              <QaKoinxCriterionCard
                key={item.key}
                criterion={item}
                rating={ratingFor(item.key)}
                comment={commentFor(item.key)}
                commentError={criterionCommentErrors[item.key]}
                onRating={(value) => {
                  setRatings((current) => ({ ...current, [item.key]: value }));
                  setCriterionCommentErrors((current) => {
                    const next = { ...current };
                    delete next[item.key];
                    return next;
                  });
                }}
                onComment={(value) => {
                  setComments((current) => ({ ...current, [item.key]: value }));
                  setCriterionCommentErrors((current) => {
                    const next = { ...current };
                    delete next[item.key];
                    return next;
                  });
                }}
              />
            ) : (
              <QaLegacyCriterionField
                key={item.key}
                label={item.label}
                maxScore={item.maxScore}
                score={scoreFor(item.key)}
                comment={commentFor(item.key)}
                onScore={(value) => setScores((current) => ({ ...current, [item.key]: value }))}
                onComment={(value) => setComments((current) => ({ ...current, [item.key]: value }))}
              />
            ),
          )}
        </div>
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-2 md:items-stretch">
        {useKoinx ? (
          <section className="flex flex-col space-y-2 rounded-lg border border-border/60 bg-card p-3 shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Critical error (optional)</p>
            <p className="text-xs text-muted-foreground">
              Flag serious incidents for supervisor attention. This does not change the numeric QA score.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={criticalErrorFlagged ? "ghost" : "secondary"} onClick={() => setCriticalErrorFlagged(false)}>No</Button>
              <Button type="button" size="sm" variant={criticalErrorFlagged ? "secondary" : "ghost"} onClick={() => setCriticalErrorFlagged(true)}>Yes</Button>
            </div>
            {criticalErrorFlagged ? (
              <div className="grid flex-1 gap-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={criticalErrorCategory || undefined} onValueChange={setCriticalErrorCategory}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {(meta.data?.criticalErrorCategories || []).map((cat) => (
                        <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={criticalErrorDescription}
                    onChange={(e) => setCriticalErrorDescription(e.target.value)}
                    rows={3}
                    placeholder="What happened and why this needs supervisor attention"
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="hidden md:block" aria-hidden />
        )}

        <section className="flex flex-col space-y-3 rounded-lg border border-border/60 bg-card p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Coaching & comments</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Coaching required?</span>
            <div className="inline-flex rounded-lg border border-border/60 p-0.5">
              <Button
                type="button"
                size="sm"
                variant={coachingRequired ? "ghost" : "secondary"}
                className="h-7 px-3"
                onClick={() => setCoachingRequired(false)}
              >
                No
              </Button>
              <Button
                type="button"
                size="sm"
                variant={coachingRequired ? "secondary" : "ghost"}
                className="h-7 px-3"
                onClick={() => setCoachingRequired(true)}
              >
                Yes
              </Button>
            </div>
          </div>
          {coachingRequired ? (
            <div className="space-y-1.5">
              <Label>Coaching note</Label>
              <Textarea
                className="min-h-16"
                placeholder="What should be coached or followed up?"
                value={coachingNote}
                onChange={(event) => setCoachingNote(event.target.value)}
              />
            </div>
          ) : null}
          <div className="mt-auto space-y-1.5 border-t border-border/50 pt-2">
            <Label>Overall reviewer comments</Label>
            <Textarea className="min-h-[4.5rem] resize-y" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summary for the whole evaluation" />
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 mt-6 border-t border-border/60 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overall QA score</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {total == null ? "—" : formatQaTotal(total)} <span className="text-base font-normal text-muted-foreground">/ 100</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/qa")}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{id ? "Save changes" : "Save review"}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
