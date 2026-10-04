import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="text-sm text-foreground">{children}</div>
    </section>
  );
}
