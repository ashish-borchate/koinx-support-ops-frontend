import {
  buildPresenceSinceLines,
  presenceBadgeClassName,
  presenceStaleTitle,
  type AgentPresencePublic,
} from "@/components/support-analytics/agent-presence-display";

export function AgentPresenceBlock({ presence }: { presence: AgentPresencePublic | undefined }) {
  if (!presence) return null;

  const sinceLines = buildPresenceSinceLines(presence);
  const showMixedDetail = presence.label === "Mixed";

  return (
    <div className="mt-0.5 flex max-w-full flex-col gap-0.5">
      <span
        className={presenceBadgeClassName(presence.label, presence.stale)}
        title={presenceStaleTitle(presence.stale)}
      >
        {presence.label}
        {presence.stale ? <span className="sr-only"> (stale)</span> : null}
      </span>
      {sinceLines.map((line) => {
        if (!line.text) return null;
        const key = `${line.channelLabel ?? ""}:${line.statusName}:${line.text}`;
        return (
          <p key={key} className="text-[10px] leading-snug text-muted-foreground">
            {showMixedDetail && line.channelLabel ? (
              <>
                <span className="text-foreground/70">{line.channelLabel}</span>
                <span aria-hidden> · </span>
              </>
            ) : null}
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
