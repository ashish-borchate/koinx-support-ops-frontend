import { Info } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  /** Full explanation shown in the popover (also used for accessible name). */
  label: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

const HOVER_CLOSE_MS = 150;

/**
 * Accessible help control: hover (desktop), click/tap, and keyboard focus.
 * Content is portaled above cards (z-index 100) with collision padding.
 */
export function InfoTip({ label, className, side = "top" }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentId = useId();

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  }, [cancelClose]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            open && "bg-muted text-foreground",
            className,
          )}
          aria-label={label}
          aria-expanded={open}
          aria-controls={contentId}
          aria-describedby={open ? contentId : undefined}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onBlur={scheduleClose}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={contentId}
        role="tooltip"
        side={side}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-sm leading-relaxed text-popover-foreground">{label}</p>
      </PopoverContent>
    </Popover>
  );
}
