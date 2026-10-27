import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminHandbookSettings } from "@/handbook/hooks/useAdminHandbookSettings";

function dayLabel(n: number) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function QaDeadlineStatCards({
  appealDays,
  escalationDays,
  appealNote,
  escalationNote,
}: {
  appealDays: number;
  escalationDays: number;
  appealNote: string;
  escalationNote: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{dayLabel(appealDays)}</p>
        <p className="mt-0.5 text-xs font-semibold text-foreground">Appeal window</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{appealNote}</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{dayLabel(escalationDays)}</p>
        <p className="mt-0.5 text-xs font-semibold text-foreground">Escalation window</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{escalationNote}</p>
      </div>
    </div>
  );
}

/** Compact appeal / escalation row with clock icons (My Role handbook). */
export function QaAppealDeadlineStrip({
  appealDays,
  escalationDays,
  className,
}: {
  appealDays: number;
  escalationDays: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-t border-border/50 pt-3 text-sm leading-relaxed text-muted-foreground",
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:flex-nowrap lg:whitespace-nowrap",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>
          Appeal window: <span className="font-semibold text-foreground">{dayLabel(appealDays)}</span>
          <span className="text-muted-foreground"> (Appeal: from evaluation creation)</span>
        </span>
      </span>
      <span className="text-border" aria-hidden>|</span>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>
          Escalation window: <span className="font-semibold text-foreground">{dayLabel(escalationDays)}</span>
          <span className="text-muted-foreground"> (Escalation: from reviewer decision)</span>
        </span>
      </span>
    </div>
  );
}

function useQaDeadlineDays() {
  const { qa, qaLoading, qaError } = useAdminHandbookSettings(true);
  const c = qa.data?.config;
  return { qaLoading, qaError, appealDays: c?.appealWindowDays, escalationDays: c?.escalationWindowDays };
}

/** Live QA deadlines for Admin handbook workflow page (read-only). */
export function HandbookQaReviewDeadlines({ className }: { className?: string }) {
  const { qaLoading, qaError, appealDays, escalationDays } = useQaDeadlineDays();

  if (qaLoading) {
    return <p className="text-sm text-muted-foreground">Loading QA review deadlines…</p>;
  }
  if (qaError) {
    return <p className="text-sm text-destructive">Could not load QA review deadlines.</p>;
  }
  if (appealDays == null || escalationDays == null) {
    return <p className="text-sm text-muted-foreground">QA review deadlines are unavailable.</p>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-foreground">QA appeal &amp; escalation</h3>
      <QaDeadlineStatCards
        appealDays={appealDays}
        escalationDays={escalationDays}
        appealNote="From QA evaluation creation."
        escalationNote="From reviewer decision."
      />
    </div>
  );
}

/** Supervisor handbook — deadline strip (read-only). */
export function HandbookSupervisorQaDeadlines({
  className,
  divider = true,
}: {
  className?: string;
  divider?: boolean;
}) {
  const { qaLoading, qaError, appealDays, escalationDays } = useQaDeadlineDays();

  if (qaLoading) {
    return <p className="text-sm text-muted-foreground">Loading QA appeal and escalation windows…</p>;
  }
  if (qaError) {
    return <p className="text-sm text-destructive">Could not load QA appeal and escalation windows.</p>;
  }
  if (appealDays == null || escalationDays == null) {
    return <p className="text-sm text-muted-foreground">QA appeal and escalation windows are unavailable.</p>;
  }

  return (
    <div className={className}>
      <QaAppealDeadlineStrip
        appealDays={appealDays}
        escalationDays={escalationDays}
        className={divider ? undefined : "border-t-0 pt-0"}
      />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        When an Agent escalates an eligible appeal, review the original evaluation, the Agent&apos;s explanation and the
        reviewer&apos;s decision before resolving the case.
      </p>
    </div>
  );
}

/** Senior Agent handbook — deadline strip (read-only). */
export function HandbookSeniorAgentQaDeadlines({ className }: { className?: string }) {
  const { qaLoading, qaError, appealDays, escalationDays } = useQaDeadlineDays();

  if (qaLoading) {
    return <p className="text-sm text-muted-foreground">Loading QA deadlines…</p>;
  }
  if (qaError) {
    return <p className="text-sm text-destructive">Could not load QA deadlines.</p>;
  }
  if (appealDays == null || escalationDays == null) {
    return <p className="text-sm text-muted-foreground">QA deadlines are unavailable.</p>;
  }

  return <QaAppealDeadlineStrip appealDays={appealDays} escalationDays={escalationDays} className={className} />;
}

/** Agent handbook — deadline strip (read-only). */
export function HandbookAgentQaDeadlines({ className }: { className?: string }) {
  const { qaLoading, qaError, appealDays, escalationDays } = useQaDeadlineDays();

  if (qaLoading) {
    return <p className="text-sm text-muted-foreground">Loading QA deadlines…</p>;
  }
  if (qaError) {
    return <p className="text-sm text-destructive">Could not load QA deadlines.</p>;
  }
  if (appealDays == null || escalationDays == null) {
    return <p className="text-sm text-muted-foreground">QA deadlines are unavailable.</p>;
  }

  return <QaAppealDeadlineStrip appealDays={appealDays} escalationDays={escalationDays} className={className} />;
}

/** @deprecated Use HandbookQaReviewDeadlines on Admin role page */
export function HandbookQaWindowsPanel({ className }: { className?: string }) {
  return <HandbookQaReviewDeadlines className={className} />;
}
