import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IssueEvidencePicker, type PendingEvidenceFile } from "@/components/issue-evidence";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadIssueAttachments } from "@/lib/issue-attachments";

const PRIORITIES = ["Normal", "Important", "Critical"] as const;

export type ReportIssueSource = {
  sourceType: "knowledge_base" | "product_guide" | "integration_step";
  sourceId: string;
  sourceTypeLabel: string;
  sourceLabel: string;
};

export function ReportIssueDialog({
  open,
  onOpenChange,
  source,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ReportIssueSource;
  onSubmitted?: () => void;
}) {
  const { canMutate, readOnly } = useAuth();
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("Normal");
  const [success, setSuccess] = useState(false);
  const [evidence, setEvidence] = useState<PendingEvidenceFile[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await api<{ item: { id: string } }>("/api/reported-issues", {
        method: "POST",
        body: JSON.stringify({
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          description,
          priority,
        }),
      });
      if (evidence.length) await uploadIssueAttachments(res.item.id, evidence.map((e) => e.file));
    },
    onSuccess: () => {
      setSuccess(true);
      toast.success("Issue reported");
      onSubmitted?.();
    },
    onError: (e) => toast.error(e.message),
  });

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setSuccess(false);
      setDescription("");
      setPriority("Normal");
      setEvidence([]);
    }, 200);
  }

  const canSubmit = canMutate("reported_issues.create") && !readOnly;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[min(90vh,36rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {success ? (
          <div className="p-4">
            <DialogHeader>
              <DialogTitle>Issue reported</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Your report has been submitted for review.</p>
            <DialogFooter className="mt-4">
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 px-4 pb-3 pt-4 text-left">
              <DialogTitle>Report an Issue</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{source.sourceTypeLabel}</p>
              <p className="mt-0.5 font-medium text-foreground">{source.sourceLabel}</p>
            </div>
            <div className="space-y-2">
              <Label>Issue / Suggestion</Label>
              <Textarea
                rows={5}
                className="min-h-[7rem] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is incorrect, missing, unclear, or needs to be updated?"
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence / Attachments</Label>
              <p className="text-xs text-muted-foreground">Optional — add screenshots or files that help explain the issue.</p>
              <IssueEvidencePicker
                files={evidence}
                onChange={setEvidence}
                disabled={!canSubmit || submit.isPending}
                showHelper={false}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
            <DialogFooter className="!mx-0 !mb-0 shrink-0 gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!canSubmit || submit.isPending || description.trim().length < 3} onClick={() => submit.mutate()}>
                Submit Report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReportIssueButton({
  source,
  variant = "default",
}: {
  source: ReportIssueSource;
  variant?: "default" | "outline";
}) {
  const { can, readOnly } = useAuth();
  const [open, setOpen] = useState(false);
  if (!can("reported_issues.create") || readOnly) return null;
  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)}>
        Report Issue
      </Button>
      <ReportIssueDialog open={open} onOpenChange={setOpen} source={source} />
    </>
  );
}
