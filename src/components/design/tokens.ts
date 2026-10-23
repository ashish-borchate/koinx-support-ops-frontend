/** Shared motion — respect reduced motion via CSS in index.css */
export const motionClass = "motion-safe:transition-[color,background-color,border-color,box-shadow,transform] motion-safe:duration-200 motion-safe:ease-out";

export const surfaceCard =
  "rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]";

/** Large list/table container — use instead of hardcoded `bg-white`. */
export const surfacePanel =
  "rounded-2xl border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]";

export const tableShell = `${surfacePanel} overflow-x-auto`;

export const surfaceInteractive =
  `${surfaceCard} motion-safe:transition-[box-shadow,border-color,transform] motion-safe:duration-200 hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)] motion-safe:hover:-translate-y-px`;

/** Dashboard module / attention section outer shell */
export const dashboardModuleShell = `${surfaceCard} overflow-hidden p-0`;

export const accordionChevron =
  "shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";

export const accordionPanelMotion =
  "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out";

/** Clickable task row on dashboard boards */
export const taskCardButton =
  "group flex w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left shadow-sm motion-safe:transition-[color,background-color,border-color,box-shadow,transform] motion-safe:duration-200 motion-safe:ease-out hover:border-primary/35 hover:bg-muted/20 hover:shadow motion-safe:hover:-translate-y-px active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

export const taskCardChevron =
  "mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:translate-x-0.5";
