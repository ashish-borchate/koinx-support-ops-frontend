import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export type SectionNavItem = { label: string; to: string; description?: string };

export function HandbookSectionNav({ title, items }: { title: string; items: SectionNavItem[] }) {
  const location = useLocation();
  if (items.length <= 1) return null;

  const compact = items.length > 4;

  return (
    <nav aria-label={title} className="mb-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul
        className={cn(
          "grid gap-2",
          compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "block h-full rounded-xl border px-3 py-2.5 motion-safe:transition-[border-color,box-shadow]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary/40 bg-primary/[0.06] shadow-[var(--shadow-card)]"
                    : "border-border/70 bg-card/50 hover:border-primary/25 hover:shadow-[var(--shadow-card)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className={cn("text-sm leading-snug", active ? "font-medium text-primary" : "font-medium text-foreground")}>
                  {item.label}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground line-clamp-2">{item.description}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
