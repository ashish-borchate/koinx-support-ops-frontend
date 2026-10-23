import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader } from "@/components/design/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type AppealsFilterCard = {
  key: string;
  label: string;
  filter: string;
  count: number;
};

function filterGridClass(roleKey: string, cardCount: number) {
  if (roleKey === "agent" || roleKey === "tech_agent") {
    return "grid grid-cols-2 gap-2 sm:grid-cols-4";
  }
  if (cardCount <= 4) {
    return "grid grid-cols-2 gap-2 lg:grid-cols-4";
  }
  return "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";
}

export function AppealsFilterCards({ activeFilter }: { activeFilter: string }) {
  const { effective } = useAuth();
  const roleKey = effective?.roleKey ?? "";
  const query = useQuery({
    queryKey: ["qa-appeals-filters"],
    queryFn: () => api<{ filters: AppealsFilterCard[] }>("/api/qa/appeals/filters"),
  });

  const cards = query.data?.filters ?? [];
  if (!cards.length && !query.isLoading) return null;

  const description =
    roleKey === "senior_agent"
      ? "Narrow the list by status. Escalated appeals are view-only until a supervisor decides."
      : "Narrow the list by status. Counts reflect appeals you can access.";

  return (
    <section>
      <SectionHeader title="Filter appeals" description={description} />
      <div className={filterGridClass(roleKey, cards.length)}>
        {cards.map((card) => {
          const href = card.filter ? `/qa/appeals?filter=${encodeURIComponent(card.filter)}` : "/qa/appeals";
          const active = activeFilter === card.filter;
          return (
            <Link
              key={card.key}
              to={href}
              className={cn(
                "rounded-lg border px-3 py-2.5 shadow-[var(--shadow-card)] transition-colors",
                active
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-card hover:bg-muted/40",
              )}
              aria-current={active ? "true" : undefined}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{card.count}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
