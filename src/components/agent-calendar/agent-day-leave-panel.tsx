import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { IstDatePicker } from "@/components/ui/ist-date-picker";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/bits";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type LeaveRow = {
  id: string;
  startDateIst: string;
  endDateIst: string;
  kind: string;
  status: string;
  reason: string;
  cancelledVia?: "agent_request" | "admin_override" | null;
  cancelReason?: string;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancellationRetryBlocked?: boolean;
};

type ChangeRequest = {
  id: string;
  leaveId: string;
  requestType: "modification" | "cancellation";
  status: string;
  proposedStartDateIst?: string;
  proposedEndDateIst?: string;
  proposedReason?: string;
  cancellationReason?: string;
  originalStartDateIst?: string;
  originalEndDateIst?: string;
  decisionReason?: string;
  decidedByName?: string | null;
  decidedAt?: string | null;
};

function leaveStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending approval";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function leaveStatusClass(status: string) {
  switch (status) {
    case "approved":
      return "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100";
    case "pending":
      return "border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground";
    case "rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100";
    case "cancelled":
      return "border-slate-400/40 bg-slate-200/60 text-slate-800 dark:bg-slate-500/15 dark:text-slate-100";
    default:
      return "border-border bg-muted/20 text-foreground";
  }
}

function dateInRange(dateIst: string, start: string, end: string) {
  return dateIst >= start && dateIst <= end;
}

function latestRejectedChange(
  changeRequests: ChangeRequest[],
  leaveId: string,
  requestType: "modification" | "cancellation",
) {
  return (
    changeRequests
      .filter((c) => c.leaveId === leaveId && c.requestType === requestType && c.status === "rejected")
      .sort((a, b) => (b.decidedAt || "").localeCompare(a.decidedAt || ""))[0] ?? null
  );
}

type Props = {
  focusDateIst: string;
  leaves: LeaveRow[];
  changeRequests: ChangeRequest[];
  canRequestLeave: boolean;
  readOnly: boolean;
  agentDisplayName?: string;
  canAdminCancel?: boolean;
  canAllowCancellationRetry?: boolean;
  onSubmitNewLeave: (body: { startDateIst: string; endDateIst: string; reason: string }) => void;
  newLeavePending: boolean;
  onSubmitModification: (leaveId: string, body: { startDateIst: string; endDateIst: string; reason: string }) => void;
  modificationPending: boolean;
  onSubmitCancellation: (leaveId: string, reason: string) => void;
  cancellationPending: boolean;
  onAdminCancel?: (leaveId: string, reason: string) => void;
  adminCancelPending?: boolean;
  onAllowCancellationRetry?: (leaveId: string) => void;
  allowRetryPending?: boolean;
};

