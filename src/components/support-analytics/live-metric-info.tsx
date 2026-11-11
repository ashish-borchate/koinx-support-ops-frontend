import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MouseEvent, PointerEvent } from "react";

export type LiveMetricDefinition = {
  label: string;
  description: string;
  kind?: string;
  notes?: string;
};

export function LiveMetricInfoButton({
  definition,
  className,
}: {
  definition: LiveMetricDefinition;
  className?: string;
}) {
  function stopBubble(e: MouseEvent | PointerEvent) {
    e.stopPropagation();
  }

  const hoverSummary = `${definition.description}${definition.notes ? ` ${definition.notes}` : ""}`.slice(0, 280);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex shrink-0 rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
          aria-label={`About ${definition.label}`}
          title={hoverSummary}
          onPointerDown={stopBubble}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="z-[400] max-w-sm space-y-2 text-xs leading-relaxed"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="font-medium text-foreground">
          {definition.label}
          {definition.kind ? (
            <span className="font-normal text-muted-foreground"> ({definition.kind})</span>
          ) : null}
        </p>
        <p className="text-muted-foreground">{definition.description}</p>
        {definition.notes ? (
          <p className="border-t border-border pt-2 text-muted-foreground">{definition.notes}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
