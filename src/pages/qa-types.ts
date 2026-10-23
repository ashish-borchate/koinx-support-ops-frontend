export type QaRandomAuditOutcome = "accurate" | "minor_issue" | "major_issue";

export type QaRandomAuditWorkflow = "not_required" | "awaiting_ack" | "acknowledged" | "disagreed";

export type QaRandomAuditSummary = {
  id: string;
  outcome: QaRandomAuditOutcome;
  outcomeLabel: string;
};

export type QaRandomAuditDetail = QaRandomAuditSummary & {
  qaReviewId: string;
  ticketRef: string;
  ticketSubject: string;
  agentId: string;
  agentName: string;
  qaReviewerId: string;
  qaReviewerName: string;
  originalQaScore: number;
  auditedById: string;
  auditedByName: string;
  auditedAt: string;
  feedback: string;
  scoreCorrectionRequired: boolean;
  correctionExplanation: string;
  reviewerWorkflowStatus: QaRandomAuditWorkflow;
  workflowStatusLabel: string;
  isActive: boolean;
  acknowledgedById?: string | null;
  acknowledgedByName?: string | null;
  acknowledgedAt?: string | Date | null;
  disagreedById?: string | null;
  disagreedByName?: string | null;
  disagreedAt?: string | Date | null;
  disagreementText?: string;
  revertedAt?: string | Date | null;
  revertedByName?: string | null;
  revertReason?: string;
  updatedAt?: string | Date;
  href: string;
  canAcknowledgeRandomAudit?: boolean;
  canDisagreeRandomAudit?: boolean;
  canEditRandomAudit?: boolean;
  canRevertRandomAudit?: boolean;
};

export type QaMode = "agent_qa" | "senior_agent_qa";

export type Review = {
  id: string;
  qaMode?: QaMode;
  agentId: string;
  agentName: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRoleKey?: string;
  ticketRef: string;
  ticketSubject: string;
  queryCategory?: string;
  ticketDate?: string;
  reviewedAt: string;
  coachingRequired?: boolean;
  rubricVersion?: string;
  overallScore: number;
  effectiveOverallScore?: number;
  acknowledgementStatus?: "not_required" | "pending" | "acknowledged";
  acknowledgedAt?: string | null;
  createdAt?: string;
  summary: string;
  criteria: {
    key: string;
    label: string;
    score: number;
    maxScore: number;
    rating?: number | null;
    comment: string;
  }[];
  criticalError?: {
    flagged: boolean;
    category?: string;
    categoryLabel?: string;
    description?: string;
    supervisorAcknowledgedAt?: string | null;
    supervisorAcknowledgedByName?: string;
    supervisorAckResolutionNote?: string;
  };
  coachingItems: { id?: string; text: string; status: "open" | "done"; dueDate: string }[];
  linkedCoaching?: { id: string; status: string; href: string } | null;
  supervisorValidatedAt?: string | null;
  supervisorRandomAuditAt?: string | null;
  randomAudit?: QaRandomAuditSummary | QaRandomAuditDetail | null;
  legacyRandomAuditOnly?: boolean;
  canPerformRandomAudit?: boolean;
};
