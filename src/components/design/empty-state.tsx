import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { surfaceCard } from "./tokens";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  bodyClassName,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(surfaceCard, "flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/[0.06] text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
      {body ? (
        <p className={cn("mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground", bodyClassName)}>{body}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
