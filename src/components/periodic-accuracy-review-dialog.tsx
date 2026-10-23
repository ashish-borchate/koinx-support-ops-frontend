import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyPeriodicChecklist,
  PERIODIC_CHECKLIST_ITEMS,
  type PeriodicChecklistPayload,
} from "@/lib/periodic-review-checklist";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideTitle: string;
  pending?: boolean;
  onSubmit: (payload: { outcome: "accurate" | "needs_update"; checklist: PeriodicChecklistPayload; correctionNotes?: string }) => void;
};

export function PeriodicAccuracyReviewDialog({ open, onOpenChange, guideTitle, pending, onSubmit }: Props) {
  const [checklist, setChecklist] = useState<PeriodicChecklistPayload>(() => emptyPeriodicChecklist());
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [step, setStep] = useState<"checklist" | "needs_update">("checklist");

  useEffect(() => {
    if (!open) {
      setChecklist(emptyPeriodicChecklist());
      setCorrectionNotes("");
      setStep("checklist");
    }
  }, [open]);

  function setItemResult(id: string, result: "yes" | "na") {
    setChecklist((prev) => ({
      ...prev,
      [id]: { result, naReason: result === "na" ? prev[id]?.naReason || "" : undefined },
    }));
  }

  function checklistComplete() {
    return PERIODIC_CHECKLIST_ITEMS.every((item) => {
      const entry = checklist[item.id];
      if (!entry || (entry.result !== "yes" && entry.result !== "na")) return false;
      if (entry.result === "na" && !entry.naReason?.trim()) return false;
      return true;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Periodic accuracy review</DialogTitle>
          <p className="text-sm font-normal text-muted-foreground">{guideTitle}</p>
        </DialogHeader>

        {step === "checklist" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Confirm each item before choosing an outcome.</p>
            <ul className="space-y-4">
              {PERIODIC_CHECKLIST_ITEMS.map((item) => {
                const entry = checklist[item.id];
                const isNa = entry?.result === "na";
                return (
                  <li key={item.id} className="space-y-2 rounded-lg border border-border/70 p-3">
                    <p className="text-sm leading-snug text-foreground">{item.label}</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${item.id}-result`}
                          checked={entry?.result === "yes"}
                          onChange={() => setItemResult(item.id, "yes")}
                        />
                        Verified
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${item.id}-result`}
                          checked={isNa}
                          onChange={() => setItemResult(item.id, "na")}
                        />
                        Not applicable
                      </label>
                    </div>
                    {isNa ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Why is this not applicable?</Label>
                        <Textarea
                          rows={2}
                          value={entry?.naReason || ""}
                          onChange={(e) =>
                            setChecklist((prev) => ({
                              ...prev,
                              [item.id]: { result: "na", naReason: e.target.value },
                            }))
                          }
                          placeholder="Short explanation"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>What needs to be corrected?</Label>
            <Textarea
              rows={4}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              placeholder="Brief description for follow-up"
            />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          {step === "checklist" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!checklistComplete() || pending}
                onClick={() => onSubmit({ outcome: "accurate", checklist })}
              >
                Still Accurate
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!checklistComplete() || pending}
                onClick={() => setStep("needs_update")}
              >
                Needs Update
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep("checklist")}>Back</Button>
              <Button
                type="button"
                disabled={!correctionNotes.trim() || pending}
                onClick={() => onSubmit({ outcome: "needs_update", checklist, correctionNotes: correctionNotes.trim() })}
              >
                Submit Needs Update
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
