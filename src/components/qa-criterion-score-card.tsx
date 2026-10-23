import { ratingFromCriterion } from "@/lib/qa-rubric";
import { cn } from "@/lib/utils";

export type QaCriterionScoreItem = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  rating?: number | null;
  comment?: string;
};

type QaCriterionScoreCardProps = {
  criterion: QaCriterionScoreItem;
  showRating?: boolean;
  showComment?: boolean;
  className?: string;
};

export function QaCriterionScoreCard({
  criterion,
  showRating = true,
  showComment = false,
  className,
}: QaCriterionScoreCardProps) {
  const rating = ratingFromCriterion(criterion);
  return (
    <div
      className={cn(
        "flex min-h-[6.5rem] flex-col rounded-lg border border-border/60 bg-gradient-to-b from-card to-muted/15 px-3.5 py-3 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <p className="text-sm font-semibold leading-snug tracking-tight text-foreground">{criterion.label}</p>
      <div className="mt-auto space-y-1 pt-2.5 text-xs">
        <p className="text-muted-foreground">
          Received Points{" "}
          <span className="tabular-nums font-semibold text-foreground">
            {criterion.score}/{criterion.maxScore}
          </span>
        </p>
        {showRating ? (
          <p className="text-muted-foreground">
            Received Rating{" "}
            <span className="tabular-nums font-semibold text-foreground">{rating}/10</span>
          </p>
        ) : null}
      </div>
      {showComment && criterion.comment ? (
        <p className="mt-2 border-t border-border/40 pt-2 text-xs leading-relaxed text-muted-foreground">
          {criterion.comment}
        </p>
      ) : null}
    </div>
  );
}

export function QaCriterionScoreGrid({
  criteria,
  showRating = true,
  showComment = false,
  className,
}: {
  criteria: QaCriterionScoreItem[];
  showRating?: boolean;
  showComment?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2.5 sm:grid-cols-2", className)}>
      {criteria.map((criterion) => (
        <QaCriterionScoreCard
          key={criterion.key}
          criterion={criterion}
          showRating={showRating}
          showComment={showComment}
        />
      ))}
    </div>
  );
}
