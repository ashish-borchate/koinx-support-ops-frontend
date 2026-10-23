export function formatVerificationResultLine(
  result: string | undefined,
  shortLabel: string,
  naReason?: string,
): string {
  if (result === "verified") return `Verified — ${shortLabel}`;
  if (result === "na") {
    const reason = naReason?.trim();
    return reason ? `N/A — ${shortLabel} (${reason})` : `N/A — ${shortLabel}`;
  }
  if (result === "unable") return `Unable to verify — ${shortLabel}`;
  return shortLabel;
}
