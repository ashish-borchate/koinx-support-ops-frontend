import { useState } from "react";
import { CalendarClock, CalendarRange, Sparkles, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionClass, surfaceCard } from "./tokens";

export type ResponsibilityItem = { title: string; body: string };

export type ResponsibilityGroups = {
  daily: ResponsibilityItem[];
  weekly: ResponsibilityItem[];
  asNeeded: ResponsibilityItem[];
};

const columns: { key: keyof ResponsibilityGroups; label: string; icon: LucideIcon }[] = [
  { key: "daily", label: "Daily", icon: CalendarClock },
  { key: "weekly", label: "Weekly", icon: CalendarRange },
  { key: "asNeeded", label: "As needed", icon: Sparkles },
];

export function ResponsibilitiesBoard({ groups }: { groups: ResponsibilityGroups }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map(({ key, label, icon: Icon }) => {
        const items = groups[key];
        if (!items.length) return null;
        const shut = collapsed[key] ?? true;
        return (
          <div key={key} className={cn(surfaceCard, "flex flex-col overflow-hidden p-0")}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [key]: !shut }))}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 text-left",
                motionClass,
                "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
              aria-expanded={!shut}
            >
              <span className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">{label}</span>
              </span>
              <ChevronDown className={cn("size-4 text-muted-foreground motion-safe:transition-transform", shut && "-rotate-90")} />
            </button>
            {!shut ? (
              <ul className="flex flex-col gap-1.5 p-2">
                {items.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 motion-safe:transition-colors hover:bg-muted/40"
                  >
                    <p className="text-[13px] font-medium leading-snug text-foreground">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{item.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
