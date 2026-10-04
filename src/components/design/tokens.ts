/** Shared motion — respect reduced motion via CSS in index.css */
export const motionClass = "motion-safe:transition-[color,background-color,border-color,box-shadow,transform] motion-safe:duration-200 motion-safe:ease-out";

export const surfaceCard =
  "rounded-xl border border-border/50 bg-card text-card-foreground shadow-[var(--shadow-card)]";

export const surfaceInteractive =
  `${surfaceCard} motion-safe:transition-[box-shadow,border-color,transform] motion-safe:duration-200 hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)] motion-safe:hover:-translate-y-px`;
