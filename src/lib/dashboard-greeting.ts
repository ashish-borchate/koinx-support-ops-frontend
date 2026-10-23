/** First token of display name (canonical users are full names, not hardcoded). */
export function firstNameFromFullName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || trimmed;
}

/** Current hour 0–23 in Asia/Kolkata, independent of device timezone. */
export function currentHourIst(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(hour);
}

export function istDashboardGreetingLine(firstName: string, date = new Date()): string {
  const name = firstName.trim() || "there";
  const hour = currentHourIst(date);
  if (hour >= 5 && hour <= 11) return `Good morning, ${name}`;
  if (hour >= 12 && hour <= 16) return `Good afternoon, ${name}`;
  if (hour >= 17 && hour <= 21) return `Good evening, ${name}`;
  return `Working late, ${name}?`;
}

export const DASHBOARD_GREETING_SUBTEXT = "Here's what needs your attention.";
