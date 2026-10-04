import { Link } from "react-router-dom";
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
import { EmptyState } from "./empty-state";
import { PriorityBadge } from "./status-badge";
import { motionClass, surfaceCard } from "./tokens";

export type AttentionRow = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceModule?: string;
  actionLabel?: string;
  priority?: string;
  kind?: string;
};

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

export function AttentionList({ items }: { items: AttentionRow[] }) {
  if (!items.length) {
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
        surfaceCard,
        "grid grid-cols-1 gap-3 p-3 sm:gap-3 md:grid-cols-2 md:gap-3 md:p-3",
      )}
    >
      {items.map((item) => {
        const Icon = iconFor(item);
        return (
          <Link
            key={item.id}
            to={item.href}
            className={cn(
              "group flex min-h-[90px] max-h-[115px] items-start gap-2.5 overflow-hidden rounded-xl border border-border/60 border-l-[3px] px-3 py-2.5 shadow-sm",
              severityAccent(item.priority),
              motionClass,
              "hover:bg-[var(--hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/15">
              <Icon className="size-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.sourceModule ? (
                  <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {item.sourceModule}
                  </span>
                ) : null}
                {item.priority && item.priority !== "Normal" ? <PriorityBadge value={item.priority} /> : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <span className="shrink-0 self-center text-xs font-medium text-primary opacity-80 group-hover:opacity-100">
              {item.actionLabel || "Open"} →
            </span>
          </Link>
        );
      })}
    </div>
  );
}
