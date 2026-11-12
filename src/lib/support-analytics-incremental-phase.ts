export type TicketIncrementalPhase = "" | "initial" | "catchup";

export function normalizeTicketIncrementalPhase(raw: unknown): TicketIncrementalPhase {
  const p = typeof raw === "string" ? raw.trim() : "";
  if (p === "initial" || p === "catchup") return p;
  return "";
}

/** Subtle Live Sync banner when a multi-run window is open. */
export function incrementalPhaseProgressLabel(phase: TicketIncrementalPhase): string | null {
  switch (phase) {
    case "initial":
      return "Initial pass in progress";
    case "catchup":
      return "Catch-up pass in progress";
    default:
      return null;
  }
}

/** Sync History / last-run row label; null when field absent or idle. */
export function incrementalPhaseRunHistoryLabel(raw: unknown): string | null {
  const phase = normalizeTicketIncrementalPhase(raw);
  switch (phase) {
    case "initial":
      return "Initial";
    case "catchup":
      return "Catch-up";
    default:
      return null;
  }
}
