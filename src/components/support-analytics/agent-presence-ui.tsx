import {
  buildPresenceSinceLines,
  PRESENCE_TONE_SURFACE,
  presenceBadgeTone,
  presenceStaleTitle,
  type AgentPresencePublic,
} from "@/components/support-analytics/agent-presence-display";

/** Pill matching reporting-period date range cells (`rounded-lg border … px-3 py-1.5`). */
export function AgentPresencePill({ presence }: { presence: AgentPresencePublic | undefined }) {
  if (!presence) return null;

  const sinceLines = buildPresenceSinceLines(presence);

  if (presence.label === "Mixed") {
    return (
      <div className="flex max-w-full flex-wrap gap-1.5">
        <PresenceStatusPill
          label={presence.label}
          detail={null}
          stale={presence.stale}
          tone={presenceBadgeTone(presence.label)}
        />
        {sinceLines.map((line) => {
          if (!line.text) return null;
          return (
            <PresenceStatusPill
              key={`${line.channelLabel}:${line.text}`}
              label={line.channelLabel ? `${line.channelLabel}` : line.statusName}
              detail={line.text}
              stale={presence.stale}
              tone={presenceBadgeTone(line.statusName)}
              compact
            />
          );
        })}
      </div>
    );
  }

  const primary = sinceLines[0];
  const detail = primary?.text ?? presence.label;

  return (
    <PresenceStatusPill
      label={presence.label}
      detail={primary?.text ? primary.text : null}
      stale={presence.stale}
      tone={presenceBadgeTone(presence.label)}
      title={detail}
    />
  );
}

function PresenceStatusPill({
  label,
  detail,
  stale,
  tone,
  compact,
  title,
}: {
  label: string;
  detail: string | null;
  stale: boolean;
  tone: ReturnType<typeof presenceBadgeTone>;
  compact?: boolean;
  title?: string;
}) {
  const toneBorder: Record<typeof tone, string> = {
    idle: PRESENCE_TONE_SURFACE.idle,
    away: PRESENCE_TONE_SURFACE.away,
    busy: PRESENCE_TONE_SURFACE.busy,
    unavailable: PRESENCE_TONE_SURFACE.unavailable,
    mixed: PRESENCE_TONE_SURFACE.mixed,
    unknown: PRESENCE_TONE_SURFACE.unknown,
  };

  const text = detail ?? label;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-lg border px-3 py-1.5 text-xs font-medium leading-snug tabular-nums ${toneBorder[tone]} ${
        stale ? "ring-1 ring-dashed ring-muted-foreground/35" : ""
      } ${compact ? "px-2 py-1" : ""}`}
      title={stale ? presenceStaleTitle(true) : title}
    >
      <span className="truncate">{text}</span>
    </span>
  );
}

/** @deprecated use AgentPresencePill in workload rows */
export function AgentPresenceBlock({ presence }: { presence: AgentPresencePublic | undefined }) {
  return (
    <div className="mt-0.5">
      <AgentPresencePill presence={presence} />
    </div>
  );
}
