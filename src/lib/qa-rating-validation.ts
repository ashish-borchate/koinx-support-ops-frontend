/** Mirrors server `isValidQaRating` in qa/rubric.ts */

export function isValidQaRating(rating: number) {
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) return false;
  return Math.abs(rating * 2 - Math.round(rating * 2)) < 1e-9;
}

export function nearestValidQaRatings(value: number): [number, number] | null {
  if (!Number.isFinite(value)) return null;
  const low = Math.floor(value * 2) / 2;
  const high = Math.ceil(value * 2) / 2;
  const clampedLow = Math.max(0, Math.min(10, low));
  const clampedHigh = Math.max(0, Math.min(10, high));
  if (clampedLow === clampedHigh) return [clampedLow, clampedHigh];
  return [clampedLow, clampedHigh];
}

export function qaRatingValidationMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "Enter a number between 0 and 10.";
  if (!isValidQaRating(n)) {
    const pair = nearestValidQaRatings(n);
    if (pair) {
      const [a, b] = pair;
      const hint = a === b ? `${a}` : `${a} or ${b}`;
      return `Ratings must be between 0 and 10 in increments of 0.5. Please enter ${hint}.`;
    }
    return "Ratings must be between 0 and 10 in increments of 0.5.";
  }
  return null;
}
