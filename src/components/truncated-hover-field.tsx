import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function useTruncatedHover(text: string) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ anchorTop: 0, anchorBottom: 0, left: 0, width: 0, above: true });
  const [truncated, setTruncated] = useState(false);
  const trimmed = text?.trim() || "";

  useEffect(() => {
    const el = valueRef.current;
    if (!el || !trimmed) {
      setTruncated(false);
      return;
    }
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [trimmed]);

  function placePopover() {
    const row = anchorRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 300), 400);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const above = rect.top > 120;
    setCoords({ anchorTop: rect.top, anchorBottom: rect.bottom, left, width, above });
  }

  function showTip() {
    if (!trimmed || !truncated) return;
    placePopover();
    setOpen(true);
  }

  function hideTip() {
    setOpen(false);
  }

  const showPopover = Boolean(trimmed && truncated);

  useEffect(() => {
    if (!open) return;
    placePopover();
    const onScroll = () => placePopover();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, trimmed]);

  return {
    anchorRef,
    valueRef,
    trimmed,
    open,
    showPopover,
    showTip,
    hideTip,
    coords,
  };
}

type TruncatedHoverFieldProps = {
  value: string;
  label?: string;
  popoverTitle?: string;
  /** Supported Files detail row (label left, value right). */
  variant?: "detail" | "meta" | "inline";
  className?: string;
  valueClassName?: string;
  emptyPlaceholder?: string;
};

export function TruncatedHoverField({
  value,
  label,
  popoverTitle,
  variant = "detail",
  className,
  valueClassName,
  emptyPlaceholder = "—",
}: TruncatedHoverFieldProps) {
  const title = popoverTitle || label || "Details";
  const { anchorRef, valueRef, trimmed, open, showPopover, showTip, hideTip, coords } = useTruncatedHover(value);

  const popover =
    open && showPopover
      ? createPortal(
          <div
            role="tooltip"
            style={{
              left: coords.left,
              width: coords.width,
              top: coords.above ? coords.anchorTop : coords.anchorBottom,
              transform: coords.above ? "translateY(calc(-100% - 8px))" : "translateY(8px)",
            }}
            className="fixed z-[10050] rounded-lg border-2 border-primary bg-popover px-3.5 py-2.5 text-left text-sm leading-relaxed text-popover-foreground shadow-lg"
            onMouseEnter={showTip}
            onMouseLeave={hideTip}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{title}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{trimmed}</p>
          </div>,
          document.body,
        )
      : null;

  const interactive = showPopover ? "cursor-help rounded-md hover:bg-muted/50" : "";
  const handlers = showPopover
    ? { onMouseEnter: showTip, onMouseLeave: hideTip, onFocus: showTip, onBlur: hideTip, tabIndex: 0 as const }
    : {};

  const valueNode = (
    <span
      ref={valueRef}
      className={cn(
        "block w-full min-w-0 truncate font-medium text-foreground",
        variant === "detail" && "text-right",
        variant === "meta" && "text-left",
        valueClassName,
      )}
    >
      {trimmed || emptyPlaceholder}
    </span>
  );

  let body: ReactNode;
  if (variant === "meta" && label) {
    body = (
      <div
        ref={anchorRef}
        className={cn(
          "grid min-w-0 grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)]",
          interactive,
          className,
        )}
        {...handlers}
      >
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <div className="min-w-0 overflow-hidden">{valueNode}</div>
      </div>
    );
  } else if (variant === "detail" && label) {
    body = (
      <div
        ref={anchorRef}
        className={cn("flex min-w-0 items-center justify-between gap-4 px-4 py-3", interactive, className)}
        {...handlers}
      >
        <dt className="shrink-0 text-muted-foreground">{label}</dt>
        <dd className="min-w-0 flex-1 overflow-hidden">{valueNode}</dd>
      </div>
    );
  } else {
    body = (
      <div ref={anchorRef} className={cn("min-w-0 overflow-hidden", interactive, className)} {...handlers}>
        {valueNode}
      </div>
    );
  }

  return (
    <>
      {body}
      {popover}
    </>
  );
}
