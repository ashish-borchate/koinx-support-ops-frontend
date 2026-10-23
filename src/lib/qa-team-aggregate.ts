/** Mirrors server `teamQaAverageFromAgentReviews` — keep logic aligned with qa-snapshot.ts */

export type QaReviewScoreRow = {
  agentId: string;
  overallScore: number;
  effectiveOverallScore?: number | null;
};

function scoreForKpi(review: { overallScore: number; effectiveOverallScore?: number | null }) {
  return review.effectiveOverallScore ?? review.overallScore;
}

export function teamQaAverageFromAgentReviews(reviews: QaReviewScoreRow[]) {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const agentId = review.agentId;
    if (!agentId) continue;
    const bucket = buckets.get(agentId) || { sum: 0, count: 0 };
    bucket.sum += scoreForKpi(review);
    bucket.count += 1;
    buckets.set(agentId, bucket);
  }

  let teamSumUnrounded = 0;
  let teamAgentCount = 0;
  let reviewCount = 0;
  for (const bucket of buckets.values()) {
    teamSumUnrounded += bucket.sum / bucket.count;
    teamAgentCount += 1;
    reviewCount += bucket.count;
  }

  const teamAverage =
    teamAgentCount > 0 ? Math.round((teamSumUnrounded / teamAgentCount) * 10) / 10 : null;

  return { teamAverage, teamAgentCount, reviewCount };
}
