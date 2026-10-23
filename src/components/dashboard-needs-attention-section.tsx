import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { accordionChevron, dashboardModuleShell, motionClass } from "@/components/design/tokens";
import { AttentionList, type AttentionRow } from "@/components/design/attention-list";

export function DashboardNeedsAttentionSection({ items }: { items: AttentionRow[] }) {
  const [open, setOpen] = useState(() => items.length > 0);

  return (
    <section>
      <div className={dashboardModuleShell}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 text-left",
            motionClass,
            "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
          aria-expanded={open}
        >
          <span className="min-w-0">
            <span className="text-sm font-semibold text-foreground">Needs your attention</span>
            {items.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
            ) : null}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Mentions, discussions, and other direct notifications.
            </span>
          </span>
          <ChevronDown className={cn("size-5", accordionChevron, !open && "-rotate-90")} />
        </button>
        {open ? (
          <div className="p-3">
            {items.length > 0 ? (
              <AttentionList items={items} embedded />
            ) : (
              <p className="py-1 text-sm text-muted-foreground">
                You&apos;re all caught up. Nothing assigned to you requires action right now.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
