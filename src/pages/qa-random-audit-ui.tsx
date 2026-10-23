import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { QaRandomAuditDetail, QaRandomAuditOutcome } from "@/pages/qa-types";

export function formatQaRandomAuditDate(iso: string | Date) {
  const value = typeof iso === "string" ? iso : iso.toISOString();
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

const outcomeStyles: Record<QaRandomAuditOutcome, string> = {
  accurate: "text-emerald-700 dark:text-emerald-300",
  minor_issue: "text-amber-700 dark:text-amber-300",
  major_issue: "text-rose-700 dark:text-rose-300",
};

export function QaRandomAuditIndicator({
  outcome,
  className,
}: {
  outcome?: QaRandomAuditOutcome;
  className?: string;
}) {
  const tone = outcome ? outcomeStyles[outcome] : "text-muted-foreground";
  return (
    <span title="Random audit completed" className={cn("inline-flex align-middle", className)}>
      <ShieldCheck className={cn("size-3.5", tone)} aria-hidden />
    </span>
  );
}

function ReviewerResponseBlock({ audit }: { audit: QaRandomAuditDetail }) {
  if (audit.reviewerWorkflowStatus === "not_required" || audit.outcome === "accurate") return null;
  if (audit.reviewerWorkflowStatus === "awaiting_ack") {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Status: <span className="font-medium text-foreground">{audit.workflowStatusLabel}</span>
      </p>
    );
  }
  const actorName =
    audit.reviewerWorkflowStatus === "acknowledged" ? audit.acknowledgedByName : audit.disagreedByName;
  const when =
    audit.reviewerWorkflowStatus === "acknowledged" ? audit.acknowledgedAt : audit.disagreedAt;
  return (
    <div className="mt-4 border-t border-border/50 pt-3">
      <p className="text-xs font-semibold text-foreground">Reviewer response</p>
      {actorName && when ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {actorName} · {formatQaRandomAuditDate(when)}
        </p>
      ) : null}
      <p className="mt-2 text-sm">
        <span className="text-muted-foreground">Status: </span>
        <span className="font-medium text-foreground">{audit.workflowStatusLabel}</span>
      </p>
      {audit.reviewerWorkflowStatus === "disagreed" && audit.disagreementText ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">&ldquo;{audit.disagreementText}&rdquo;</p>
      ) : null}
    </div>
  );
}

