/** Freshdesk groups hidden from live workload tables and explorer group lists. */
export const EXCLUDED_LIVE_GROUP_NAMES = ["voice call support"];

/** Preferred display order (matched by name patterns). */
const LIVE_GROUP_ORDER_PATTERNS: RegExp[] = [
  /^general support$/i,
  /^escalation team$/i,
  /^tech (issues?|team)$/i,
  /^refund requests?$/i,
  /^ca tax report issues$/i,
  /follow[- ]?up.*ca tax/i,
  /^agent offline/i,
];

export function rankLiveGroup(name: string): number {
  const n = name.trim();
  for (let i = 0; i < LIVE_GROUP_ORDER_PATTERNS.length; i++) {
    if (LIVE_GROUP_ORDER_PATTERNS[i].test(n)) return i;
  }
  return LIVE_GROUP_ORDER_PATTERNS.length;
}

export function isExcludedLiveGroup(name: string): boolean {
  return EXCLUDED_LIVE_GROUP_NAMES.includes(name.trim().toLowerCase());
}

export function sortLiveGroupRows<T extends { groupName: string; groupFreshdeskId: number | null }>(
  rows: T[],
): T[] {
  return rows
    .filter((g) => g.groupFreshdeskId != null && !isExcludedLiveGroup(g.groupName))
    .sort((a, b) => {
      const ra = rankLiveGroup(a.groupName);
      const rb = rankLiveGroup(b.groupName);
      if (ra !== rb) return ra - rb;
      return a.groupName.localeCompare(b.groupName);
    });
}
