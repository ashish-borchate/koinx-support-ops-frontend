import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LearningCard({
  title,
  description,
  children,
  to,
  className,
  active,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  to?: string;
  className?: string;
  active?: boolean;
}) {
  const inner = (
    <>
      <p className="line-clamp-2 font-semibold text-primary">{title}</p>
      {description ? (
        <p className="mt-1.5 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : (
        <span className="flex-1" aria-hidden />
      )}
      {children}
    </>
  );

  const classes = cn(
    "flex h-full w-full flex-col rounded-xl border bg-card px-4 py-3.5 shadow-[var(--shadow-card)] motion-safe:transition-[border-color,box-shadow]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active ? "border-primary/40 ring-1 ring-primary/15" : "border-border/70 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }

  return <div className={classes}>{inner}</div>;
}