export function RandomAuditPanel({
  audit,
  legacyOnly,
  onChanged,
}: {
  audit?: QaRandomAuditDetail | null;
  legacyOnly?: boolean;
  onChanged?: () => void;
}) {
  const client = useQueryClient();
  const [disagreeOpen, setDisagreeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [disagreementText, setDisagreementText] = useState("");

  const acknowledge = useMutation({
    mutationFn: () => api(`/api/qa/random-audits/${audit!.id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["qa-random-audits"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onChanged?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const disagree = useMutation({
    mutationFn: () =>
      api(`/api/qa/random-audits/${audit!.id}/disagree`, {
        method: "POST",
        body: JSON.stringify({ disagreementText }),
      }),
    onSuccess: () => {
      toast.success("Response recorded");
      setDisagreeOpen(false);
      setDisagreementText("");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["qa-random-audits"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onChanged?.();
    },
    onError: (error) => toast.error(error.message),
  });

  if (legacyOnly && !audit) {
    return (
      <section className="rounded-lg border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-foreground">Random Audit</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A random audit was recorded before structured audit details were captured. Open supervisor records or audit log for context.
        </p>
      </section>
    );
  }
  if (!audit) return null;

  return (
    <>
      <section className="rounded-lg border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Random Audit</h2>
          <div className="flex flex-wrap gap-2">
            {audit.canEditRandomAudit ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit audit</Button>
            ) : null}
            {audit.canRevertRandomAudit ? (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setRevertOpen(true)}>
                Revert audit
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Audited by {audit.auditedByName} · {formatQaRandomAuditDate(audit.auditedAt)}
        </p>
        {!audit.isActive ? (
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {audit.workflowStatusLabel}
            {audit.revertReason ? ` · ${audit.revertReason}` : ""}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Outcome: </span>
              <span className={cn("font-medium", outcomeStyles[audit.outcome])}>{audit.outcomeLabel}</span>
            </p>
            {audit.reviewerWorkflowStatus === "awaiting_ack" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Status: <span className="font-medium text-foreground">{audit.workflowStatusLabel}</span>
              </p>
            ) : null}
            {audit.feedback ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{audit.feedback}</p>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-foreground">
              <span className="text-muted-foreground">Score correction required: </span>
              {audit.scoreCorrectionRequired ? "Yes" : "No"}
            </p>
            {audit.scoreCorrectionRequired && audit.correctionExplanation ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Correction notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{audit.correctionExplanation}</p>
              </div>
            ) : null}
            <ReviewerResponseBlock audit={audit} />
            {audit.canAcknowledgeRandomAudit || audit.canDisagreeRandomAudit ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                {audit.canAcknowledgeRandomAudit ? (
                  <Button type="button" size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
                    Acknowledge
                  </Button>
                ) : null}
                {audit.canDisagreeRandomAudit ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDisagreeOpen(true)}>
                    Disagree / Add Context
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog open={disagreeOpen} onOpenChange={setDisagreeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disagree / Add Context</DialogTitle>
            <DialogDescription>Explain why you disagree with this random audit. This does not change the audit record.</DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[100px]"
            value={disagreementText}
            onChange={(e) => setDisagreementText(e.target.value)}
            placeholder="Your context…"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisagreeOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!disagreementText.trim() || disagree.isPending} onClick={() => disagree.mutate()}>
              Submit response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editOpen ? (
        <RandomAuditEditDialog audit={audit} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onChanged} />
      ) : null}
      {revertOpen ? (
        <RandomAuditRevertDialog audit={audit} open={revertOpen} onClose={() => setRevertOpen(false)} onReverted={onChanged} />
      ) : null}
    </>
  );
}

export function RandomAuditEditDialog({
  audit,
  open,
  onClose,
  onSaved,
}: {
  audit: QaRandomAuditDetail;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const client = useQueryClient();
  const [outcome, setOutcome] = useState<QaRandomAuditOutcome>(audit.outcome);
  const [feedback, setFeedback] = useState(audit.feedback);
  const [scoreCorrectionRequired, setScoreCorrectionRequired] = useState(audit.scoreCorrectionRequired ? "yes" : "no");
  const [correctionExplanation, setCorrectionExplanation] = useState(audit.correctionExplanation);

  useEffect(() => {
    setOutcome(audit.outcome);
    setFeedback(audit.feedback);
    setScoreCorrectionRequired(audit.scoreCorrectionRequired ? "yes" : "no");
    setCorrectionExplanation(audit.correctionExplanation);
  }, [audit]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/qa/random-audits/${audit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          outcome,
          feedback,
          scoreCorrectionRequired: scoreCorrectionRequired === "yes",
          correctionExplanation,
        }),
      }),
    onSuccess: () => {
      toast.success("Random audit updated");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["qa-random-audits"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved?.();
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const feedbackRequired = outcome === "minor_issue" || outcome === "major_issue";
  const canSubmit =
    scoreCorrectionRequired &&
    (!feedbackRequired || feedback.trim()) &&
    (scoreCorrectionRequired !== "yes" || correctionExplanation.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit random audit</DialogTitle>
          <DialogDescription>Update audit findings. The original Agent QA evaluation is not changed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Audit outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as QaRandomAuditOutcome)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="accurate">Accurate</SelectItem>
                <SelectItem value="minor_issue">Minor Issue Found</SelectItem>
                <SelectItem value="major_issue">Major Issue Found</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audit feedback{feedbackRequired ? "" : " (optional)"}</Label>
            <Textarea className="mt-1 min-h-[88px]" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div>
            <Label>Score correction required?</Label>
            <Select value={scoreCorrectionRequired} onValueChange={(v) => setScoreCorrectionRequired(v as "yes" | "no")}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scoreCorrectionRequired === "yes" ? (
            <div>
              <Label>Correction notes</Label>
              <Textarea className="mt-1 min-h-[72px]" value={correctionExplanation} onChange={(e) => setCorrectionExplanation(e.target.value)} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RandomAuditRevertDialog({
  audit,
  open,
  onClose,
  onReverted,
}: {
  audit: QaRandomAuditDetail;
  open: boolean;
  onClose: () => void;
  onReverted?: () => void;
}) {
  const client = useQueryClient();
  const [revertReason, setRevertReason] = useState("");

  const revert = useMutation({
    mutationFn: () =>
      api(`/api/qa/random-audits/${audit.id}/revert`, {
        method: "POST",
        body: JSON.stringify({ revertReason }),
      }),
    onSuccess: () => {
      toast.success("Random audit reverted");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["qa-random-audits"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onReverted?.();
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revert this Random Audit?</DialogTitle>
          <DialogDescription>
            It will no longer count as an active Random Audit, but its history will be retained.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-[80px]"
          value={revertReason}
          onChange={(e) => setRevertReason(e.target.value)}
          placeholder="Reason for reverting…"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!revertReason.trim() || revert.isPending}
            onClick={() => revert.mutate()}
          >
            Revert audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RandomAuditFormDialog({
  qaReviewId,
  ticketRef,
  open,
  onClose,
}: {
  qaReviewId: string;
  ticketRef: string;
  open: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [outcome, setOutcome] = useState<QaRandomAuditOutcome | "">("");
  const [feedback, setFeedback] = useState("");
  const [scoreCorrectionRequired, setScoreCorrectionRequired] = useState<"yes" | "no" | "">("");
  const [correctionExplanation, setCorrectionExplanation] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api(`/api/qa/${qaReviewId}/random-audit`, {
        method: "POST",
        body: JSON.stringify({
          outcome,
          feedback,
          scoreCorrectionRequired: scoreCorrectionRequired === "yes",
          correctionExplanation,
        }),
      }),
    onSuccess: () => {
      toast.success("Random audit completed");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["qa-random-audits"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const feedbackRequired = outcome === "minor_issue" || outcome === "major_issue";
  const canSubmit =
    outcome &&
    scoreCorrectionRequired &&
    (!feedbackRequired || feedback.trim()) &&
    (scoreCorrectionRequired !== "yes" || correctionExplanation.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit this QA</DialogTitle>
          <DialogDescription>
            Spot-check the Senior Agent&apos;s evaluation for ticket #{ticketRef}. This does not change the original QA score or criteria.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Audit outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as QaRandomAuditOutcome)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select outcome" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="accurate">Accurate</SelectItem>
                <SelectItem value="minor_issue">Minor Issue Found</SelectItem>
                <SelectItem value="major_issue">Major Issue Found</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audit feedback{feedbackRequired ? "" : " (optional)"}</Label>
            <Textarea
              className="mt-1 min-h-[88px]"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did you find when reviewing this QA evaluation?"
            />
          </div>
          <div>
            <Label>Score correction required?</Label>
            <Select value={scoreCorrectionRequired} onValueChange={(v) => setScoreCorrectionRequired(v as "yes" | "no")}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Yes or No" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scoreCorrectionRequired === "yes" ? (
            <div>
              <Label>What appears incorrect?</Label>
              <Textarea
                className="mt-1 min-h-[72px]"
                value={correctionExplanation}
                onChange={(e) => setCorrectionExplanation(e.target.value)}
                placeholder="Which score or scoring area should be reviewed?"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            Complete Random Audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function asRandomAuditDetail(
  audit: QaRandomAuditDetail | { id: string; outcome: QaRandomAuditOutcome; outcomeLabel: string } | null | undefined,
): QaRandomAuditDetail | null {
  if (!audit || !("feedback" in audit)) return null;
  return audit;
}
