import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DISCOVER_CHAPTERS } from "@/handbook/lib/learning-catalog";
import { cn } from "@/lib/utils";

export function DiscoverPrevNext({ slug }: { slug: string }) {
  const idx = DISCOVER_CHAPTERS.findIndex((c) => c.slug === slug);
  if (idx < 0) return null;
  const prev = idx > 0 ? DISCOVER_CHAPTERS[idx - 1] : null;
  const next = idx < DISCOVER_CHAPTERS.length - 1 ? DISCOVER_CHAPTERS[idx + 1] : null;
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Discover articles"
      className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between"
    >
      {prev ? (
        <Link
          to={`/handbook/discover/${prev.slug}`}
          className={cn(
            "inline-flex max-w-md items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm",
            "hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <ChevronLeft className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block text-xs text-muted-foreground">Previous</span>
            <span className="font-medium text-foreground">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={`/handbook/discover/${next.slug}`}
          className={cn(
            "inline-flex max-w-md items-center justify-end gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm sm:text-right",
            "hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span>
            <span className="block text-xs text-muted-foreground">Next</span>
            <span className="font-medium text-foreground">{next.title}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
