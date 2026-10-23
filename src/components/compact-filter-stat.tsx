import { cn } from "@/lib/utils";

/** Compact clickable filter tile (toggle active on second click). */
export function CompactFilterStat({
  label,
  value,
  onClick,
  active,
  disabled,
  accent,
  labelClassName,
}: {
  label: string;
  value: number;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  accent?: "default" | "amber" | "blue" | "emerald" | "violet";
  labelClassName?: string;
}) {
  const accentRing =
    accent === "amber"
      ? "ring-amber-400/50"
      : accent === "blue"
        ? "ring-blue-400/50"
        : accent === "emerald"
          ? "ring-emerald-400/50"
          : "ring-primary/40";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-w-[6.5rem] flex-1 rounded-lg border border-border/80 bg-card px-2.5 py-2 text-center transition-colors sm:min-w-[7.5rem]",
        "hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50",
        active && `border-primary/50 bg-primary/5 ring-2 ring-offset-1 ring-offset-background ${accentRing}`,
      )}
    >
      <p className={cn("text-[11px] font-medium leading-snug text-muted-foreground", labelClassName)}>{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-foreground">{value}</p>
    </button>
  );
}

export function toggleFeatureImpactFilter(current: string, next: string, clear = "all") {
  return current === next ? clear : next;
}
