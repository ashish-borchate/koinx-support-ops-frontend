import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/format";
import type { PeriodPreset } from "./types";
import { PERIOD_PRESETS } from "./types";

type Props = {
  mode: "team" | "agent";
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  periodLabel: string | null;
  periodStartIst?: string;
  periodEndIst?: string;
  customFrom: string;
  customTo: string;
  onOpenCustomRange: () => void;
  agents?: { id: string; name: string }[];
  selectedAgentId?: string;
  onAgentChange?: (id: string) => void;
  agentName?: string;
  showAgentSelector?: boolean;
  showTeamButton?: boolean;
  onBackToTeam?: () => void;
  isPeriodUpdating?: boolean;
};

export function PerformanceToolbar({
  mode,
  preset,
  onPresetChange,
  periodLabel,
  periodStartIst,
  periodEndIst,
  customFrom,
  customTo,
  onOpenCustomRange,
  agents,
  selectedAgentId,
  onAgentChange,
  agentName,
  showAgentSelector = true,
  showTeamButton,
  onBackToTeam,
  isPeriodUpdating,
}: Props) {
  const presetLabel = PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? preset;
  const rangeBadge =
    periodLabel ??
    (periodStartIst && periodEndIst
      ? `${formatCalendarDate(periodStartIst)} – ${formatCalendarDate(periodEndIst)}`
      : preset === "custom" && customFrom && customTo
        ? `${customFrom} – ${customTo}`
        : presetLabel);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card/60 p-3 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap sm:items-center",
        mode === "agent" && "sm:justify-between",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        {mode === "agent" ? (
          <>
            {showAgentSelector && agents?.length && onAgentChange && selectedAgentId ? (
              <Select value={selectedAgentId} onValueChange={onAgentChange}>
                <SelectTrigger className="h-9 w-full min-w-[180px] max-w-[240px]">
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : agentName ? (
              <p className="text-sm font-semibold text-foreground">{agentName}</p>
            ) : null}
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          </>
        ) : (
          <p className="text-sm font-semibold text-foreground">Team overview</p>
        )}

        <Select
          value={preset}
          onValueChange={(v) => {
            const next = v as PeriodPreset;
            onPresetChange(next);
            if (next === "custom") onOpenCustomRange();
          }}
        >
          <SelectTrigger className="h-9 w-[148px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {preset === "custom" ? (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onOpenCustomRange}>
            {customFrom && customTo ? `${customFrom} – ${customTo}` : "Choose dates"}
          </Button>
        ) : null}

        {rangeBadge ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            <span className="truncate">{rangeBadge}</span>
            {isPeriodUpdating ? <span className="shrink-0 text-[10px] uppercase tracking-wide">Updating…</span> : null}
          </span>
        ) : null}
      </div>

      {showTeamButton && onBackToTeam ? (
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={onBackToTeam}>
          Team overview
        </Button>
      ) : null}
    </div>
  );
}
