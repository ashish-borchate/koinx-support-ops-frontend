import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataTableShell, Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatNumber, monthKey } from "@/lib/format";
import { TruncatedHoverField } from "@/components/truncated-hover-field";
import { cn } from "@/lib/utils";
import { CoachingDiscussionComposer } from "@/components/coaching-discussion-composer";
import { CoachingDiscussionMessage } from "@/components/coaching-discussion-message";

type CoachingRecord = {
  id: string;
  agentId: string;
  agentName: string;
  sourceType: string;
  sourceLabel: string;
  sourceHref: string | null;
  category: string;
  reason: string;
  context: string;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  dueAt: string;
  sessionDate: string;
  coachingNotes: string;
  improvementPlan: string;
  completedAt: string | null;
  completedByName: string | null;
  agentConfirmedAt?: string | null;
  ackDueAt?: string | null;
  createdAt: string;
  coachSla: string;
  ackSla: string;
  discussion?: {
    id: string;
    authorName: string;
    kind: string;
    title: string;
    message: string;
    mentions?: { userId: string; displayNameSnapshot: string }[];
    createdAt: string;
  }[];
  actions?: {
    canComplete: boolean;
    canConfirm: boolean;
    canDispute: boolean;
    canRequestAck: boolean;
    canDiscuss: boolean;
  };
};

