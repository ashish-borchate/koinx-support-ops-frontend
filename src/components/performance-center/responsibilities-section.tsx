import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/bits";
import { cn } from "@/lib/utils";
import type { AgentDashboard } from "./types";

type CardTone = "neutral" | "attention" | "urgent";

function cardTone(count: number, urgentWhenPositive: boolean): CardTone {
  if (count <= 0) return "neutral";
  return urgentWhenPositive ? "urgent" : "attention";
}

function edgeClass(tone: CardTone) {
  switch (tone) {
    case "urgent":
      return "border-l-destructive";
    case "attention":
      return "border-l-amber-500";
    default:
      return "border-l-transparent";
  }
}

type ResponsibilityCard = {
  key: string;
  title: string;
  count: number | string;
  subtitle?: string;
  tone: CardTone;
  href?: string;
};

type Props = {
  data: AgentDashboard;
};

export function ResponsibilitiesSection({ data }: Props) {
  const d = data;
  const cards: ResponsibilityCard[] = [
    {
      key: "pg",
      title: "Missed Product Guide reviews",
      count: d.productGuides.missedRequiredReviews,
      tone: cardTone(d.productGuides.missedRequiredReviews, false),
      href: "/product-guides/daily-review",
    },
    {
      key: "ri",
      title: "Overdue Reported Issues",
      count: d.overview.current.reportedIssuesOverdue,
      tone: cardTone(d.overview.current.reportedIssuesOverdue, true),
      href: d.reportedIssues.current.items.find((i) => i.overdue)?.href ?? "/reported-issues",
    },
  ];

  if (d.qa.available === true) {
    cards.push({
      key: "qa",
      title: "Pending QA acknowledgements",
      count: d.qa.pending.acknowledgements,
      tone: cardTone(d.qa.pending.acknowledgements, false),
      href: "/qa",
    });
  }

  if (d.coaching.available === true) {
    const open = d.coaching.current.openCount;
    const overdue = d.coaching.current.overdueCount;
    cards.push({
      key: "coach",
      title: "Coaching follow-ups",
      count: open,
      subtitle: `${open} open · ${overdue} overdue`,
      tone: overdue > 0 ? "urgent" : open > 0 ? "attention" : "neutral",
      href: d.coaching.current.items[0]?.href ?? "/coaching",
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Activity task deadline"
        description="Current outstanding obligations — not period totals."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <ResponsibilityCard key={card.key} card={card} />
        ))}
      </div>

      {d.reportedIssues.current.items.length > 0 ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open assigned issues</p>
          <ul className="divide-y rounded-xl border bg-card">
            {d.reportedIssues.current.items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40",
                    item.overdue && "border-l-2 border-l-destructive pl-[10px]",
                  )}
                >
                  <span className={cn("min-w-0 flex-1", item.overdue && "font-medium text-destructive")}>
                    {item.title}
                    <span className="block text-xs font-normal text-muted-foreground">
                      Due {item.effectiveFollowUpDateIst || "—"} · {item.status}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ResponsibilityCard({ card }: { card: ResponsibilityCard }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{card.title}</p>
        {card.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{card.subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "text-xl font-semibold tabular-nums",
            card.tone === "urgent" && "text-destructive",
            card.tone === "attention" && "text-amber-800 dark:text-amber-200",
            card.tone === "neutral" && "text-foreground",
          )}
        >
          {card.count}
        </span>
        {card.href ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-xl border border-l-[3px] bg-card px-3 py-3 text-left shadow-[var(--shadow-card)] transition-colors",
    edgeClass(card.tone),
    card.href && "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  if (card.href) {
    return (
      <Link to={card.href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
