import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { surfaceCard } from "./tokens";

export function FilterToolbar({
  search,
  filters,
  onClear,
  showClear,
  trailing,
  className,
  searchClassName,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  onClear?: () => void;
  showClear?: boolean;
  trailing?: ReactNode;
  className?: string;
  searchClassName?: string;
}) {
  return (
    <div className={cn(surfaceCard, "flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {search ? (
        <div className={cn("min-w-[200px] flex-1 sm:max-w-md", searchClassName)}>{search}</div>
      ) : null}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {showClear && onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            <X className="size-3.5" />
            Clear filters
          </Button>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