type CoachingListResponse = {
  stats:
    | { open: number; dueSoon: number; overdue: number; completedThisMonth: number }
    | { active: number; awaitingConfirmation: number; completedThisMonth: number };
  records: CoachingRecord[];
  categories: string[];
  agentView?: boolean;
};

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function statusTone(status: string, coachSla: string) {
  if (status === "Completed") return "text-muted-foreground";
  if (status === "Acknowledgement Disputed") return "text-destructive";
  if (coachSla === "overdue") return "text-destructive";
  if (coachSla === "due-soon") return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,7.5rem)_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium break-words text-foreground">{value}</span>
    </div>
  );
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function StatusBadge({ status }: { status: string }) {
  const disputed = status === "Acknowledgement Disputed";
  const pendingAck = status === "Pending Acknowledgement";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        disputed && "border-destructive/40 bg-destructive/10 text-destructive",
        pendingAck && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        !disputed && !pendingAck && status === "Completed" && "border-border/60 bg-muted/40 text-muted-foreground",
        !disputed && !pendingAck && status !== "Completed" && "border-border/60 bg-muted/30 text-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function CoachingPage() {
  const { can, canMutate } = useAuth();
  const teamView = can("coaching.view_team") || can("coaching.manage");
  const agentView = !teamView && can("coaching.view_own");
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("all");
  const [agent, setAgent] = useState("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [month, setMonth] = useState(monthKey());
  const [drawerId, setDrawerId] = useState<string | null>(params.get("id"));
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const id = params.get("id");
    if (id) setDrawerId(id);
  }, [params]);

  const query = useQuery({
    queryKey: ["coaching", status, agent, source, owner, month],
    queryFn: () => {
      const q = new URLSearchParams({ month });
      if (status !== "all") q.set("status", status);
      if (agent !== "all") q.set("agentId", agent);
      if (source !== "all") q.set("sourceType", source);
      if (owner !== "all") q.set("ownerId", owner);
      return api<CoachingListResponse>(`/api/coaching?${q.toString()}`);
    },
  });

  const owners = useQuery({
    queryKey: ["coaching-owners"],
    queryFn: () => api<{ owners: { id: string; name: string }[] }>("/api/coaching/owners"),
    enabled: canMutate("coaching.create"),
  });

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of query.data?.records || []) map.set(row.agentId, row.agentName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [query.data]);

  const selected = query.data?.records.find((r) => r.id === drawerId) || null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={teamView ? "Coaching Center" : "My Coaching Center"}
        description={
          agentView
            ? "View your coaching sessions, feedback and follow-up actions."
            : "Manage coaching actions from quality reviews and support feedback."
        }
        className="mb-5"
        action={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Pending Acknowledgement">Pending Acknowledgement</SelectItem>
                <SelectItem value="Acknowledgement Disputed">Acknowledgement Disputed</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            {teamView ? (
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger className="h-8 w-[9rem]" aria-label="Agent"><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-8 w-[9.5rem]" aria-label="Source"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="qa">QA Review</SelectItem>
                <SelectItem value="negative_review">Negative Review</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            {teamView ? (
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="h-8 w-[9rem]" aria-label="Owner"><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(owners.data?.owners || []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Period"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[monthKey()].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {canMutate("coaching.create") ? (
              <Button size="sm" className="h-8 gap-1" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" /> New Coaching
              </Button>
            ) : null}
          </div>
        }
      />

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}

      {query.data ? (
        <>
          {"active" in query.data.stats ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <SummaryCard label="Active coaching" value={formatNumber(query.data.stats.active, 0)} note="Pending & in progress" />
              <SummaryCard label="Awaiting my confirmation" value={formatNumber(query.data.stats.awaitingConfirmation, 0)} note="Action required" />
              <SummaryCard label="Completed" value={formatNumber(query.data.stats.completedThisMonth, 0)} note="This month" />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Open coaching" value={formatNumber(query.data.stats.open, 0)} note="Requires action" />
              <SummaryCard label="Due soon" value={formatNumber(query.data.stats.dueSoon, 0)} note="Next 12 hours" />
              <SummaryCard label="Overdue" value={formatNumber(query.data.stats.overdue, 0)} note="Past due" />
              <SummaryCard label="Completed" value={formatNumber(query.data.stats.completedThisMonth, 0)} note="Fully completed this month" />
            </div>
          )}

          <section className="space-y-3">
            <SectionHeader title={agentView ? "My coaching" : "Coaching queue"} />
            {query.data.records.length === 0 ? <Empty title="No coaching records" body="No records match these filters." /> : null}
            <DataTableShell className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <tr>
                    {agentView ? (
                      <>
                        <th className="px-3 py-2 font-medium">Coaching</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Coach</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="w-10 px-2 py-2" />
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 font-medium">Agent</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Due date</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="w-10 px-2 py-2" />
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {query.data.records.map((row) => {
                    const actionLabel =
                      row.status === "Pending Acknowledgement" && agentView ? "Review" : "View";
                    const dateCell =
                      agentView && row.status === "Pending Acknowledgement" && row.ackDueAt
                        ? formatDue(row.ackDueAt)
                        : teamView
                          ? formatDue(row.dueAt)
                          : null;
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                        onClick={() => {
                          setDrawerId(row.id);
                          setParams({ id: row.id });
                        }}
                      >
                        {agentView ? (
                          <>
                            <td className="px-3 py-2.5 font-medium">{row.category}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row.sourceLabel || row.sourceType}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row.ownerName || "Unassigned"}</td>
                            <td className="px-3 py-2.5">
                              <span className={cn("font-medium", statusTone(row.status, row.coachSla))}>
                                {row.status}
                                {row.status === "Acknowledgement Disputed" ? " ·" : ""}
                              </span>
                              {dateCell ? (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">Confirm by {dateCell}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-primary font-medium">{actionLabel}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5 font-medium">{row.agentName}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row.sourceLabel || row.sourceType}</td>
                            <td className="max-w-[12rem] px-3 py-2.5">
                              <TruncatedHoverField
                                variant="inline"
                                value={row.reason}
                                popoverTitle="Reason"
                                valueClassName="font-normal text-foreground"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row.ownerName || "Unassigned"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatDue(row.dueAt)}</td>
                            <td className={cn("px-3 py-2.5 font-medium", statusTone(row.status, row.coachSla))}>
                              {row.status}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-2"><ChevronRight className="size-4 text-muted-foreground" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
          </section>
        </>
      ) : null}

      <CoachingDetailDialog
        recordId={drawerId}
        fallback={selected}
        open={Boolean(drawerId)}
        onClose={() => {
          setDrawerId(null);
          setParams({});
        }}
      />
      {canMutate("coaching.create") ? (
        <CreateCoachingDialog open={createOpen} onOpenChange={setCreateOpen} categories={query.data?.categories || []} owners={owners.data?.owners || []} />
      ) : null}
    </div>
  );
}

function CoachingDetailDialog({
  recordId,
  fallback,
  open,
  onClose,
}: {
  recordId: string | null;
  fallback: CoachingRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["coaching", recordId],
    queryFn: () => api<{ record: CoachingRecord }>(`/api/coaching/${recordId!}`),
    enabled: Boolean(recordId) && open,
  });
  const item = detail.data?.record || fallback;
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeComment, setDisputeComment] = useState("");

  useEffect(() => {
    if (!item) return;
    setNotes(item.coachingNotes || "");
    setPlan(item.improvementPlan || "");
    setSessionDate(item.sessionDate || "");
  }, [item?.id, item?.coachingNotes, item?.improvementPlan, item?.sessionDate]);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ["coaching"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
    void client.invalidateQueries({ queryKey: ["hub-notifications"] });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/coaching/${item!.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Coaching updated");
      invalidate();
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: () =>
      api(`/api/coaching/${item!.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ sessionDate, coachingNotes: notes, improvementPlan: plan }),
      }),
    onSuccess: () => {
      toast.success("Coaching submitted for agent confirmation");
      invalidate();
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => api(`/api/coaching/${item!.id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Coaching confirmed");
      invalidate();
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const dispute = useMutation({
    mutationFn: (comment: string) =>
      api(`/api/coaching/${item!.id}/dispute`, { method: "POST", body: JSON.stringify({ comment }) }),
    onSuccess: () => {
      toast.success("Issue reported");
      setDisputeOpen(false);
      setDisputeComment("");
      invalidate();
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const requestAck = useMutation({
    mutationFn: (body: { message: string; mentions: { userId: string }[] }) =>
      api(`/api/coaching/${item!.id}/request-acknowledgement`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Acknowledgement requested again");
      invalidate();
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open || !item) return;
    if (window.location.hash !== "#coaching-discussion") return;
    requestAnimationFrame(() => {
      document.getElementById("coaching-discussion")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [open, item?.id, detail.dataUpdatedAt]);

  if (!item) return null;

  const actions = item.actions;
  const manage = canMutate("coaching.manage");
  const coachCanEditSession =
    manage &&
    ["Pending", "In Progress", "Pending Acknowledgement", "Acknowledgement Disputed"].includes(item.status);
  const showSessionForm = Boolean(actions?.canComplete || coachCanEditSession);
  const sessionLocked = !actions?.canComplete && !coachCanEditSession;
  const canCompleteSubmit =
    actions?.canComplete &&
    sessionDate.trim() &&
    notes.trim().length >= 2 &&
    plan.trim().length >= 2;

  const coachLabel = item.ownerName || "Unassigned";
  const showDiscussion = Boolean(item.discussion?.length || actions?.canDiscuss);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className={cn(
            "grid max-h-[90vh] w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
            showDiscussion ? "max-w-[min(100vw-2rem,56rem)] sm:max-w-[min(100vw-2rem,56rem)]" : "max-w-lg sm:max-w-lg",
          )}
        >
          <DialogHeader className="min-w-0 border-b border-border/50 px-5 py-4 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base">Coaching Center · {item.agentName}</DialogTitle>
              <StatusBadge status={item.status} />
            </div>
            <TruncatedHoverField
              variant="inline"
              value={item.reason}
              popoverTitle="Reason"
              className="text-left text-sm text-muted-foreground"
              valueClassName="font-normal text-muted-foreground"
            />
          </DialogHeader>

          <div
            className={cn(
              "min-h-0 overflow-hidden",
              showDiscussion &&
                "md:grid md:min-h-[min(72vh,calc(90vh-10rem))] md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:divide-x md:divide-border/50",
            )}
          >
            <div className="min-h-0 max-h-[min(58vh,calc(90vh-11rem))] space-y-4 overflow-y-auto overscroll-contain px-5 py-4 md:h-full md:max-h-none md:pb-5">
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Source</p>
                  <p className="mt-0.5 text-sm font-medium">{item.sourceLabel || item.sourceType}</p>
                </div>
                {item.sourceHref ? (
                  <Button size="sm" variant="outline" className="h-8 shrink-0" asChild>
                    <Link to={item.sourceHref} onClick={() => onClose()}>View source</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 space-y-2 overflow-hidden rounded-lg border border-border/50 px-3 py-2.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Coaching details</p>
              <MetaRow label="Category" value={item.category} />
              <TruncatedHoverField variant="meta" label="Reason" popoverTitle="Reason" value={item.reason} />
              <MetaRow label="Coach" value={coachLabel} />
              {manage ? <MetaRow label="Coach due" value={formatDue(item.dueAt)} /> : null}
              {item.status === "Pending Acknowledgement" && item.ackDueAt ? (
                <MetaRow label="Confirm by" value={formatDue(item.ackDueAt)} />
              ) : null}
              {item.completedAt ? (
                <MetaRow label="Session submitted" value={formatDateTime(String(item.completedAt))} />
              ) : null}
            </div>

            {item.context ? (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Context</p>
                <TruncatedHoverField
                  variant="inline"
                  value={item.context}
                  popoverTitle="Context"
                  className="mt-1.5 text-sm text-muted-foreground"
                  valueClassName="font-normal text-muted-foreground"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Session details</p>
              {showSessionForm && !sessionLocked ? (
                <div className="space-y-2 rounded-lg border border-border/50 px-3 py-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Session date</Label>
                    <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coaching notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[4.5rem] text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Improvement / action plan</Label>
                    <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} className="min-h-[4.5rem] text-sm" />
                  </div>
                  {coachCanEditSession && !actions?.canComplete ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ sessionDate, coachingNotes: notes, improvementPlan: plan })}
                    >
                      Save session details
                    </Button>
                  ) : null}
                  {actions?.canComplete ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={patch.isPending}
                      onClick={() =>
                        patch.mutate({
                          sessionDate,
                          coachingNotes: notes,
                          improvementPlan: plan,
                          status: "In Progress",
                        })
                      }
                    >
                      Save draft
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-border/50 px-3 py-2.5 text-sm">
                  {item.sessionDate ? <MetaRow label="Session date" value={item.sessionDate} /> : null}
                  {item.coachingNotes ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Coaching notes</p>
                      <p className="mt-1 whitespace-pre-wrap">{item.coachingNotes}</p>
                    </div>
                  ) : null}
                  {item.improvementPlan ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Improvement / action plan</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.improvementPlan}</p>
                    </div>
                  ) : null}
                  {!item.sessionDate && !item.coachingNotes && !item.improvementPlan ? (
                    <p className="text-muted-foreground">No session recorded yet.</p>
                  ) : null}
                </div>
              )}
            </div>

            {actions?.canConfirm || actions?.canDispute ? (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
                <p className="text-sm font-medium">Did this coaching session take place?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirm that the session happened as recorded. This is not approval of the QA score.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                    Yes, confirm
                  </Button>
                  <Button size="sm" variant="outline" disabled={dispute.isPending} onClick={() => setDisputeOpen(true)}>
                    No, report issue
                  </Button>
                </div>
              </div>
            ) : null}

            {actions?.canRequestAck && !readOnly ? (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
                <p className="text-sm font-medium">Acknowledgement disputed</p>
                <p className="text-xs text-muted-foreground">
                  Respond in the discussion, update session details if needed, then request acknowledgement again.
                </p>
                <CoachingDiscussionComposer
                  key={`request-ack-${item.id}`}
                  coachingId={item.id}
                  layout="stack"
                  submitVariant="default"
                  submitLabel="Request acknowledgement again"
                  placeholder="Add a response… Type @ to mention someone"
                  pending={requestAck.isPending}
                  onSubmit={async (body) => {
                    await requestAck.mutateAsync(body);
                  }}
                  onPosted={() => {
                    invalidate();
                    void detail.refetch();
                  }}
                />
              </div>
            ) : null}
            </div>

            {showDiscussion ? (
              <div
                id="coaching-discussion"
                className="scroll-mt-3 flex min-h-[14rem] max-h-[min(42vh,calc(90vh-11rem))] flex-col border-t border-border/50 px-5 py-4 md:h-full md:max-h-none md:min-h-0 md:border-t-0"
              >
                <p className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Coaching discussion
                </p>
                <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-muted/10 p-2">
                  {(item.discussion || []).length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">No messages yet.</p>
                  ) : (
                    (item.discussion || []).map((msg) => (
                      <CoachingDiscussionMessage key={msg.id} msg={msg} formatDateTime={formatDateTime} />
                    ))
                  )}
                </div>
                {actions?.canDiscuss && !readOnly ? (
                  <div className="mt-2 shrink-0">
                    <CoachingDiscussionComposer
                      coachingId={item.id}
                      disabled={readOnly}
                      layout="stack"
                      onPosted={() => {
                        invalidate();
                        void detail.refetch();
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-border/50 bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-wrap gap-2">
              {actions?.canComplete ? (
                <Button size="sm" disabled={!canCompleteSubmit || complete.isPending} onClick={() => complete.mutate()}>
                  Complete coaching
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a coaching confirmation issue</DialogTitle>
            <DialogDescription>
              Please explain what was incorrect or why you cannot confirm this coaching session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Your comment</Label>
            <Textarea
              value={disputeComment}
              onChange={(e) => setDisputeComment(e.target.value)}
              className="min-h-24"
              placeholder="Required"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button
              disabled={disputeComment.trim().length < 2 || dispute.isPending}
              onClick={() => dispute.mutate(disputeComment.trim())}
            >
              Submit issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateCoachingDialog({
  open,
  onOpenChange,
  categories,
  owners,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  owners: { id: string; name: string }[];
}) {
  const client = useQueryClient();
  const people = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: { id: string; name: string; qaSubject?: boolean }[] }>("/api/users"),
  });
  const [agentId, setAgentId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [category, setCategory] = useState(categories[0] || "Other");
  const [reason, setReason] = useState("");
  const [context, setContext] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api("/api/coaching", {
        method: "POST",
        body: JSON.stringify({ agentId, ownerId, category, reason, context }),
      }),
    onSuccess: () => {
      toast.success("Coaching created");
      onOpenChange(false);
      void client.invalidateQueries({ queryKey: ["coaching"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const agents = (people.data?.users || []).filter((u) => u.qaSubject);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New coaching</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Coaching topic / reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description / context</Label>
            <Textarea value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!agentId || !ownerId || reason.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>Create coaching</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
