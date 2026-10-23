export const QA_RUBRIC_LEGACY = "LEGACY_FIVE_20";
export const QA_RUBRIC_KOINX_V1 = "KOINX_QA_V1";

export type QaCriterionMeta = {
  key: string;
  label: string;
  maxScore: number;
  description?: string;
};

export const QA_RATING_OPTIONS: string[] = [];
for (let i = 0; i <= 20; i++) {
  QA_RATING_OPTIONS.push(String(i / 2));
}

export const QA_COMMON_RATING_GUIDE = [
  "10 — All applicable expectations met.",
  "9.5 — Negligible omission without meaningful impact.",
  "9 — Minor identifiable gap or proactively corrected mistake.",
  "8.5 — Small quality issue; overall handling correct.",
  "8 — Noticeable but low-impact mistake.",
  "7.5 — Moderate gap with limited impact.",
  "7 — Moderate mistake causing avoidable effort or confusion.",
  "6.5 — Important step missed, but most handling correct.",
  "6 — Significant gap affecting handling or progression.",
  "5.5 — Multiple important gaps or incomplete handling.",
  "5 — Major part of expected handling missed.",
  "4.5 — Substantial failure, with some useful work completed.",
  "4 — Major failure affecting outcome or workflow.",
  "3.5 — Serious failure with limited correct handling.",
  "3 — Most applicable expectations not met.",
  "2.5 — Minimal effective handling.",
  "2 — Serious error with significant risk or impact.",
  "1.5 — Almost entirely incorrect or ineffective handling.",
  "1 — Essentially no meaningful compliance.",
  "0.5 — Near-total failure.",
  "0 — Complete failure of the evaluated criterion.",
];

export const QA_CRITERION_EXAMPLES: Record<string, string[]> = {
  solution_accuracy: [
    "Correct product explanation and guidance → high rating",
    "Minor missing detail → small deduction",
    "Incorrect explanation of acquisition history or tax settings → larger deduction",
    "Materially wrong guidance left uncorrected → severe deduction",
  ],
  investigation_sop: [
    "Appropriate primary checks completed → high rating",
    "Minor diagnostic step missed → small deduction",
    "Unnecessary escalation without completing L1 checks → significant deduction",
    "No meaningful investigation → severe deduction",
  ],
  communication: [
    "Clear, empathetic, professional → high rating",
    "Slightly generic response → minor deduction",
    "Dismissive or argumentative tone → substantial deduction",
    "Abusive or discriminatory communication → severe deduction",
  ],
  case_management: [
    "Correct routing, notes, tagging, and follow-up → high rating",
    "Minor tagging error → small deduction",
    "Missing required handover or follow-up → significant deduction",
    "Serious workflow breakdown → severe deduction",
  ],
};

export function isKoinxRubric(version?: string) {
  return version === QA_RUBRIC_KOINX_V1;
}

export function weightedPointsFromRating(rating: number, maxScore: number) {
  return Math.round((rating / 10) * maxScore * 100) / 100;
}

export function ratingFromCriterion(criterion: { score: number; maxScore: number; rating?: number | null }) {
  if (criterion.rating != null && Number.isFinite(criterion.rating)) return criterion.rating;
  if (!criterion.maxScore) return 0;
  return Math.round((criterion.score / criterion.maxScore) * 10 * 100) / 100;
}

export function formatQaTotal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Score used for KPI and agent-facing QA (after approved appeal adjustments). */
export function effectiveQaScore(review: { overallScore: number; effectiveOverallScore?: number | null }) {
  return review.effectiveOverallScore ?? review.overallScore;
}

export function qaScoreAdjusted(review: { overallScore: number; effectiveOverallScore?: number | null }) {
  return review.effectiveOverallScore != null && review.effectiveOverallScore !== review.overallScore;
}
