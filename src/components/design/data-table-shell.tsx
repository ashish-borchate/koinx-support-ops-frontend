import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { surfaceCard } from "./tokens";

export function DataTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(surfaceCard, "overflow-hidden p-0", className)}>
      <div className="relative w-full overflow-x-auto">{children}</div>
    </div>
  );
}
