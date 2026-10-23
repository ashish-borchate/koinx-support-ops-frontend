export { useMentionDraft as useCoachingMentionDraft, type MentionPayload as DiscussionPayload, type MentionRef } from "@/components/hub-mention-textarea";

import { HubMentionTextarea } from "@/components/hub-mention-textarea";
import type { MentionRef } from "@/components/hub-mention-textarea";

export function CoachingMentionTextarea({
  coachingId,
  value,
  onValueChange,
  mentionRefs,
  onMentionRefsChange,
  disabled,
  placeholder,
  className,
}: {
  coachingId: string;
  value: string;
  onValueChange: (next: string) => void;
  mentionRefs: MentionRef[];
  onMentionRefsChange: (next: MentionRef[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <HubMentionTextarea
      scope="coaching"
      recordId={coachingId}
      value={value}
      onValueChange={onValueChange}
      mentionRefs={mentionRefs}
      onMentionRefsChange={onMentionRefsChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}
