import { CalendarRange, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCalendarDate } from "@/lib/format";

type DefinitionRow = {
  id: string;
  label: string;
  description: string;
  kind: string;
  notes?: string;
};

export function LiveReportingToolbar({
  draftFrom,
  draftTo,
  onDraftFrom,
  onDraftTo,
  onApply,
  appliedFrom,
  appliedTo,
  rangeSource,
  definitions,
}: {
  draftFrom: string;
  draftTo: string;
  onDraftFrom: (v: string) => void;
  onDraftTo: (v: string) => void;
  onApply: () => void;
  appliedFrom: string;
  appliedTo: string;
  rangeSource?: string;
  definitions?: DefinitionRow[];
}) {
  const periodLabel =
    appliedFrom && appliedTo
      ? `${formatCalendarDate(appliedFrom)} – ${formatCalendarDate(appliedTo)}`
      : "—";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-end gap-2 rounded-lg border border-border/80 bg-background px-2 py-2 sm:px-3">
            <CalendarRange className="mb-2 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
            <div className="min-w-0">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</label>
              <Input
                type="date"
                className="mt-0.5 h-9 w-full min-w-[8.5rem] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                value={draftFrom}
                onChange={(e) => onDraftFrom(e.target.value)}
              />
            </div>
            <span className="mb-2 hidden text-muted-foreground sm:inline" aria-hidden>
              –
            </span>
            <div className="min-w-0">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">To</label>
              <Input
                type="date"
                className="mt-0.5 h-9 w-full min-w-[8.5rem] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                value={draftTo}
                onChange={(e) => onDraftTo(e.target.value)}
              />
            </div>
            <span className="mb-2 text-[10px] text-muted-foreground">IST</span>
          </div>
          <Button type="button" size="sm" className="h-9 shrink-0" onClick={onApply}>
            Apply range
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-muted-foreground">
            <span className="text-xs uppercase tracking-wide">Period</span>{" "}
            <span className="font-medium text-foreground">{periodLabel}</span>
            {rangeSource === "default" ? (
              <span className="ml-1 text-xs text-muted-foreground">(default)</span>
            ) : null}
          </p>
          {definitions?.length ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  Metrics
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[min(70vh,24rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3">
                <p className="mb-2 text-sm font-medium">Metric definitions</p>
                <ul className="space-y-3 text-xs leading-relaxed">
                  {definitions.map((d) => (
                    <li key={d.id}>
                      <p className="font-medium text-foreground">
                        {d.label}{" "}
                        <span className="font-normal text-muted-foreground">({d.kind})</span>
                      </p>
                      <p className="text-muted-foreground">{d.description}</p>
                      {d.notes ? <p className="mt-1 text-muted-foreground">{d.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>
    </div>
  );
}
