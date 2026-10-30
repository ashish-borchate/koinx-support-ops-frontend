import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { METRIC_TABS } from "./constants";
import { MetricDetailContent } from "./metric-detail-content";
import type { AgentDashboard, MetricDrillDown } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricDrillDown;
  onMetricChange: (metric: MetricDrillDown) => void;
  data: AgentDashboard | undefined;
  isLoading: boolean;
  isFetching: boolean;
};

export function PerformanceDetailsDialog({
  open,
  onOpenChange,
  metric,
  onMetricChange,
  data,
  isLoading,
  isFetching,
}: Props) {
  const agentName = data?.agent.name ?? "Agent";
  const periodLabel = data?.period.label ?? "Reporting period";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(92dvh,880px)] w-[min(96vw,1280px)] max-w-none flex-col gap-0 overflow-hidden p-0",
          "top-[50%] sm:max-w-[min(96vw,1280px)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">Performance details</DialogTitle>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{agentName}</p>
            <p>{periodLabel}</p>
          </div>
        </DialogHeader>

        <div className="shrink-0 border-b bg-muted/20 px-3 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {METRIC_TABS.map((tab) => {
              const selected = tab.id === metric;
              const disabled =
                tab.id === "feedback" && data && data.overview.productFeedbackSubmitted == null
                  ? true
                  : tab.id === "qa" && data && data.qa.available !== true
                    ? true
                    : false;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onMetricChange(tab.id)}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors sm:text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary/40 bg-primary/10 font-medium text-foreground shadow-sm"
                      : "border-transparent bg-card hover:bg-muted/50",
                    disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span className="block font-medium whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isFetching ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary/20">
              <div className="h-full w-1/3 animate-pulse bg-primary/60" />
            </div>
          ) : null}
          {isLoading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading details…
            </div>
          ) : data ? (
            <MetricDetailContent metric={metric} data={data} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Unable to load performance details.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
