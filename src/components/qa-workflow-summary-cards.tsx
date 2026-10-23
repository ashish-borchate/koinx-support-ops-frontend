import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader } from "@/components/design/page-header";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type QaWorkflowCounter = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export function QaWorkflowSummaryCards({ counters }: { counters: QaWorkflowCounter[] | null | undefined }) {
  const visible = counters?.filter((card) => card.count > 0) ?? [];
  if (!visible.length) return null;
  return (
    <section>
      <SectionHeader title="QA actions" description="Acknowledgements, appeals, and review queues." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <Link
            key={card.key}
            to={card.href}
            className={cn(
              "rounded-lg border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)] transition-colors hover:bg-muted/40",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.count}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function useQaWorkflowSummary() {
  return useQuery({
    queryKey: ["qa-workflow-summary"],
    queryFn: () => api<{ counters: QaWorkflowCounter[] | null }>("/api/qa/workflow-summary"),
  });
}
