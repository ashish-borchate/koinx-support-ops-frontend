import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingBlock, ErrorBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import {
  HistoricalCountCard,
  HistoricalCsatCard,
  HistoricalDurationInline,
  type CsatMetricUi,
  type DurationMetricUi,
} from "@/components/support-analytics/historical-metric-card";

type DaySummary = {
  dateIst: string;
  netChange: number;
  created: { count: number; firstResponseTime: DurationMetricUi };
  resolved: { count: number; resolutionTime: DurationMetricUi; csat: CsatMetricUi };
};

export function HistoricalDayDetailDialog({
  dateIst,
  open,
  onOpenChange,
  onExploreCreated,
  onExploreResolved,
}: {
  dateIst: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExploreCreated: (date: string) => void;
  onExploreResolved: (date: string) => void;
}) {
  const summary = useQuery({
    queryKey: ["support-analytics", "historical-day", dateIst],
    enabled: open && dateIst != null,
    staleTime: STALE.operational,
    queryFn: () => api<DaySummary>(`/api/support-analytics/historical/day?dateIst=${dateIst}`),
  });

  const d = summary.data;
  const empty = d && d.created.count === 0 && d.resolved.count === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dateIst ? formatCalendarDate(dateIst) : "Day"} (IST)
          </DialogTitle>
        </DialogHeader>
        {summary.isLoading ? <LoadingBlock label="Loading day summary…" /> : null}
        {summary.isError ? <ErrorBlock message="Could not load this day." /> : null}
        {d ? (
          <div className="space-y-4">
            {empty ? (
              <p className="text-sm text-muted-foreground">No tickets created or resolved on this date.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <HistoricalCountCard label="Created" value={d.created.count} onClick={() => onExploreCreated(d.dateIst)} />
                  <HistoricalCountCard label="Resolved" value={d.resolved.count} onClick={() => onExploreResolved(d.dateIst)} />
                  <HistoricalCountCard
                    label="Net"
                    value={d.netChange}
                    tone={d.netChange > 0 ? "negative" : d.netChange < 0 ? "positive" : "neutral"}
                    hint="Created minus resolved for this IST date only."
                  />
                </div>
                <HistoricalDurationInline
                  label="First response (created that day)"
                  metric={d.created.firstResponseTime}
                />
                <HistoricalDurationInline
                  label="Resolution time (resolved that day)"
                  metric={d.resolved.resolutionTime}
                />
                <HistoricalCsatCard csat={d.resolved.csat} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={d.created.count === 0} onClick={() => onExploreCreated(d.dateIst)}>
                    View tickets created
                  </Button>
                  <Button size="sm" variant="outline" disabled={d.resolved.count === 0} onClick={() => onExploreResolved(d.dateIst)}>
                    View tickets resolved
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