export function AgentDayLeavePanel({
  focusDateIst,
  leaves,
  changeRequests,
  canRequestLeave,
  readOnly,
  agentDisplayName,
  canAdminCancel,
  canAllowCancellationRetry,
  onSubmitNewLeave,
  newLeavePending,
  onSubmitModification,
  modificationPending,
  onSubmitCancellation,
  cancellationPending,
  onAdminCancel,
  adminCancelPending,
  onAllowCancellationRetry,
  allowRetryPending,
}: Props) {
  const [leaveStart, setLeaveStart] = useState(focusDateIst);
  const [leaveEnd, setLeaveEnd] = useState(focusDateIst);
  const [leaveReason, setLeaveReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmModOpen, setConfirmModOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [adminCancelOpen, setAdminCancelOpen] = useState(false);
  const [adminCancelReason, setAdminCancelReason] = useState("");

  useEffect(() => {
    setLeaveStart(focusDateIst);
    setLeaveEnd(focusDateIst);
  }, [focusDateIst]);

  const coveringLeaves = useMemo(
    () =>
      leaves.filter(
        (l) => l.status !== "rejected" && dateInRange(focusDateIst, l.startDateIst, l.endDateIst),
      ),
    [leaves, focusDateIst],
  );

  const primaryLeave = useMemo(() => {
    const approved = coveringLeaves.find((l) => l.status === "approved");
    if (approved) return approved;
    const cancelled = coveringLeaves.find((l) => l.status === "cancelled");
    if (cancelled) return cancelled;
    return coveringLeaves.find((l) => l.status === "pending") ?? coveringLeaves[0] ?? null;
  }, [coveringLeaves]);

  const pendingChange = useMemo(() => {
    if (!primaryLeave) return null;
    return changeRequests.find((c) => c.leaveId === primaryLeave.id && c.status === "pending") ?? null;
  }, [changeRequests, primaryLeave]);

  const rejectedCancellation = useMemo(() => {
    if (!primaryLeave) return null;
    return latestRejectedChange(changeRequests, primaryLeave.id, "cancellation");
  }, [changeRequests, primaryLeave]);

  const rejectedModification = useMemo(() => {
    if (!primaryLeave) return null;
    return latestRejectedChange(changeRequests, primaryLeave.id, "modification");
  }, [changeRequests, primaryLeave]);

  const canRequestCancellation =
    primaryLeave?.status === "approved" && !pendingChange && !primaryLeave.cancellationRetryBlocked;

  const showNewRequestForm =
    !readOnly && canRequestLeave && !primaryLeave && coveringLeaves.length === 0;

  const resetEditFields = (leave: LeaveRow) => {
    setLeaveStart(leave.startDateIst);
    setLeaveEnd(leave.endDateIst);
    setLeaveReason(leave.reason);
  };

  if (!primaryLeave && !showNewRequestForm) {
    return null;
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      {primaryLeave ? (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/15 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Leave on this date</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatCalendarDate(primaryLeave.startDateIst)}
                {primaryLeave.endDateIst !== primaryLeave.startDateIst
                  ? ` – ${formatCalendarDate(primaryLeave.endDateIst)}`
                  : ""}
                {primaryLeave.kind === "half" ? " · Half day" : ""}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                leaveStatusClass(primaryLeave.status),
              )}
            >
              {leaveStatusLabel(primaryLeave.status)}
            </span>
          </div>
          {primaryLeave.reason?.trim() ? (
            <p className="text-sm text-muted-foreground">{primaryLeave.reason}</p>
          ) : null}

          {primaryLeave.status === "cancelled" ? (
            <div className="rounded-md border border-slate-400/30 bg-slate-500/5 px-2.5 py-2 text-xs text-foreground">
              {primaryLeave.cancelledVia === "admin_override" ? (
                <p className="font-semibold">Direct cancellation (supervisor/admin)</p>
              ) : primaryLeave.cancelledVia === "agent_request" ? (
                <p className="font-semibold">Cancelled (approved cancellation request)</p>
              ) : (
                <p className="font-semibold">Cancelled</p>
              )}
              {primaryLeave.cancelReason?.trim() ? (
                <p className="mt-1 text-muted-foreground">Reason: {primaryLeave.cancelReason}</p>
              ) : null}
              {primaryLeave.cancelledByName ? (
                <p className="mt-1 text-muted-foreground">
                  By {primaryLeave.cancelledByName}
                  {primaryLeave.cancelledAt ? ` · ${formatWhen(primaryLeave.cancelledAt)}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {pendingChange ? (
            <div className="space-y-1 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
              <p className="font-semibold">
                {pendingChange.requestType === "modification"
                  ? "Modification request — pending approval"
                  : "Cancellation request — pending approval"}
              </p>
              <p>
                {pendingChange.requestType === "modification"
                  ? "Your approved leave stays in effect until a supervisor decides."
                  : "Your approved leave stays in effect until a supervisor decides."}
              </p>
              {pendingChange.requestType === "modification" &&
              pendingChange.proposedStartDateIst &&
              pendingChange.proposedEndDateIst ? (
                <span className="mt-1 block tabular-nums">
                  Proposed: {formatCalendarDate(pendingChange.proposedStartDateIst)} –{" "}
                  {formatCalendarDate(pendingChange.proposedEndDateIst)}
                </span>
              ) : null}
            </div>
          ) : null}

          {!pendingChange && rejectedCancellation ? (
            <div className="space-y-1 rounded-md border border-rose-500/35 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-950 dark:text-rose-100">
              <p className="font-semibold">Cancellation request rejected</p>
              <p className="text-muted-foreground">Your leave remains approved for these dates.</p>
              {rejectedCancellation.decisionReason?.trim() ? (
                <p>
                  <span className="font-medium">Reason:</span> {rejectedCancellation.decisionReason}
                </p>
              ) : null}
              {rejectedCancellation.decidedByName || rejectedCancellation.decidedAt ? (
                <p className="text-muted-foreground">
                  {rejectedCancellation.decidedByName ? `Rejected by ${rejectedCancellation.decidedByName}` : ""}
                  {rejectedCancellation.decidedAt
                    ? `${rejectedCancellation.decidedByName ? " · " : ""}${formatWhen(rejectedCancellation.decidedAt)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {!pendingChange && rejectedModification ? (
            <div className="space-y-1 rounded-md border border-rose-500/25 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-950 dark:text-rose-100">
              <p className="font-semibold">Modification request rejected</p>
              {rejectedModification.decisionReason?.trim() ? (
                <p>
                  <span className="font-medium">Reason:</span> {rejectedModification.decisionReason}
                </p>
              ) : null}
              {rejectedModification.decidedByName || rejectedModification.decidedAt ? (
                <p className="text-muted-foreground">
                  {rejectedModification.decidedByName ? `Rejected by ${rejectedModification.decidedByName}` : ""}
                  {rejectedModification.decidedAt
                    ? `${rejectedModification.decidedByName ? " · " : ""}${formatWhen(rejectedModification.decidedAt)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {!readOnly && canRequestLeave && primaryLeave.status === "approved" && !pendingChange ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  resetEditFields(primaryLeave);
                  setEditOpen(true);
                }}
              >
                Edit leave
              </Button>
              {canRequestCancellation ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                  Request cancellation
                </Button>
              ) : null}
            </div>
          ) : null}

          {primaryLeave.status === "pending" ? (
            <p className="text-xs text-muted-foreground">
              Waiting for supervisor approval. You cannot submit another request for these dates.
            </p>
          ) : null}

          {canAdminCancel && primaryLeave.status === "approved" && onAdminCancel ? (
            <div className="border-t border-border/50 pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Direct cancellation — immediately cancels approved leave (supervisor or admin). Separate from an agent
                cancellation request.
              </p>
              <Button type="button" size="sm" variant="destructive" onClick={() => setAdminCancelOpen(true)}>
                Cancel leave
              </Button>
            </div>
          ) : null}

          {canAllowCancellationRetry &&
          primaryLeave.cancellationRetryBlocked &&
          primaryLeave.status === "approved" &&
          onAllowCancellationRetry ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={allowRetryPending}
              onClick={() => onAllowCancellationRetry(primaryLeave.id)}
            >
              Allow new cancellation request
            </Button>
          ) : null}
        </div>
      ) : null}

      {showNewRequestForm ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitNewLeave({ startDateIst: leaveStart, endDateIst: leaveEnd, reason: leaveReason });
          }}
        >
          <SectionHeader title="Request leave" description="Submitted as pending approval." />
          <Label>Start</Label>
          <IstDatePicker value={leaveStart} onChange={setLeaveStart} aria-label="Leave start date" required />
          <Label>End</Label>
          <IstDatePicker value={leaveEnd} onChange={setLeaveEnd} aria-label="Leave end date" required />
          <Label>Reason</Label>
          <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required minLength={3} />
          <Button type="submit" disabled={newLeavePending}>
            Submit request
          </Button>
        </form>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Start</Label>
            <IstDatePicker value={leaveStart} onChange={setLeaveStart} aria-label="Leave start date" required />
            <Label>End</Label>
            <IstDatePicker value={leaveEnd} onChange={setLeaveEnd} aria-label="Leave end date" required />
            <Label>Reason</Label>
            <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required minLength={3} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setConfirmModOpen(true)} disabled={leaveReason.trim().length < 3}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmModOpen} onOpenChange={setConfirmModOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for approval?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your leave changes will be submitted for approval. Your existing approved leave will remain unchanged until
            the modification is approved.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmModOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={modificationPending || !primaryLeave}
              onClick={() => {
                if (!primaryLeave) return;
                onSubmitModification(primaryLeave.id, {
                  startDateIst: leaveStart,
                  endDateIst: leaveEnd,
                  reason: leaveReason,
                });
                setConfirmModOpen(false);
                setEditOpen(false);
              }}
            >
              Submit for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request cancellation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your approved leave stays effective until a supervisor approves this cancellation request.
          </p>
          <Label>Cancellation reason</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required minLength={3} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={cancellationPending || cancelReason.trim().length < 3 || !primaryLeave}
              onClick={() => {
                if (!primaryLeave) return;
                onSubmitCancellation(primaryLeave.id, cancelReason.trim());
                setCancelOpen(false);
                setCancelReason("");
              }}
            >
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminCancelOpen} onOpenChange={setAdminCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel leave (direct)</DialogTitle>
          </DialogHeader>
          {primaryLeave ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This will immediately cancel approved leave for{" "}
                <span className="font-medium text-foreground">{agentDisplayName || "this agent"}</span> on{" "}
                <span className="tabular-nums text-foreground">
                  {formatCalendarDate(primaryLeave.startDateIst)}
                  {primaryLeave.endDateIst !== primaryLeave.startDateIst
                    ? ` – ${formatCalendarDate(primaryLeave.endDateIst)}`
                    : ""}
                </span>
                . Approval history is preserved; the calendar and team availability will update at once.
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-cancel-reason">Cancellation reason (required)</Label>
                <Input
                  id="admin-cancel-reason"
                  value={adminCancelReason}
                  onChange={(e) => setAdminCancelReason(e.target.value)}
                  minLength={3}
                  required
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAdminCancelOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                adminCancelPending || adminCancelReason.trim().length < 3 || !primaryLeave || !onAdminCancel
              }
              onClick={() => {
                if (!primaryLeave || !onAdminCancel) return;
                onAdminCancel(primaryLeave.id, adminCancelReason.trim());
                setAdminCancelOpen(false);
                setAdminCancelReason("");
              }}
            >
              Cancel leave now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function requestKindLabel(kind: string) {
  if (kind === "modification") return "Modification";
  if (kind === "cancellation") return "Cancellation";
  return "New leave";
}
