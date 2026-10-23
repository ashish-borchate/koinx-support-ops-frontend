import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QaSectionShell } from "@/components/qa-section-shell";
import { AppealsFilterCards } from "@/components/appeals-filter-cards";
import { QaWorkflowSummaryCards } from "@/components/qa-workflow-summary-cards";
import { previewRevisedOverall, RatingSelect } from "@/components/qa-appeal-submit-dialog";
import { Empty, ErrorBlock, LoadingBlock } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { formatQaTotal, ratingFromCriterion, weightedPointsFromRating } from "@/lib/qa-rubric";
import type { Review } from "@/pages/qa-types";

type AppealRow = {
  id: string;
  qaReviewId: string;
  agentId: string;
  agentName?: string;
  ticketRef: string;
  status: string;
  originalOverallScore: number;
  submittedAt: string;
  challengedCount: number;
  challengedCriteria?: { key: string; reason: string }[];
};

type ChallengedCriterion = {
  key: string;
  label: string;
  originalRating: number;
  originalPoints: number;
  reason: string;
  evidence?: string;
  finalRating?: number;
  finalPoints?: number;
};

type AppealDetailPayload = {
  appeal: {
    id: string;
    qaReviewId: string;
    agentId: string;
    reviewerId: string;
    assignedReviewerId: string | null;
    ticketRef: string;
    status: string;
    originalOverallScore: number;
    challengedCriteria: ChallengedCriterion[];
    reviewerResponse: string;
    supervisorResponse: string;
    escalationReason: string;
    escalatedAt?: string;
    submittedAt: string;
    reviewerDecisionAt?: string;
    supervisorDecisionAt?: string;
    closedAt?: string;
    reassignmentHistory?: { at: string; actorName: string; reason: string }[];
  };
  review: Review & { summary?: string };
  appealDeadline: string;
  appealWindowOpen: boolean;
  escalationDeadline: string | null;
  config: { appealWindowDays: number; escalationWindowDays: number };
  capabilities: {
    canEscalate: boolean;
    canReviewerDecide: boolean;
    canSupervisorDecide: boolean;
    canReassign: boolean;
  };
  timeline: { kind: string; label: string; at: string; actorName: string; note: string }[];
  adjustments: {
    criterionKey: string;
    previousRating?: number;
    revisedRating?: number;
    previousPoints: number;
    revisedPoints: number;
    previousOverallScore: number;
    revisedOverallScore: number;
    reason: string;
    changedByName: string;
    createdAt: string;
  }[];
};

