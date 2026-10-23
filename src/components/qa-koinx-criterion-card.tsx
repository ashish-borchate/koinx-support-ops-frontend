import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QaRatingInput } from "@/components/qa-rating-input";
import {
  QA_COMMON_RATING_GUIDE,
  QA_CRITERION_EXAMPLES,
  weightedPointsFromRating,
  type QaCriterionMeta,
} from "@/lib/qa-rubric";

type Props = {
  criterion: QaCriterionMeta;
  rating: string;
  comment: string;
  commentError?: string;
  onRating: (value: string) => void;
  onComment: (value: string) => void;
};

function CriterionInfoPanel({ criterion, onClose }: { criterion: QaCriterionMeta; onClose: () => void }) {
  const examples = QA_CRITERION_EXAMPLES[criterion.key] || [];
  return (
    <div
      className="absolute right-0 z-30 mt-1 w-[min(22rem,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-3 text-xs shadow-md"
      role="dialog"
      aria-label={`${criterion.label} scoring guide`}
    >
      <p className="font-semibold text-foreground">{criterion.label}</p>
      {criterion.description ? (
        <p className="mt-1 text-muted-foreground">{criterion.description}</p>
      ) : null}
      <p className="mt-2 font-semibold text-foreground">Full score (10/10)</p>
      <p className="mt-1 text-muted-foreground">All applicable expectations for this criterion were met.</p>
      <p className="mt-3 font-semibold text-foreground">Rating scale</p>
      <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-muted-foreground">
        {QA_COMMON_RATING_GUIDE.slice(0, 8).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {examples.length > 0 ? (
        <>
          <p className="mt-3 font-semibold text-foreground">Examples of deductions</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
            {examples.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="mt-3 h-7 px-2" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

export function QaKoinxCriterionCard({ criterion, rating, comment, commentError, onRating, onComment }: Props) {
  const numericRating = rating === "" ? null : Number(rating);
  const weighted =
    numericRating != null && Number.isFinite(numericRating)
      ? weightedPointsFromRating(numericRating, criterion.maxScore)
      : null;
  const showCommentRequired = numericRating != null && numericRating < 10;
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setInfoOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) setInfoOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [infoOpen]);

  return (
    <div className="flex h-full min-h-[12rem] flex-col rounded-lg border border-border/60 bg-card px-3 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{criterion.label}</p>
          {criterion.description ? (
            <p className="text-xs text-muted-foreground leading-snug">{criterion.description}</p>
          ) : null}
        </div>
        <div className="relative shrink-0" ref={infoRef}>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`${criterion.label} scoring guide`}
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((open) => !open)}
          >
            <Info className="size-4" />
          </Button>
          {infoOpen ? <CriterionInfoPanel criterion={criterion} onClose={() => setInfoOpen(false)} /> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <QaRatingInput
          id={`qa-rating-${criterion.key}`}
          label="Rating (0–10)"
          value={rating}
          onChange={onRating}
        />
        <div className="space-y-1">
          <Label className="text-xs">Weighted score</Label>
          <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold tabular-nums">
            {weighted != null ? (
              <span>{weighted} / {criterion.maxScore}</span>
            ) : (
              <span className="text-muted-foreground font-normal">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1">
        <Label className="text-xs">
          Reviewer comment{showCommentRequired ? " (required below 10)" : " (optional at 10)"}
        </Label>
        <Textarea
          className="min-h-[4rem] text-sm"
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="What happened, what was expected, and impact"
        />
        {commentError ? <p className="text-xs text-destructive">{commentError}</p> : null}
      </div>
    </div>
  );
}

export function QaLegacyCriterionField({
  label,
  maxScore,
  score,
  comment,
  onScore,
  onComment,
}: {
  label: string;
  maxScore: number;
  score: string;
  comment: string;
  onScore: (value: string) => void;
  onComment: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[7.5rem] flex-col rounded-lg border border-border/60 bg-card px-3 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground">{label}</p>
        <div className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
          <Input
            className="h-8 w-12 px-1.5 text-right text-sm font-semibold tabular-nums"
            inputMode="numeric"
            value={score}
            onChange={(event) => onScore(event.target.value)}
            aria-label={`${label} score`}
          />
          <span className="text-muted-foreground">/ {maxScore}</span>
        </div>
      </div>
      <Input
        className="mt-3 h-8 text-sm"
        placeholder="Comment (optional)"
        value={comment}
        onChange={(event) => onComment(event.target.value)}
      />
    </div>
  );
}
