import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { QaRatingInput } from "@/components/qa-rating-input";
import { ApiError, api } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { formatQaTotal, ratingFromCriterion, weightedPointsFromRating } from "@/lib/qa-rubric";
import { cn } from "@/lib/utils";
import type { Review } from "@/pages/qa-types";

type Props = {
  review: Review;
  appealDeadline: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QaAppealSubmitDialog({ review, appealDeadline, open, onOpenChange }: Props) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const displayScore = review.effectiveOverallScore ?? review.overallScore;

  const chosenKeys = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const mutation = useMutation({
    mutationFn: () =>
      api(`/api/qa/${review.id}/appeals`, {
        method: "POST",
        body: JSON.stringify({
          criteria: chosenKeys.map((key) => ({
            key,
            reason: reasons[key]?.trim() || "",
            evidence: evidence[key]?.trim() || undefined,
          })),
        }),
      }),
    onSuccess: () => {
      toast.success("QA appeal submitted");
      onOpenChange(false);
      setStep("form");
      setSelected({});
      setReasons({});
      setEvidence({});
      setExpandedKey(null);
      void client.invalidateQueries({ queryKey: ["qa", review.id] });
      void client.invalidateQueries({ queryKey: ["qa-appeals"] });
      void client.invalidateQueries({ queryKey: ["qa-workflow-summary"] });
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        const href = typeof e.payload?.href === "string" ? e.payload.href : null;
        toast.message("An appeal already exists for this evaluation.");
        onOpenChange(false);
        if (href) navigate(href);
        return;
      }
      toast.error(e.message);
    },
  });

  const valid =
    chosenKeys.length > 0 && chosenKeys.every((key) => (reasons[key]?.trim().length ?? 0) >= 3);

  function toggleCriterion(key: string, next: boolean) {
    setSelected((prev) => ({ ...prev, [key]: next }));
    if (next) setExpandedKey(key);
    else if (expandedKey === key) setExpandedKey(null);
  }

  function attachMedia(key: string, file: File | undefined) {
    if (!file) return;
    const label = file.name.length > 48 ? `${file.name.slice(0, 45)}…` : file.name;
    setEvidence((prev) => ({ ...prev, [key]: `attachment:${label}` }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setStep("form");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request QA appeal</DialogTitle>
          <DialogDescription>
            Ticket {review.ticketRef} · Original {formatQaTotal(review.overallScore)}/100 · Effective{" "}
            {formatQaTotal(displayScore)}/100
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Appeal deadline: <span className="font-medium text-foreground">{formatWhen(appealDeadline)}</span>
        </p>

        {step === "form" ? (
          <div className="space-y-2">
            {chosenKeys.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                {chosenKeys.length} criteria selected — expand one at a time to keep this form compact.
              </p>
            ) : null}
            {review.criteria.map((criterion) => {
              const rating = ratingFromCriterion(criterion);
              const checked = Boolean(selected[criterion.key]);
              const expanded = expandedKey === criterion.key;
              const mediaLabel = evidence[criterion.key]?.replace(/^attachment:/, "");
              return (
                <div
                  key={criterion.key}
                  className={cn(
                    "rounded-lg border border-border/60 overflow-hidden",
                    checked && "border-primary/40",
                  )}
                >
                  <div className="flex items-start gap-2 p-2.5">
                    <input
                      id={`appeal-${criterion.key}`}
                      type="checkbox"
                      className="mt-1 size-4 rounded border border-input"
                      checked={checked}
                      onChange={(e) => toggleCriterion(criterion.key, e.target.checked)}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (!checked) toggleCriterion(criterion.key, true);
                        else setExpandedKey((k) => (k === criterion.key ? null : criterion.key));
                      }}
                    >
                      <span className="font-medium text-sm leading-snug">{criterion.label}</span>
                      <p className="text-xs text-muted-foreground">
                        Rating {rating}/10 · {criterion.score}/{criterion.maxScore} pts
                      </p>
                    </button>
                    {checked ? (
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                      />
                    ) : null}
                  </div>
                  {checked && expanded ? (
                    <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2">
                      <Textarea
                        placeholder="Why do you disagree with this rating? (required)"
                        value={reasons[criterion.key] || ""}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [criterion.key]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={(el) => {
                            fileRefs.current[criterion.key] = el;
                          }}
                          type="file"
                          accept="image/*,.pdf,.png,.jpg,.jpeg,.webp"
                          className="hidden"
                          onChange={(e) => {
                            attachMedia(criterion.key, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => fileRefs.current[criterion.key]?.click()}
                        >
                          <Paperclip className="size-3.5" />
                          Add media
                        </Button>
                        {mediaLabel ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[12rem]">{mediaLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium">You are about to submit an appeal for:</p>
            <div className="flex flex-wrap gap-1.5">
              {chosenKeys.map((key) => {
                const c = review.criteria.find((x) => x.key === key)!;
                return (
                  <span
                    key={key}
                    className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {c.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "form" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" disabled={!valid} onClick={() => setStep("confirm")}>Continue</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("form")}>Back</Button>
              <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                Submit appeal
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Preview helper for reviewer/supervisor forms */
export function previewRevisedOverall(
  criteria: Review["criteria"],
  revisions: Record<string, string>,
) {
  let total = 0;
  for (const c of criteria) {
    const raw = revisions[c.key];
    const rating = raw ? Number(raw) : ratingFromCriterion(c);
    total += weightedPointsFromRating(rating, c.maxScore);
  }
  return Math.round(total * 100) / 100;
}

export function RatingSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return <QaRatingInput label={label} value={value} onChange={onChange} />;
}
