import { addDays } from "@/lib/format";

export function monthStartEnd(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** Monday = 0 … Sunday = 6 for a YYYY-MM-DD key (UTC date semantics). */
export function dayOfWeekMondayZero(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

/** Inclusive list of date keys from `from` through `to`. */
export function eachDateKey(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Monday–Sunday padded cells covering the full month grid. */
export function monthGridDateKeys(monthKey: string): string[] {
  const { start, end } = monthStartEnd(monthKey);
  const gridStart = addDays(start, -dayOfWeekMondayZero(start));
  const gridEnd = addDays(end, 6 - dayOfWeekMondayZero(end));
  return eachDateKey(gridStart, gridEnd);
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}
