export type PeriodPreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export type MetricDrillDown =
  | "pg-reviews"
  | "pg-compliance"
  | "feedback"
  | "ri-resolved"
  | "qa"
  | "kpi";

export type KpiScoreMetricRow = {
  id: string;
  label: string;
  actualLabel: string;
  pointsDisplay: string;
  weight: number;
};

export type KpiScorecard = {
  scoringConfigured: boolean;
  compositeDisplay: string;
  compositeScore: number | null;
  statusMessage: string | null;
  metrics: KpiScoreMetricRow[];
};

export type AgentDashboard = {
  agent: { id: string; name: string; active: boolean };
  period: { preset: string; startIst: string; endIst: string; label: string };
  overview: {
    eligibleWorkingDays: number;
    productGuideReviewsCompleted: number;
    productGuideCompliancePercent: number | null;
    productFeedbackSubmitted: number | null;
    reportedIssuesResolved: number;
    qaAverageScore: number | null;
    qaReviewCount: number | null;
    kpiComposite: string | null;
    current: {
      reportedIssuesOverdue: number;
      reportedIssuesOpen: number;
      qaAckPending: number | null;
      coachingOpen: number | null;
      coachingOverdue: number | null;
    };
  };
  productGuides: {
    eligibleWorkingDays: number;
    completedRequiredReviews: number;
    missedRequiredReviews: number;
    compliancePercent: number | null;
    weeklyOffConfigured?: boolean;
    dailyHistory: { dateIst: string; required: boolean; completed: boolean; voluntaryOnly: boolean }[];
    submissions: {
      id: string;
      guideTitle: string;
      reviewDateIst: string;
      hasIssues: boolean;
      voluntary: boolean;
      href: string;
    }[];
  };
  reportedIssues: {
    current: {
      items: {
        id: string;
        title: string;
        status: string;
        effectiveFollowUpDateIst: string;
        overdue: boolean;
        href: string;
      }[];
    };
    period: {
      resolvedCount: number;
      resolved: {
        id: string;
        title: string;
        resolvedAt: string | null;
        href: string;
      }[];
    };
  };
  qa:
    | { available: false; reason?: string }
    | {
        available: true;
        reviewCount: number;
        averageScore: number | null;
        reviews: {
          id: string;
          ticketRef: string;
          reviewedAt: string;
          overallScore: number;
          acknowledgementStatus?: string;
          reviewerName?: string | null;
          href: string;
        }[];
        appeals: {
          items: { id: string; status: string; submittedAt: string; href: string }[];
        };
        pending: { acknowledgements: number };
      };
  productFeedback:
    | { available: false }
    | {
        available: true;
        items: {
          id: string;
          category: string;
          supervisorReview: string;
          createdAt: string;
          href: string;
        }[];
      };
  coaching:
    | { available: false }
    | {
        available: true;
        current: {
          openCount: number;
          overdueCount: number;
          items: { id: string; status: string; dueAt: string | null; overdue: boolean; href: string }[];
        };
      };
  kpi: {
    grain: "weekly" | "monthly" | "none";
    periodKey: string | null;
    scorecard: KpiScorecard | null;
    note?: string;
  };
  timeline: {
    events: {
      id: string;
      kind: string;
      label: string;
      description: string;
      occurredAt: string;
      occurredAtIst?: string;
      href: string | null;
    }[];
  };
  permissions?: { qa: boolean; coaching: boolean; productFeedback: boolean };
};

export type TeamDashboard = {
  period: { preset?: string; label: string; startIst: string; endIst: string };
  overview: Record<string, number | string | boolean | null>;
  comparison: {
    agentId: string;
    name: string;
    eligibleWorkingDays: number;
    pgCompleted: number;
    pgCompliancePercent: number | null;
    riResolved: number;
    riOverdueNow: number;
    productFeedbackSubmitted: number | null;
    qaAverage: number | null;
    kpiComposite: string | null;
    coachingPending: number | null;
    openTeamAttention: number;
  }[];
};

export type ConcernRow = {
  id: string;
  agentId: string;
  agentName: string;
  category: string;
  concernType: string;
  description: string;
  priority: string;
  firstDetectedAt: string | null;
  deadlineIst: string | null;
  deadlineAt?: string | null;
  destinationUrl: string;
};

export function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return String(v);
}

export function fmtPercent(v: number | null) {
  if (v == null) return "—";
  return `${v}%`;
}
