import { cn } from "@/lib/utils";

export function FreshdeskStatusPill({
  label,
  status,
}: {
  label: string;
  status?: "success" | "failed" | "running" | "idle" | "sample";
}) {
  const dot =
    status === "success"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-[var(--destructive)]"
        : status === "running"
          ? "bg-amber-500 motion-safe:animate-pulse"
          : "bg-muted-foreground/50";

  return (
    <div
      className={cn(
        "hidden max-w-md items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex",
        status === "failed" && "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
      )}
      title={label}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  );
}
