export type DurationComponents = {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

export function emptyDurationComponents(): DurationComponents {
  return { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 };
}

export function durationComponentsToHours(parts: DurationComponents): number {
  const { hours, minutes, seconds, milliseconds } = parts;
  return hours + minutes / 60 + seconds / 3600 + milliseconds / 3_600_000;
}

export function hoursToDurationComponents(hours: number): DurationComponents {
  if (!Number.isFinite(hours) || hours < 0) return emptyDurationComponents();
  const totalMs = Math.round(hours * 3_600_000);
  const milliseconds = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const seconds = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const minutes = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return { hours: h, minutes, seconds, milliseconds };
}

export function validateDurationComponents(parts: DurationComponents): string | null {
  const fields: [keyof DurationComponents, number, number][] = [
    ["hours", 0, Number.POSITIVE_INFINITY],
    ["minutes", 0, 59],
    ["seconds", 0, 59],
    ["milliseconds", 0, 999],
  ];
  for (const [key, min, max] of fields) {
    const v = parts[key];
    if (!Number.isInteger(v) || v < min || v > max) {
      return `Invalid ${key} (must be a whole number${max < Number.POSITIVE_INFINITY ? ` from ${min} to ${max}` : ` ≥ ${min}`}).`;
    }
  }
  return null;
}

const PASTE_TOKEN =
  /(\d+)\s*(h(?:ours?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?|ms|milliseconds?)\b/gi;

export function parseFreshdeskDurationPaste(input: string): DurationComponents | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Paste a duration such as 1h 43m 22s 130ms." };

  const parts = emptyDurationComponents();
  let match: RegExpExecArray | null;
  const re = new RegExp(PASTE_TOKEN.source, PASTE_TOKEN.flags);
  let found = 0;
  while ((match = re.exec(trimmed)) !== null) {
    found += 1;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isInteger(amount) || amount < 0) return { error: "Duration amounts must be non-negative whole numbers." };
    if (unit.startsWith("h")) parts.hours += amount;
    else if (unit.startsWith("m") && unit !== "ms" && !unit.startsWith("mill")) parts.minutes += amount;
    else if (unit.startsWith("s") && unit !== "ms") parts.seconds += amount;
    else if (unit === "ms" || unit.startsWith("mill")) parts.milliseconds += amount;
    else return { error: `Unrecognized unit "${match[2]}".` };
  }

  const leftover = trimmed.replace(re, "").replace(/\s+/g, "");
  if (!found || leftover.length > 0) {
    return { error: "Could not parse duration. Use formats like 1h 43m 22s 130ms or 45s." };
  }

  const validation = validateDurationComponents(parts);
  if (validation) return { error: validation };
  return parts;
}

export function formatFreshdeskDurationLabel(parts: DurationComponents): string {
  const segments: string[] = [];
  if (parts.hours) segments.push(`${parts.hours}h`);
  if (parts.minutes) segments.push(`${parts.minutes}m`);
  if (parts.seconds) segments.push(`${parts.seconds}s`);
  if (parts.milliseconds) segments.push(`${parts.milliseconds}ms`);
  if (!segments.length) return "0s";
  return segments.join(" ");
}

/** Display hours with up to 4 decimal places; trim trailing zeros. */
export function formatStoredHoursDisplay(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "";
  const fixed = hours.toFixed(4);
  return fixed.replace(/\.?0+$/, "") || "0";
}
