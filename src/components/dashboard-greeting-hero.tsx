import { surfaceCard } from "@/components/design/tokens";
import {
  DASHBOARD_GREETING_SUBTEXT,
  firstNameFromFullName,
  istDashboardGreetingLine,
} from "@/lib/dashboard-greeting";
import { cn } from "@/lib/utils";

export function DashboardGreetingHero({ displayName }: { displayName: string }) {
  const first = firstNameFromFullName(displayName);
  const headline = istDashboardGreetingLine(first);

  return (
    <div
      className={cn(
        surfaceCard,
        "relative overflow-hidden border-primary/15 bg-gradient-to-br from-slate-100/80 via-card to-card px-6 py-6 shadow-[var(--shadow-card)] md:px-8 md:py-7 dark:from-primary/[0.06] dark:via-card",
      )}
    >
      <div
        className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/[0.12]"
        aria-hidden
      />
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem]">{headline}</h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{DASHBOARD_GREETING_SUBTEXT}</p>
      </div>
    </div>
  );
}
