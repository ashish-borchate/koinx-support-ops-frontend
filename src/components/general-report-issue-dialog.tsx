import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IssueEvidencePicker, type PendingEvidenceFile } from "@/components/issue-evidence";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadIssueAttachments } from "@/lib/issue-attachments";

const PRIORITIES = ["Normal", "Important", "Critical"] as const;

export function GeneralReportIssueDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const { canMutate, readOnly } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("Normal");
  const [assignedToId, setAssignedToId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [suggestedAction, setSuggestedAction] = useState("");
  const [relatedLink, setRelatedLink] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [success, setSuccess] = useState(false);
  const [evidence, setEvidence] = useState<PendingEvidenceFile[]>([]);

  const assignees = useQuery({
    queryKey: ["reported-issues-assignees"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/reported-issues/assignees"),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await api<{ item: { id: string } }>("/api/reported-issues", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "operations",
          title,
          description,
          priority,
          assignedToId: assignedToId || undefined,
          followUpDate: followUpDate || undefined,
          suggestedAction: suggestedAction.trim() || undefined,
          relatedLink: relatedLink.trim() || undefined,
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
      setTitle("");
      setDescription("");
      setPriority("Normal");
      setAssignedToId("");
      setFollowUpDate("");
      setSuggestedAction("");
      setRelatedLink("");
      setShowOptional(false);
      setEvidence([]);
    }, 200);
  }

  const canSubmit = canMutate("reported_issues.create") && !readOnly;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[min(90vh,40rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {success ? (
          <div className="p-4">
            <DialogHeader>
              <DialogTitle>Issue reported</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Your report has been submitted.</p>
            <DialogFooter className="mt-4">
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 border-b border-border/60 px-4 pb-3 pt-4">
              <DialogTitle>Report an Issue</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is happening and what needs attention?"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setShowOptional((v) => !v)}
              >
                {showOptional ? "Hide optional fields" : "Add follow-up details (optional)"}
              </button>
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
              {showOptional ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Assigned to</Label>
                    <Select value={assignedToId || "none"} onValueChange={(v) => setAssignedToId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(assignees.data?.users || []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Follow-up date</Label>
                    <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Suggested action</Label>
                    <Textarea rows={2} value={suggestedAction} onChange={(e) => setSuggestedAction(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Related link</Label>
                    <Input value={relatedLink} onChange={(e) => setRelatedLink(e.target.value)} placeholder="https://…" />
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter className="!mx-0 !mb-0 shrink-0 gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button
                disabled={!canSubmit || submit.isPending || title.trim().length < 3 || description.trim().length < 3}
                onClick={() => submit.mutate()}
              >
                Submit report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
