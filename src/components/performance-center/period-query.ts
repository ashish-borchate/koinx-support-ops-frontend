import type { PeriodPreset } from "./types";

export function periodQueryMatchesSelection(
  period: { preset?: string; startIst: string; endIst: string },
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
) {
  if ((period.preset || "") !== preset) return false;
  if (preset === "custom") {
    return period.startIst === customFrom && period.endIst === customTo;
  }
  return true;
}

export function buildTeamPeriodQueryString(preset: PeriodPreset, customFrom: string, customTo: string) {
  const p = new URLSearchParams({ preset, includeTrends: "0" });
  if (preset === "custom" && customFrom && customTo) {
    p.set("from", customFrom);
    p.set("to", customTo);
  }
  return p.toString();
}
