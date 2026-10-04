import { cn } from "@/lib/utils";

const toneClasses = {
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] ring-1 ring-[var(--status-success-border)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] ring-1 ring-[var(--status-warning-border)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] ring-1 ring-[var(--status-danger-border)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] ring-1 ring-[var(--status-info-border)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)] ring-1 ring-[var(--status-neutral-border)]",
} as const;

/** Semantic tinted badges — consistent across modules (presentation only). */
export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-snug",
        toneForStatus(value),
        className,
      )}
    >
      {value}
    </span>
  );
}

export function PriorityBadge({ value, className }: { value: string; className?: string }) {
  return <StatusBadge value={value} className={className} />;
}

function toneForStatus(value: string) {
  const lower = value.trim().toLowerCase();

  if (["critical", "high", "overdue"].some((k) => lower.includes(k))) {
    return toneClasses.danger;
  }
  if (
    ["important", "medium", "pending", "pending review", "due soon", "needs action"].some((k) => lower.includes(k))
  ) {
    return toneClasses.warning;
  }
  if (
    ["resolved", "done", "published", "verified", "complete", "completed", "acknowledged", "active"].some((k) =>
      lower.includes(k),
    )
  ) {
    return toneClasses.success;
  }
  if (["in progress", "open", "reviewed", "approved", "working"].some((k) => lower.includes(k))) {
    return toneClasses.info;
  }
  if (["no action required", "not required", "archived", "blocked", "closed"].some((k) => lower.includes(k))) {
    return toneClasses.neutral;
  }
  return toneClasses.neutral;
}
