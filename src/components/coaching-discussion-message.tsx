import { AlertTriangle, CheckCircle2, MessageSquare, Sparkles } from "lucide-react";
import { renderMentionText, type DiscussionMention } from "@/lib/mention-display";
import { cn } from "@/lib/utils";

export type { DiscussionMention };

export type DiscussionItem = {
  id: string;
  authorName: string;
  kind: string;
  title: string;
  message: string;
  mentions?: DiscussionMention[];
  createdAt: string;
};

type DiscussionTone = "human" | "dispute" | "success" | "pending" | "neutral";

function discussionTone(msg: DiscussionItem): DiscussionTone {
  if (msg.kind === "dispute") return "dispute";
  if (msg.kind === "system") {
    const title = msg.title.trim().toLowerCase();
    if (title === "confirmation") return "success";
    if (title === "session submitted" || title === "acknowledgement requested") return "pending";
    const body = msg.message.toLowerCase();
    if (body.includes("confirmed that the coaching session")) return "success";
    if (
      body.includes("submitted for agent confirmation") ||
      body.includes("acknowledgement requested again")
    ) {
      return "pending";
    }
    return "neutral";
  }
  return "human";
}

const toneStyles: Record<
  DiscussionTone,
  { box: string; title: string; icon: string }
> = {
  human: { box: "border-border/50 bg-card", title: "text-muted-foreground", icon: "text-muted-foreground" },
  dispute: {
    box: "border-destructive/35 bg-destructive/5",
    title: "text-destructive",
    icon: "text-destructive",
  },
  success: {
    box: "border-emerald-500/40 bg-emerald-500/10",
    title: "text-emerald-800 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    box: "border-amber-500/45 bg-amber-500/10",
    title: "text-amber-900 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
  },
  neutral: { box: "border-border/40 bg-muted/25", title: "text-muted-foreground", icon: "text-muted-foreground" },
};

export function CoachingDiscussionMessage({
  msg,
  formatDateTime,
}: {
  msg: DiscussionItem;
  formatDateTime: (iso: string) => string;
}) {
  const tone = discussionTone(msg);
  const styles = toneStyles[tone];

  return (
    <div className={cn("rounded-md border px-2.5 py-2", styles.box)}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5", styles.icon)}>
          {tone === "dispute" ? (
            <AlertTriangle className="size-3.5" />
          ) : tone === "success" ? (
            <CheckCircle2 className="size-3.5" />
          ) : tone === "pending" || tone === "neutral" ? (
            <Sparkles className="size-3.5" />
          ) : (
            <MessageSquare className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {msg.authorName}
            <span className="font-normal text-muted-foreground"> · {formatDateTime(msg.createdAt)}</span>
          </p>
          {msg.title ? (
            <p className={cn("mt-0.5 text-xs font-medium", styles.title)}>
              {msg.title}
            </p>
          ) : null}
          <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
            {renderMentionText(msg.message, msg.mentions)}
          </p>
        </div>
      </div>
    </div>
  );
}