function statusBadge(status: string) {
  const tone =
    status === "submitted" || status === "under_review"
      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
      : status === "escalated"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
        : status === "rejected"
          ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
          : status === "accepted" || status === "partially_accepted"
            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
            : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", tone)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function QaAppealsPage() {
  const [params] = useSearchParams();
  const filter = params.get("filter") || "";
  const queryKey = ["qa-appeals", filter];
  const summary = useQuery({
    queryKey: ["qa-workflow-summary"],
    queryFn: () => api<{ counters: { key: string; label: string; count: number; href: string }[] | null }>("/api/qa/workflow-summary"),
  });
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const q = filter ? `?filter=${encodeURIComponent(filter)}` : "";
      return api<{ appeals: AppealRow[] }>(`/api/qa/appeals${q}`);
    },
  });

  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message={list.error.message} />;

  const appeals = list.data?.appeals || [];

  return (
    <QaSectionShell>
      <AppealsFilterCards activeFilter={filter} />
      <QaWorkflowSummaryCards counters={summary.data?.counters} />
      {appeals.length === 0 ? (
        <Empty
          title="No appeals"
          body={filter ? "No appeals match this filter. Try another status or view all appeals." : "Appeals submitted by agents will appear here."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criteria</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {appeals.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{formatWhen(row.submittedAt)}</td>
                  <td className="px-4 py-3">{row.agentName || "—"}</td>
                  <td className="px-4 py-3 font-medium">{row.ticketRef}</td>
                  <td className="px-4 py-3">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3">{row.challengedCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/qa/appeals/${row.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QaSectionShell>
  );
}

function criterionAdjustmentSummary(c: ChallengedCriterion) {
  const hasFinal = c.finalRating != null && c.finalPoints != null;
  const changed =
    hasFinal && (c.finalRating !== c.originalRating || c.finalPoints !== c.originalPoints);
  if (!hasFinal) {
    return (
      <span className="text-xs text-muted-foreground">
        Original {c.originalRating}/10 · {c.originalPoints} pts
      </span>
    );
  }
  if (!changed) {
    return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">No score adjustment</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      Original {c.originalRating}/10 · {c.originalPoints} pts → Revised {c.finalRating}/10 · {c.finalPoints} pts
    </span>
  );
}

function AppealStageSection({
  stage,
  title,
  defaultOpen = false,
  children,
}: {
  stage: number;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-colors",
        open ? "border-primary/50 shadow-[0_0_0_1px] shadow-primary/15" : "border-border/60",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25",
          open && "bg-primary/[0.04]",
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary tabular-nums">
          {stage}
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-border/50 px-4 py-3">{children}</div> : null}
    </div>
  );
}

function AppealTimeline({ events }: { events: AppealDetailPayload["timeline"] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No timeline events yet.</p>;
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {events.map((event, idx) => (
        <li key={`${event.kind}-${idx}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1.5 size-2 rounded-full bg-primary" />
          <p className="text-sm font-medium">{event.label}</p>
          <p className="text-xs text-muted-foreground">
            {event.actorName ? `${event.actorName} · ` : ""}
            {formatWhen(event.at)}
          </p>
          {event.note ? <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function QaAppealDetailPage() {
  const { appealId } = useParams();
  const id = appealId || "";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const client = useQueryClient();
  const { readOnly } = useAuth();
  const query = useQuery({
    queryKey: ["qa-appeal", id],
    queryFn: () => api<AppealDetailPayload>(`/api/qa/appeals/${id}`),
    enabled: Boolean(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 409) && count < 2,
  });

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 409) {
      const href = typeof query.error.payload?.href === "string" ? query.error.payload.href : null;
      if (href && href !== `/qa/appeals/${id}`) navigate(href, { replace: true });
    }
  }, [query.error, id, navigate]);

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const meta = useQuery({
    queryKey: ["qa-meta", "agent_qa"],
    queryFn: () =>
      api<{ seniorAgents: { id: string; name: string }[] }>("/api/qa/meta?qaMode=agent_qa"),
    enabled: reassignOpen,
  });

  const invalidate = () => {
    void query.refetch();
    void client.invalidateQueries({ queryKey: ["qa-appeals"] });
    void client.invalidateQueries({ queryKey: ["qa-workflow-summary"] });
    void client.invalidateQueries({ queryKey: ["hub-notifications"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const escalate = useMutation({
    mutationFn: () =>
      api(`/api/qa/appeals/${id}/escalate`, {
        method: "POST",
        body: JSON.stringify({ reason: escalateReason.trim() }),
      }),
    onSuccess: () => {
      toast.success("Escalated to supervisor");
      setEscalateOpen(false);
      setEscalateReason("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!query.data?.capabilities.canEscalate) return;
    if (searchParams.get("escalate") === "1") setEscalateOpen(true);
  }, [query.data?.capabilities.canEscalate, searchParams]);

  const appealForStages = query.data?.appeal;
  const appealStages = useMemo(() => {
    if (!appealForStages) return [];
    const stages: { title: string; defaultOpen?: boolean; body: ReactNode }[] = [
      {
        title: "Challenged criteria",
        defaultOpen: true,
        body: (
          <div className="space-y-3">
            {appealForStages.challengedCriteria.map((c) => (
              <div key={c.key} className="rounded-lg border border-border/50 bg-muted/15 p-3 text-sm">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <p className="min-w-0 font-medium leading-snug">{c.label}</p>
                  <div className="shrink-0 sm:max-w-[min(100%,22rem)] sm:text-right">
                    {criterionAdjustmentSummary(c)}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{c.reason}</p>
                {c.evidence ? (
                  <p className="mt-2 text-muted-foreground text-xs break-all">Attachment: {c.evidence}</p>
                ) : null}
              </div>
            ))}
          </div>
        ),
      },
    ];
    if (appealForStages.reviewerResponse) {
      stages.push({
        title: "Reviewer decision",
        defaultOpen: true,
        body: <p className="text-sm whitespace-pre-wrap">{appealForStages.reviewerResponse}</p>,
      });
    }
    if (appealForStages.escalationReason) {
      stages.push({
        title: "Escalation reason",
        body: <p className="text-sm whitespace-pre-wrap">{appealForStages.escalationReason}</p>,
      });
    }
    if (appealForStages.supervisorResponse) {
      stages.push({
        title: "Supervisor final decision",
        body: <p className="text-sm whitespace-pre-wrap">{appealForStages.supervisorResponse}</p>,
      });
    }
    return stages;
  }, [appealForStages]);

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 409) return <LoadingBlock />;
    return <ErrorBlock message={query.error.message} />;
  }

  const data = query.data!;
  const { appeal, review, capabilities, timeline } = data;
  const effective = review.effectiveOverallScore ?? review.overallScore;

  return (
    <QaSectionShell>
      <div className="max-w-6xl space-y-4">
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Appeal · {appeal.ticketRef}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(appeal.status)}
            <span className="text-sm text-muted-foreground">Submitted {formatWhen(appeal.submittedAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/qa/appeals">← Appeals</Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/qa/${review.id}`}>Open QA evaluation</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Scores</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-8 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Before QA Appeal</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatQaTotal(review.overallScore)}
                  <span className="text-base font-normal text-muted-foreground">/100</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">After QA Appeal</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatQaTotal(effective)}
                  <span className="text-base font-normal text-muted-foreground">/100</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {!readOnly && capabilities.canEscalate ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <p className="text-muted-foreground mb-2">
                If you disagree with the reviewer&apos;s decision, you can request a final review by your supervisor.
              </p>
              <Button
                size="sm"
                className="h-auto max-w-full whitespace-normal text-left py-2"
                onClick={() => {
                  setEscalateOpen(true);
                  setSearchParams({ escalate: "1" });
                }}
              >
                <span>
                  Escalate to Supervisor
                  {data.escalationDeadline ? (
                    <span className="font-normal opacity-90"> · Deadline {formatWhen(data.escalationDeadline)}</span>
                  ) : null}
                </span>
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!readOnly && capabilities.canReviewerDecide ? (
              <Button size="sm" onClick={() => setReviewerOpen(true)}>Reviewer decision</Button>
            ) : null}
            {!readOnly && capabilities.canSupervisorDecide ? (
              <Button size="sm" onClick={() => setSupervisorOpen(true)}>Supervisor decision</Button>
            ) : null}
            {!readOnly && capabilities.canReassign ? (
              <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>Reassign reviewer</Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {appealStages.map((stage, index) => (
              <AppealStageSection
                key={stage.title}
                stage={index + 1}
                title={stage.title}
                defaultOpen={stage.defaultOpen}
              >
                {stage.body}
              </AppealStageSection>
            ))}
          </div>
        </div>

        <Card className="lg:sticky lg:top-4">
          <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
          <CardContent><AppealTimeline events={timeline} /></CardContent>
        </Card>
      </div>

      <EscalateDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        reason={escalateReason}
        onReason={setEscalateReason}
        onSubmit={() => escalate.mutate()}
        pending={escalate.isPending}
        deadline={data.escalationDeadline}
      />

      {reviewerOpen ? (
        <ReviewerDecisionDialog
          appealId={id}
          appeal={appeal}
          review={review}
          open={reviewerOpen}
          onOpenChange={setReviewerOpen}
          onDone={invalidate}
        />
      ) : null}

      {supervisorOpen ? (
        <SupervisorDecisionDialog
          appealId={id}
          appeal={appeal}
          review={review}
          open={supervisorOpen}
          onOpenChange={setSupervisorOpen}
          onDone={invalidate}
        />
      ) : null}

      {reassignOpen ? (
        <ReassignDialog
          appealId={id}
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          seniorAgents={meta.data?.seniorAgents ?? []}
          onDone={invalidate}
        />
      ) : null}
      </div>
    </QaSectionShell>
  );
}

function EscalateDialog({
  open,
  onOpenChange,
  reason,
  onReason,
  onSubmit,
  pending,
  deadline,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reason: string;
  onReason: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  deadline: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate to Supervisor</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          If you disagree with the reviewer&apos;s decision, you can request a final review by your supervisor before the
          escalation deadline.
        </p>
        {deadline ? (
          <p className="text-sm font-medium">Deadline: {formatWhen(deadline)}</p>
        ) : null}
        <Textarea value={reason} onChange={(e) => onReason(e.target.value)} placeholder="Why do you disagree with the reviewer decision?" rows={4} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending || reason.trim().length < 3} onClick={onSubmit}>Submit escalation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewerDecisionDialog({
  appealId,
  appeal,
  review,
  open,
  onOpenChange,
  onDone,
}: {
  appealId: string;
  appeal: AppealDetailPayload["appeal"];
  review: Review;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<"under_review" | "accepted" | "partially_accepted" | "rejected">("under_review");
  const [response, setResponse] = useState("");
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of appeal.challengedCriteria) {
      init[c.key] = String(c.originalRating);
    }
    return init;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const challengedKeys = appeal.challengedCriteria.map((c) => c.key);
  const previewScore = useMemo(
    () => previewRevisedOverall(review.criteria, ratings),
    [review.criteria, ratings],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const body: {
        outcome: string;
        response: string;
        revisions?: { key: string; revisedRating: number }[];
      } = { outcome, response: response.trim() };
      if (outcome === "accepted" || outcome === "partially_accepted") {
        body.revisions = challengedKeys.map((key) => ({
          key,
          revisedRating: Number(ratings[key]),
        }));
      }
      return api(`/api/qa/appeals/${appealId}/reviewer-decision`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      setConfirmOpen(false);
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const needsRevisions = outcome === "accepted" || outcome === "partially_accepted";
  const valid =
    (outcome === "under_review" || response.trim().length >= 3) &&
    (!needsRevisions || challengedKeys.every((k) => ratings[k]));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reviewer decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Decision</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_review">Mark under review</SelectItem>
                  <SelectItem value="accepted">Accept</SelectItem>
                  <SelectItem value="partially_accepted">Partially accept</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Decision reason (required for final decisions)"
              rows={3}
            />
            {needsRevisions ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Revised ratings (challenged criteria only)</p>
                {appeal.challengedCriteria.map((c) => (
                  <div key={c.key} className="rounded border p-2">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Was {c.originalRating}/10 ({c.originalPoints} pts)
                    </p>
                    <RatingSelect
                      value={ratings[c.key]}
                      onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Preview: {weightedPointsFromRating(Number(ratings[c.key]), review.criteria.find((x) => x.key === c.key)!.maxScore)} pts
                    </p>
                  </div>
                ))}
                <p className="text-sm font-medium">
                  Preview overall: {formatQaTotal(previewScore)}/100 (was effective {formatQaTotal(review.effectiveOverallScore ?? review.overallScore)})
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!valid} onClick={() => (needsRevisions ? setConfirmOpen(true) : mutation.mutate())}>
              {needsRevisions ? "Review & confirm" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm score adjustment</DialogTitle></DialogHeader>
          <p className="text-sm">
            Effective score will change from {formatQaTotal(review.effectiveOverallScore ?? review.overallScore)} to{" "}
            <span className="font-semibold">{formatQaTotal(previewScore)}</span>/100.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SupervisorDecisionDialog({
  appealId,
  appeal,
  review,
  open,
  onOpenChange,
  onDone,
}: {
  appealId: string;
  appeal: AppealDetailPayload["appeal"];
  review: Review;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<"closed" | "accepted" | "partially_accepted" | "rejected">("closed");
  const [response, setResponse] = useState("");
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of appeal.challengedCriteria) {
      const current = review.criteria.find((x) => x.key === c.key);
      init[c.key] = String(current ? ratingFromCriterion(current) : c.originalRating);
    }
    return init;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const challengedKeys = appeal.challengedCriteria.map((c) => c.key);
  const previewScore = useMemo(
    () => previewRevisedOverall(review.criteria, ratings),
    [review.criteria, ratings],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const body: {
        outcome: string;
        response: string;
        revisions?: { key: string; revisedRating: number }[];
      } = { outcome, response: response.trim() };
      if (outcome === "accepted" || outcome === "partially_accepted") {
        body.revisions = challengedKeys.map((key) => ({
          key,
          revisedRating: Number(ratings[key]),
        }));
      }
      return api(`/api/qa/appeals/${appealId}/supervisor-decision`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("Final decision recorded");
      setConfirmOpen(false);
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const needsRevisions = outcome === "accepted" || outcome === "partially_accepted";
  const valid = response.trim().length >= 3 && (!needsRevisions || challengedKeys.every((k) => ratings[k]));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supervisor final decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Uphold reviewer decision (close)</SelectItem>
                  <SelectItem value="accepted">Accept appeal / revise scores</SelectItem>
                  <SelectItem value="partially_accepted">Partially accept</SelectItem>
                  <SelectItem value="rejected">Reject appeal (uphold original scores)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Final decision reason" rows={4} />
            {needsRevisions ? (
              <div className="space-y-3">
                {appeal.challengedCriteria.map((c) => (
                  <div key={c.key} className="rounded border p-2">
                    <p className="text-sm font-medium">{c.label}</p>
                    <RatingSelect value={ratings[c.key]} onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))} />
                  </div>
                ))}
                <p className="text-sm font-medium">Preview overall: {formatQaTotal(previewScore)}/100</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!valid} onClick={() => (needsRevisions ? setConfirmOpen(true) : mutation.mutate())}>
              {needsRevisions ? "Review & confirm" : "Submit final decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm adjustment</DialogTitle></DialogHeader>
          <p className="text-sm">Effective score → {formatQaTotal(previewScore)}/100</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReassignDialog({
  appealId,
  open,
  onOpenChange,
  seniorAgents,
  onDone,
}: {
  appealId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seniorAgents: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [reviewerId, setReviewerId] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api(`/api/qa/appeals/${appealId}/reassign`, {
        method: "POST",
        body: JSON.stringify({ newReviewerId: reviewerId, reason: reason.trim() }),
      }),
    onSuccess: () => {
      toast.success("Reviewer reassigned");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reassign appeal reviewer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Senior agent</Label>
            <Select value={reviewerId} onValueChange={setReviewerId}>
              <SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger>
              <SelectContent>
                {seniorAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reassignment" rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !reviewerId || reason.trim().length < 3}
            onClick={() => mutation.mutate()}
          >
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
