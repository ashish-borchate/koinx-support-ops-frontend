import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutVariant = "note" | "tip" | "important" | "warning";

const styles: Record<CalloutVariant, { box: string; icon: typeof Info }> = {
  note: { box: "border-border/80 bg-muted/30", icon: Info },
  tip: { box: "border-primary/30 bg-primary/5", icon: Lightbulb },
  important: { box: "border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30", icon: AlertTriangle },
  warning: { box: "border-destructive/30 bg-destructive/5", icon: AlertTriangle },
};

export function HandbookCallout({
  variant,
  title,
  children,
}: {
  variant: CalloutVariant;
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = styles[variant].icon;
  return (
    <div className={cn("my-4 rounded-xl border px-4 py-3 text-sm", styles[variant].box)} role="note">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
        {title || variant.charAt(0).toUpperCase() + variant.slice(1)}
      </p>
      <div className="mt-2 text-foreground/90 [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}
