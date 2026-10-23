import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetadataChip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </span>
  );
}

export function WorkflowStatusMiniCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg border border-border/80 bg-card px-3 py-2.5 sm:min-w-[10.5rem] sm:max-w-[14rem]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function guideLifecycleBadgeClass(status: string) {
  if (status === "Published") return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  if (status === "Changes Required") return "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  if (status === "Ready to Publish" || status === "Approved — Ready to Publish") {
    return "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100";
  }
  return "bg-muted text-foreground/90";
}

export function LifecycleStatusBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}
