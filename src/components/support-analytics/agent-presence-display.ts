/** Freshdesk agent presence — display helpers (matches Support Analytics live/agents API). */

export type AgentPresenceChannel = {
  channel: string;
  statusId: number | null;
  statusName: string;
  available: boolean;
  loggedIn: boolean;
  currentAssignmentLoad: number | null;
  availabilityUpdatedAt: string | null;
};

export type AgentPresencePublic = {
  channels: AgentPresenceChannel[];
  label: string;
  available: boolean;
  loggedIn: boolean;
  updatedAt: string | null;
  fetchedAt: string | null;
  stale: boolean;
};

const ALL_CHANNELS_RE = /^all\s+channels$/i;

export function isAllChannelsChannel(channel: string): boolean {
  return ALL_CHANNELS_RE.test(channel.trim());
}

export function filterDisplayPresenceChannels(channels: AgentPresenceChannel[]): AgentPresenceChannel[] {
  return channels.filter((ch) => !isAllChannelsChannel(ch.channel));
}

export function formatPresenceSinceLocal(
  iso: string | null | undefined,
  options?: { timeZone?: string },
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: options?.timeZone,
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const year = pick("year");
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPeriod = pick("dayPeriod").toUpperCase();
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

/** Card subtitle timestamp — local TZ, no year: `10 Nov, 1:06 AM` */
export function formatPresenceSinceShort(
  iso: string | null | undefined,
  options?: { timeZone?: string },
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: options?.timeZone,
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPeriod = pick("dayPeriod").toUpperCase();
  return `${day} ${month}, ${hour}:${minute} ${dayPeriod}`;
}

export function formatAgentPresenceCardSubtitle(
  presence: AgentPresencePublic | undefined,
  timeZone?: string,
): string {
  if (!presence) return "";

  if (presence.label === "Mixed") {
    const lines = filterDisplayPresenceChannels(presence.channels)
      .map((ch) => {
        const since = formatPresenceSinceShort(ch.availabilityUpdatedAt, { timeZone });
        if (!since) return ch.statusName;
        return `${ch.statusName} · Since ${since}`;
      })
      .filter(Boolean);
    if (lines.length === 0) return "Mixed";
    if (lines.length === 1) return lines[0]!;
    return `Mixed · ${lines.join(" · ")}`;
  }

  const since =
    presence.label === "Unknown"
      ? null
      : formatPresenceSinceShort(presence.updatedAt, { timeZone });
  if (!since) return presence.label;
  return `${presence.label} · Since ${since}`;
}

export type PresenceSinceLine = {
  statusName: string;
  text: string | null;
  channelLabel?: string;
};

export function presenceSinceLine(statusName: string, iso: string | null | undefined, timeZone?: string): PresenceSinceLine {
  const formatted = formatPresenceSinceLocal(iso, { timeZone });
  if (!formatted) return { statusName, text: null };
  return { statusName, text: `${statusName} since ${formatted}` };
}

export function buildPresenceSinceLines(presence: AgentPresencePublic, timeZone?: string): PresenceSinceLine[] {
  if (presence.label === "Mixed") {
    return filterDisplayPresenceChannels(presence.channels).map((ch) => {
      const line = presenceSinceLine(ch.statusName, ch.availabilityUpdatedAt, timeZone);
      return { ...line, channelLabel: ch.channel };
    });
  }
  return [presenceSinceLine(presence.label, presence.updatedAt, timeZone)];
}

export type PresenceBadgeTone = "idle" | "away" | "busy" | "unavailable" | "mixed" | "unknown";

export function presenceBadgeTone(label: string): PresenceBadgeTone {
  const normalized = label.trim().toLowerCase();
  if (normalized === "mixed") return "mixed";
  if (normalized === "unknown") return "unknown";
  if (normalized === "idle" || normalized === "all channels") return "idle";
  if (normalized === "unavailable") return "unavailable";
  if (normalized === "meeting" || normalized === "training") return "busy";
  if (normalized === "lunch" || normalized === "break") return "away";
  return "unknown";
}

export const PRESENCE_TONE_SURFACE: Record<PresenceBadgeTone, string> = {
  idle: "border-emerald-500/45 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  away: "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  busy: "border-violet-500/45 bg-violet-500/10 text-violet-950 dark:text-violet-100",
  unavailable: "border-slate-500/45 bg-slate-500/12 text-slate-900 dark:text-slate-100",
  mixed: "border-sky-500/45 bg-sky-500/10 text-sky-950 dark:text-sky-100",
  unknown: "border-border bg-muted/50 text-foreground",
};

/** Agent workload card — same palette as presence pills. */
export function presenceCardClassName(presence: AgentPresencePublic | undefined): string {
  const label = presence?.label ?? "Unknown";
  const tone = presenceBadgeTone(label);
  const hoverByTone: Record<PresenceBadgeTone, string> = {
    idle: "hover:border-emerald-500/60 hover:bg-emerald-500/15",
    away: "hover:border-amber-500/60 hover:bg-amber-500/15",
    busy: "hover:border-violet-500/60 hover:bg-violet-500/15",
    unavailable: "hover:border-slate-500/55 hover:bg-slate-500/18",
    mixed: "hover:border-sky-500/60 hover:bg-sky-500/15",
    unknown: "hover:border-primary/45 hover:bg-muted/25",
  };
  return [PRESENCE_TONE_SURFACE[tone], hoverByTone[tone]].join(" ");
}

export function presenceCardSubtitleClassName(presence: AgentPresencePublic | undefined): string {
  const label = presence?.label ?? "Unknown";
  const tone = presenceBadgeTone(label);
  const subtitleTone: Record<PresenceBadgeTone, string> = {
    idle: "text-emerald-900/80 dark:text-emerald-200/90",
    away: "text-amber-900/80 dark:text-amber-200/90",
    busy: "text-violet-900/80 dark:text-violet-200/90",
    unavailable: "text-slate-800/85 dark:text-slate-200/90",
    mixed: "text-sky-900/80 dark:text-sky-200/90",
    unknown: "text-muted-foreground",
  };
  return subtitleTone[tone];
}

export function presenceBadgeClassName(label: string, stale: boolean): string {
  const tone = presenceBadgeTone(label);
  const base = `inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight ${PRESENCE_TONE_SURFACE[tone]}`;
  if (!stale) return base;
  return `${base} ring-1 ring-dashed ring-muted-foreground/40`;
}

export function presenceStaleTitle(stale: boolean): string | undefined {
  return stale ? "Presence data may be outdated" : undefined;
}
