import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  CoachingMentionTextarea,
  type DiscussionPayload,
  useCoachingMentionDraft,
} from "@/components/coaching-mention-textarea";

export type { DiscussionPayload };

export function CoachingDiscussionComposer({
  coachingId,
  disabled,
  onPosted,
  placeholder = "Add to the discussion… Type @ to mention someone",
  submitLabel = "Post",
  submitVariant = "secondary" as "secondary" | "default",
  layout = "row" as "row" | "stack",
  onSubmit,
  pending: externalPending,
}: {
  coachingId: string;
  disabled?: boolean;
  onPosted?: () => void;
  placeholder?: string;
  submitLabel?: string;
  submitVariant?: "secondary" | "default";
  layout?: "row" | "stack";
  /** When set, skips the default discussion POST and uses this handler instead. */
  onSubmit?: (body: DiscussionPayload) => Promise<void> | void;
  pending?: boolean;
}) {
  const draft = useCoachingMentionDraft();

  const post = useMutation({
    mutationFn: async (body: DiscussionPayload) => {
      if (onSubmit) {
        await onSubmit(body);
        return;
      }
      await api(`/api/coaching/${coachingId}/discussion`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      draft.reset();
      onPosted?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = externalPending ?? post.isPending;

  function submit() {
    const body = draft.buildPayload();
    if (!body) return;
    post.mutate(body);
  }

  const shellClass = layout === "stack" ? "flex flex-col gap-2" : "relative flex flex-col gap-2 sm:flex-row";

  return (
    <div className={shellClass}>
      <CoachingMentionTextarea
        coachingId={coachingId}
        value={draft.value}
        onValueChange={draft.setValue}
        mentionRefs={draft.mentionRefs}
        onMentionRefsChange={draft.setMentionRefs}
        disabled={disabled || pending}
        placeholder={placeholder}
      />
      <Button
        size="sm"
        variant={submitVariant}
        className={layout === "stack" ? "self-start" : "shrink-0"}
        disabled={disabled || draft.value.trim().length < 2 || pending}
        onClick={submit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
