import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HandbookCallout = {
  n: number;
  x: number;
  y: number;
  label: string;
};

type HandbookFigureProps = {
  src?: string | null;
  alt: string;
  caption?: string;
  callouts?: HandbookCallout[];
  pendingLabel?: string;
};

export function HandbookFigure({ src, alt, caption, callouts, pendingLabel = "Screenshot pending" }: HandbookFigureProps) {
  const showPlaceholder = !src;

  return (
    <figure className="my-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted/30",
          showPlaceholder ? "border-dashed border-muted-foreground/35" : "border-border/70",
        )}
      >
        {showPlaceholder ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <ImageIcon className="size-8 opacity-50" aria-hidden />
            <p className="font-medium text-foreground/80">{pendingLabel}</p>
            <p className="max-w-md text-xs">{alt}</p>
          </div>
        ) : (
          <>
            <img src={src} alt={alt} className="w-full object-contain" loading="lazy" />
            {callouts?.map((c) => (
              <span
                key={c.n}
                className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                title={c.label}
              >
                {c.n}
              </span>
            ))}
          </>
        )}
      </div>
      {caption ? <figcaption className="mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption> : null}
      {callouts && callouts.length > 0 ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          {callouts.map((c) => (
            <li key={c.n}>
              <span className="font-medium text-foreground/80">{c.n}.</span> {c.label}
            </li>
          ))}
        </ol>
      ) : null}
    </figure>
  );
}
