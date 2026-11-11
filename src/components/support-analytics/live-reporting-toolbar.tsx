import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LiveReportingToolbar({
  draftFrom,
  draftTo,
  onDraftFrom,
  onDraftTo,
  onApply,
}: {
  draftFrom: string;
  draftTo: string;
  onDraftFrom: (v: string) => void;
  onDraftTo: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        type="date"
        aria-label="From date"
        className="h-8 w-[8.75rem] text-xs"
        value={draftFrom}
        onChange={(e) => onDraftFrom(e.target.value)}
      />
      <span className="text-xs text-muted-foreground" aria-hidden>
        –
      </span>
      <Input
        type="date"
        aria-label="To date"
        className="h-8 w-[8.75rem] text-xs"
        value={draftTo}
        onChange={(e) => onDraftTo(e.target.value)}
      />
      <Button type="button" size="sm" variant="outline" className="h-8 border-border px-3 text-xs" onClick={onApply}>
        Apply
      </Button>
    </div>
  );
}
