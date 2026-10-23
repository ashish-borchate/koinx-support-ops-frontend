/** First subpage the user may open: dashboard when permitted, otherwise tracker. */
export function moduleHomePath(
  can: (...keys: string[]) => boolean,
  base: string,
  dashboardPerm: string,
  trackerPerm: string,
) {
  if (can(dashboardPerm)) return `${base}/dashboard`;
  if (can(trackerPerm)) return `${base}/tracker`;
  return `${base}/dashboard`;
}

export function moduleIndexSegment(
  can: (...keys: string[]) => boolean,
  dashboardPerm: string,
  trackerPerm: string,
) {
  if (can(dashboardPerm)) return "dashboard";
  if (can(trackerPerm)) return "tracker";
  return "dashboard";
}
