import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQaTotal } from "@/lib/qa-rubric";
import { cn } from "@/lib/utils";
import type { QaCriterionScoreItem } from "@/components/qa-criterion-score-card";

function formatPointTerm(value: number) {
  return formatQaTotal(value);
}

type QaOverallScoreBreakdownDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: QaCriterionScoreItem[];
  displayScore: number;
  originalScore?: number | null;
};

export function QaOverallScoreBreakdownDialog({
  open,
  onOpenChange,
  criteria,
  displayScore,
  originalScore,
}: QaOverallScoreBreakdownDialogProps) {
  const terms = criteria.map((c) => ({ label: c.label, points: c.score }));
  const rawSum = terms.reduce((sum, t) => sum + t.points, 0);
  const equation = terms.map((t) => formatPointTerm(t.points)).join(" + ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Overall QA score</DialogTitle>
          <DialogDescription>
            The overall score is the sum of received points across all evaluation criteria (out of 100).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="space-y-2">
            {terms.map((term) => (
              <li key={term.label} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                <span className="min-w-0 text-muted-foreground">{term.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-foreground">{formatPointTerm(term.points)}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation</p>
            <p className="mt-1 break-words font-mono text-xs leading-relaxed text-foreground sm:text-sm">
              {equation || "0"} = <span className="font-semibold">{formatQaTotal(rawSum)}</span>
            </p>
            <p className="mt-2 text-base font-semibold tabular-nums text-foreground">
              Overall: {formatQaTotal(displayScore)}/100
            </p>
            {originalScore != null && originalScore !== displayScore ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Original overall before appeal adjustment: {formatQaTotal(originalScore)}/100
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type QaOverallScoreTriggerProps = {
  displayScore: number;
  originalScore?: number | null;
  criteria: QaCriterionScoreItem[];
  size?: "lg" | "sm";
  className?: string;
};

export function QaOverallScoreTrigger({
  displayScore,
  originalScore,
  criteria,
  size = "lg",
  className,
}: QaOverallScoreTriggerProps) {
  const [open, setOpen] = useState(false);
  const large = size === "lg";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group inline-flex flex-wrap items-baseline gap-x-1 rounded-md text-left transition-colors",
          "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          large ? "font-heading text-5xl" : "text-lg font-semibold",
          className,
        )}
        aria-label={`Overall QA score ${formatQaTotal(displayScore)} out of 100. Show calculation breakdown.`}
      >
        <span className="tabular-nums underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-primary/60">
          {formatQaTotal(displayScore)}
        </span>
        <span className={cn("text-muted-foreground", large ? "text-2xl" : "text-sm font-normal")}>/100</span>
        {originalScore != null && originalScore !== displayScore ? (
          <span className={cn("font-normal text-muted-foreground", large ? "ml-2 text-sm" : "ml-1 text-xs")}>
            (original {formatQaTotal(originalScore)})
          </span>
        ) : null}
        <span
          className={cn(
            "w-full text-primary opacity-0 transition-opacity group-hover:opacity-100",
            large ? "text-xs font-normal" : "text-[10px]",
          )}
        >
          Click for calculation breakdown
        </span>
      </button>
      <QaOverallScoreBreakdownDialog
        open={open}
        onOpenChange={setOpen}
        criteria={criteria}
        displayScore={displayScore}
        originalScore={originalScore}
      />
    </>
  );
}
