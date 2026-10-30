import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DOW_LABELS } from "@/components/agent-calendar/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCalendarDate, formatMonth, istDateKey, monthKey } from "@/lib/format";
import { monthGridDateKeys, shiftMonthKey } from "@/lib/ist-calendar-grid";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

function inRange(dateKey: string, min?: string, max?: string) {
  if (min && dateKey < min) return false;
  if (max && dateKey > max) return false;
  return true;
}

export function IstDatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  id,
  className,
  placeholder = "Select date",
  "aria-label": ariaLabel = "Select date",
}: Props) {
  const [open, setOpen] = useState(false);
  const today = istDateKey();
  const [viewMonth, setViewMonth] = useState(() => (value ? value.slice(0, 7) : monthKey()));

  useEffect(() => {
    if (open) setViewMonth(value ? value.slice(0, 7) : monthKey());
  }, [open, value]);

  const monthPrefix = `${viewMonth}-`;
  const grid = useMemo(() => monthGridDateKeys(viewMonth), [viewMonth]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          id={id}
          variant="outline"
          aria-label={ariaLabel}
          aria-required={required}
          className={cn(
            "h-9 w-full justify-start gap-2 px-3 font-normal tabular-nums",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden />
          {value ? formatCalendarDate(value) : placeholder}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(100vw-2rem,18rem)] p-3" sideOffset={6}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => shiftMonthKey(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">{formatMonth(viewMonth)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => shiftMonthKey(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground">
          {DOW_LABELS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((dateKey) => {
            const inMonth = dateKey.startsWith(monthPrefix);
            const selectable = inMonth && inRange(dateKey, min, max);
            const selected = value === dateKey;
            const isToday = dateKey === today;
            return (
              <button
                key={dateKey}
                type="button"
                disabled={!selectable}
                aria-label={formatCalendarDate(dateKey)}
                aria-pressed={selected}
                onClick={() => {
                  if (!selectable) return;
                  onChange(dateKey);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !inMonth && "invisible",
                  inMonth && !selectable && "cursor-not-allowed text-muted-foreground/40",
                  inMonth && selectable && !selected && "text-foreground hover:bg-muted",
                  isToday && !selected && "ring-1 ring-primary/40",
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {Number(dateKey.slice(8, 10))}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between gap-2 border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              if (inRange(today, min, max)) {
                onChange(today);
                setViewMonth(today.slice(0, 7));
                setOpen(false);
              }
            }}
            disabled={!inRange(today, min, max)}
          >
            Today
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
