import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMonth, monthKey } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  value: string;
  onChange: (monthKey: string) => void;
  onClose: () => void;
};

export function MonthYearPicker({ value, onChange, onClose }: Props) {
  const [year, monthNum] = value.split("-").map(Number);

  const setYear = (y: number) => {
    onChange(`${y}-${String(monthNum).padStart(2, "0")}`);
  };

  const pickMonth = (m: number) => {
    onChange(`${year}-${String(m).padStart(2, "0")}`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(year - 1)} aria-label="Previous year">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(year + 1)} aria-label="Next year">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MONTHS.map((label, index) => {
          const m = index + 1;
          const key = `${year}-${String(m).padStart(2, "0")}`;
          const selected = key === value;
          const isCurrent = key === monthKey();
          return (
            <button
              key={key}
              type="button"
              onClick={() => pickMonth(m)}
              className={cn(
                "rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border/80 bg-muted/30 text-muted-foreground hover:bg-muted/50",
                isCurrent && !selected && "ring-1 ring-primary/40",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            onChange(monthKey());
            onClose();
          }}
        >
          Current month
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}

export function MonthYearPickerTitle({ value }: { value: string }) {
  return <span>{formatMonth(value)}</span>;
}
