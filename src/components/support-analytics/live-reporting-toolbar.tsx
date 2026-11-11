import { Info } from "lucide-react";
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date (IST)"
          className="h-8 w-[8.75rem] text-xs"
          value={draftFrom}
          onChange={(e) => onDraftFrom(e.target.value)}
        />
        <span className="text-xs text-muted-foreground" aria-hidden>
          –
        </span>
        <Input
          type="date"
          aria-label="To date (IST)"
          className="h-8 w-[8.75rem] text-xs"
          value={draftTo}
          onChange={(e) => onDraftTo(e.target.value)}
        />
        <span className="text-[10px] font-medium text-muted-foreground">IST</span>
        <Button type="button" size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={onApply}>
          Apply
        </Button>
      </div>

      <div className="hidden h-4 w-px bg-border sm:block" aria-hidden />

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{periodLabel}</span>
        {rangeSource === "default" ? <span className="ml-1">(default)</span> : null}
      </p>

      {definitions?.length ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 px-2 text-xs text-muted-foreground">
              <Info className="mr-1 h-3.5 w-3.5" />
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
  );
}
