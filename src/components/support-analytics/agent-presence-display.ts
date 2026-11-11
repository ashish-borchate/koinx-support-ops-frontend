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
  if (normalized === "idle") return "idle";
  if (normalized === "unavailable") return "unavailable";
  if (normalized === "meeting" || normalized === "training") return "busy";
  if (normalized === "lunch" || normalized === "break") return "away";
  return "unknown";
}

const BADGE_TONE_CLASS: Record<PresenceBadgeTone, string> = {
  idle: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  away: "border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  busy: "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-200",
  unavailable: "border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200",
  mixed: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200",
  unknown: "border-border bg-muted text-muted-foreground",
};

export function presenceBadgeClassName(label: string, stale: boolean): string {
  const tone = presenceBadgeTone(label);
  const base = `inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight ${BADGE_TONE_CLASS[tone]}`;
  if (!stale) return base;
  return `${base} ring-1 ring-dashed ring-muted-foreground/40`;
}

export function presenceStaleTitle(stale: boolean): string | undefined {
  return stale ? "Presence data may be outdated" : undefined;
}
