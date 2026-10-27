import type { TocEntry } from "@/handbook/lib/toc";
import { useScrollSpy } from "@/handbook/hooks/useScrollSpy";
import { cn } from "@/lib/utils";

export function HandbookToc({ entries, className }: { entries: TocEntry[]; className?: string }) {
  const ids = entries.map((e) => e.id);
  const activeId = useScrollSpy(ids);

  if (!entries.length) return null;

  return (
    <nav aria-label="On this page" className={cn("text-sm", className)}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
      <ul className="space-y-1 border-l border-border/80 pl-3">
        {entries.map((entry) => {
          const active = activeId === entry.id;
          return (
            <li key={entry.id} className={entry.level === 3 ? "pl-3" : undefined}>
              <a
                href={`#${entry.id}`}
                className={cn(
                  "block rounded-md py-0.5 pr-1 text-[13px] motion-safe:transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-l-2 border-primary -ml-[calc(0.75rem+1px)] pl-[calc(0.75rem-1px)] font-medium text-primary"
                    : "text-muted-foreground hover:text-primary",
                )}
                aria-current={active ? "location" : undefined}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
