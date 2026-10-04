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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

  const submit = useMutation({
    mutationFn: () =>
      api("/api/reported-issues", {
        method: "POST",
        body: JSON.stringify({
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          description,
          priority,
        }),
      }),
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
    }, 200);
  }

  const canSubmit = canMutate("reported_issues.create") && !readOnly;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle>Issue reported</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Your report has been submitted for review.</p>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report an Issue</DialogTitle>
            </DialogHeader>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">{source.sourceTypeLabel}</p>
              <p className="text-slate-700">{source.sourceLabel}</p>
            </div>
            <div className="space-y-2">
              <Label>Issue / Suggestion</Label>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is incorrect, missing, unclear, or needs to be updated?"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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
            <DialogFooter>
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
}: {
  source: ReportIssueSource;
}) {
  const { can, readOnly } = useAuth();
  const [open, setOpen] = useState(false);
  if (!can("reported_issues.create") || readOnly) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Report an Issue
      </Button>
      <ReportIssueDialog open={open} onOpenChange={setOpen} source={source} />
    </>
  );
}
