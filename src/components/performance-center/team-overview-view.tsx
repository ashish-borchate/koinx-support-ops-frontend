import { Empty, SectionHeader } from "@/components/bits";
import { cn } from "@/lib/utils";
import type { MetricDrillDown, TeamDashboard } from "./types";
import { fmtNum } from "./types";

export function TeamOverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-40 rounded bg-muted/50" />
      <div className="h-52 rounded-xl border bg-muted/30" />
    </div>
  );
}

function workCompletedBreakdown(row: TeamDashboard["comparison"][0]) {
  const fb = row.productFeedbackSubmitted == null ? "—" : String(row.productFeedbackSubmitted);
  return `Product Guide ${row.pgCompleted} · Product Feedback ${fb} · Reported Issues ${row.riResolved}`;
}

function attentionLabel(count: number) {
  if (count <= 0) return "Not Required";
  if (count >= 3) return "Needs follow-up";
  return "Watch";
}

type Props = {
  data: TeamDashboard;
  onSelectAgent: (agentId: string) => void;
  onOpenDetails: (agentId: string, metric: MetricDrillDown) => void;
};

export function TeamOverviewView({ data, onSelectAgent, onOpenDetails }: Props) {
  const rows = [...data.comparison].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <SectionHeader title="Agent performance" description="Period totals and follow-up status by agent." />

      {rows.length === 0 ? (
        <Empty title="No agents" body="No canonical agents found for comparison." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[1040px] table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Work completed</th>
                <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium text-right">QA</th>
                <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium text-right">KPI</th>
                <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium text-right">Overdue</th>
                <th className="w-[1%] whitespace-nowrap px-4 py-2 font-medium">Attention</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agentId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-1.5 align-middle">
                    <button
                      type="button"
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => onSelectAgent(row.agentId)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td
                    className="cursor-pointer whitespace-nowrap px-4 py-1.5 align-middle text-xs tabular-nums text-muted-foreground sm:text-sm"
                    onClick={() => onSelectAgent(row.agentId)}
                  >
                    {workCompletedBreakdown(row)}
                  </td>
                  <td className="w-[1%] cursor-default whitespace-nowrap px-3 py-1.5 text-right align-middle tabular-nums">
                    <MetricLink
                      value={fmtNum(row.qaAverage)}
                      ariaLabel={`Open QA for ${row.name}`}
                      onClick={() => onOpenDetails(row.agentId, "qa")}
                    />
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-1.5 text-right align-middle tabular-nums">
                    <MetricLink
                      value={row.kpiComposite ?? "—"}
                      ariaLabel={`Open KPI for ${row.name}`}
                      onClick={() => onOpenDetails(row.agentId, "kpi")}
                    />
                  </td>
                  <td
                    className={cn(
                      "w-[1%] cursor-pointer whitespace-nowrap px-3 py-1.5 text-right align-middle tabular-nums",
                      row.riOverdueNow > 0 && "font-medium text-destructive",
                    )}
                    onClick={() => onSelectAgent(row.agentId)}
                  >
                    {row.riOverdueNow}
                  </td>
                  <td className="w-[1%] cursor-pointer whitespace-nowrap px-4 py-1.5 align-middle" onClick={() => onSelectAgent(row.agentId)}>
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
                        row.openTeamAttention > 0
                          ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {attentionLabel(row.openTeamAttention)}
                      {row.openTeamAttention > 0 ? ` (${row.openTeamAttention})` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricLink({
  value,
  onClick,
  ariaLabel,
}: {
  value: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium tabular-nums text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
    >
      {value}
    </button>
  );
}
