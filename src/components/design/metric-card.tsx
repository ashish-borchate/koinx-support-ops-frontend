import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionClass, surfaceCard, surfaceInteractive } from "./tokens";

type Tone = "default" | "success" | "warning" | "critical" | "info";

const toneRing: Record<Tone, string> = {
  default: "",
  success: "border-[var(--metric-success-border)] bg-gradient-to-br from-[var(--metric-success-bg)] to-card",
  warning: "border-[var(--metric-warning-border)] bg-gradient-to-br from-[var(--metric-warning-bg)] to-card",
  critical: "border-[var(--metric-critical-border)] bg-gradient-to-br from-[var(--metric-critical-bg)] to-card",
  info: "border-[var(--metric-info-border)] bg-gradient-to-br from-[var(--metric-info-bg)] to-card",
};

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "default",
  interactive,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: LucideIcon;
  tone?: Tone;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Wrapper = onClick ? "button" : "div";
  const base = cn(
    interactive || onClick ? surfaceInteractive : surfaceCard,
    motionClass,
    "w-full p-4 text-left",
    toneRing[tone],
    onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  );

  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} className={base}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </Wrapper>
  );
}
