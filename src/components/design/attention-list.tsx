import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ClipboardCheck,
  Flag,
  ListChecks,
  MessageSquarePlus,
  Plug,
  Siren,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "./empty-state";
import { PriorityBadge } from "./status-badge";
import { motionClass, surfaceCard } from "./tokens";
import { Button } from "@/components/ui/button";

export type AttentionRow = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceModule?: string;
  actionLabel?: string;
  priority?: string;
  kind?: string;
  acknowledgeGuideId?: string;
  hubDismissKey?: string;
  qaCriticalAckReviewId?: string;
};

function displaySourceModule(name: string) {
  return name === "Coaching" ? "Coaching Center" : name;
}

function iconFor(item: AttentionRow): LucideIcon {
  const mod = (item.sourceModule || item.kind || "").toLowerCase();
  if (mod.includes("reported")) return Flag;
  if (mod.includes("support action")) return MessageSquarePlus;
  if (mod.includes("integration")) return Plug;
  if (mod.includes("guide") || mod.includes("product guide")) return BookOpen;
  if (mod.includes("qa")) return ClipboardCheck;
  if (mod.includes("escalation") || item.kind === "escalation") return Siren;
  if (mod.includes("task") || item.kind === "task") return ListChecks;
  if (mod.includes("feature")) return Sparkles;
  return AlertCircle;
}

function severityAccent(priority?: string) {
  if (priority === "Critical") {
    return "border-l-[var(--attention-critical-accent)] bg-gradient-to-r from-[var(--attention-critical-bg)] to-card";
  }
  if (priority === "Important" || priority === "High") {
    return "border-l-[var(--attention-warning-accent)] bg-gradient-to-r from-[var(--attention-warning-bg)] to-card";
  }
  return "border-l-[var(--attention-default-accent)]";
}

function AttentionCard({
  item,
  onAcknowledge,
  onAcknowledgeHub,
  onAcknowledgeQaCritical,
  acknowledging,
  readOnly,
}: {
  item: AttentionRow;
  onAcknowledge?: (guideId: string) => void;
  onAcknowledgeHub?: (key: string) => void;
  onAcknowledgeQaCritical?: (reviewId: string) => void;
  acknowledging?: boolean;
  readOnly?: boolean;
}) {
  const Icon = iconFor(item);
  const showHubActions = Boolean(item.hubDismissKey && onAcknowledgeHub && !readOnly);
  const showQaCriticalAck =
    Boolean(item.qaCriticalAckReviewId && onAcknowledgeQaCritical && !readOnly);
  const showAcknowledge =
    !showHubActions &&
    !showQaCriticalAck &&
    item.acknowledgeGuideId &&
    item.actionLabel === "Acknowledge" &&
    onAcknowledge &&
    !readOnly;

  const shellClass = cn(
    "group flex min-h-[90px] max-h-[115px] items-start gap-2.5 overflow-hidden rounded-xl border border-border/60 border-l-[3px] px-3 py-2.5 shadow-sm",
    severityAccent(item.priority),
    motionClass,
    "hover:bg-[var(--hover-surface)] focus-within:ring-2 focus-within:ring-ring",
  );

  const main = (
    <>
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/15">
        <Icon className="size-3.5" aria-hidden />
      </div>
      <Link to={item.href} className="min-w-0 flex-1 focus-visible:outline-none">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.sourceModule ? (
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {displaySourceModule(item.sourceModule)}
            </span>
          ) : null}
          {item.priority && item.priority !== "Normal" ? <PriorityBadge value={item.priority} /> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
      </Link>
      {showHubActions ? (
        <div className="flex shrink-0 flex-col gap-1.5 self-center sm:flex-row sm:items-center">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={item.href}>View</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={acknowledging}
            onClick={() => onAcknowledgeHub!(item.hubDismissKey!)}
          >
            Acknowledge
          </Button>
        </div>
      ) : showQaCriticalAck ? (
        <div className="flex shrink-0 flex-col gap-1.5 self-center sm:flex-row sm:items-center">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={item.href}>Review</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={acknowledging}
            onClick={() => onAcknowledgeQaCritical!(item.qaCriticalAckReviewId!)}
          >
            Acknowledge
          </Button>
        </div>
      ) : showAcknowledge ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 self-center"
          disabled={acknowledging}
          onClick={() => onAcknowledge(item.acknowledgeGuideId!)}
        >
          Acknowledge
        </Button>
      ) : (
        <Link
          to={item.href}
          className="shrink-0 self-center text-xs font-medium text-primary opacity-80 hover:opacity-100"
        >
          {item.actionLabel || "Open"} →
        </Link>
      )}
    </>
  );

  if (showAcknowledge || showHubActions || showQaCriticalAck) {
    return <div className={shellClass}>{main}</div>;
  }

  return (
    <div className={cn(shellClass, "focus-within:ring-2 focus-within:ring-ring")}>{main}</div>
  );
}

export function AttentionList({ items, embedded }: { items: AttentionRow[]; embedded?: boolean }) {
  const { readOnly } = useAuth();
  const client = useQueryClient();
  const acknowledge = useMutation({
    mutationFn: (guideId: string) =>
      api(`/api/product-guides/${guideId}/review-task/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Review reminder acknowledged");
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["pg-review-tasks"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const acknowledgeHub = useMutation({
    mutationFn: (key: string) =>
      api("/api/hub-notifications/dismiss", { method: "POST", body: JSON.stringify({ key }) }),
    onSuccess: () => {
      toast.success("Acknowledged");
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const acknowledgeQaCritical = useMutation({
    mutationFn: (reviewId: string) => {
      const note = window.prompt("Optional resolution note for this critical error review:") || "";
      return api(`/api/qa/${reviewId}/critical-error/supervisor-acknowledge`, {
        method: "POST",
        body: JSON.stringify({ resolutionNote: note }),
      });
    },
    onSuccess: () => {
      toast.success("Critical QA error acknowledged");
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!items.length) {
    if (embedded) return null;
    return (
      <EmptyState
        icon={CheckCircle2}
        title="You're all caught up"
        body="Nothing assigned to you requires action right now."
      />
    );
  }

  return (
    <div
      className={cn(
        embedded ? "grid grid-cols-1 gap-3 md:grid-cols-2" : cn(surfaceCard, "grid grid-cols-1 gap-3 p-3 sm:gap-3 md:grid-cols-2 md:gap-3 md:p-3"),
      )}
    >
      {items.map((item) => (
        <AttentionCard
          key={item.id}
          item={item}
          readOnly={readOnly}
          acknowledging={acknowledge.isPending || acknowledgeHub.isPending || acknowledgeQaCritical.isPending}
          onAcknowledge={(guideId) => acknowledge.mutate(guideId)}
          onAcknowledgeHub={(key) => acknowledgeHub.mutate(key)}
          onAcknowledgeQaCritical={(reviewId) => acknowledgeQaCritical.mutate(reviewId)}
        />
      ))}
    </div>
  );
}
