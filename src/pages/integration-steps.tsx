import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  IntegrationStepsLayout,
  IntegrationStepsTabsProvider,
  IntegrationTabLink,
  useIntegrationStepsTabs,
} from "@/components/integration-steps-tabs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { FilterStat } from "@/components/filter-stat";
import { ReportIssueButton } from "@/components/report-issue-dialog";
import { DocumentationDetailCard } from "@/components/documentation-detail-card";
import { LifecycleStatusBadge, MetadataChip } from "@/components/detail-layout-bits";
import {
  integrationTitleBadge,
  integrationWasEverPublished,
  publishedMetadataBadgeClass,
} from "@/lib/record-detail-status";
import { IntegrationStepsHistoryPanel } from "@/components/integration-steps-history-panel";
import { SmartReturnReminder } from "@/components/smart-return-reminder";
import {
  externalLinkProps,
  normalizeDocumentationSource,
  resolveWorkingUrl,
  type DocumentationSource,
} from "@/lib/documentation-links";
import { IntegrationUpdateReasonFields } from "@/components/integration-update-reason-fields";
import {
  formatIntegrationUpdateReasonDisplay,
  isIntegrationUpdateReasonReadyForPublish,
  serializeIntegrationUpdateReason,
} from "@/lib/integration-update-reason";
import {
  clearIntegrationNewFormDraft,
  loadIntegrationNewFormDraft,
} from "@/lib/integration-form-draft";
import { formatPublicationTimestamp, formatWhen } from "@/lib/format";
import {
  integrationPublicationPhase,
} from "@/lib/documentation-publication";
import { defaultIntegrationWebsiteUrl, resolveIntegrationWebsiteUrl } from "@/lib/integration-website-url";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { HubMentionTextarea, useMentionDraft } from "@/components/hub-mention-textarea";
import { markMentionsRead } from "@/lib/mention-api";
import { VerificationChecklistDialog } from "@/components/verification-checklist-dialog";
import {
  INTEGRATION_DOC_TASK_GROUPS,
  INTEGRATION_OTHER_GROUPS,
  IntegrationTaskList,
  integrationSlaMeta,
  type IntegrationTaskItem,
  TaskSortSelect,
} from "@/components/my-tasks-workspace";
import type { TaskSortOption, WorkflowStage } from "@/lib/my-tasks-sort";
import { DocumentationStatusBadge, FrontendStatusBadge } from "@/components/workflow-status-badge";
import { integrationReviewChecklistItems } from "@/lib/integration-review-checklist";
import { isValidMintlifyUrl } from "@/lib/mintlify-url";
import { ConfirmMintlifyUpdatesDialog } from "@/components/confirm-mintlify-updates-dialog";
import { DraftDocumentationWorkflowBar } from "@/components/draft-documentation-workflow-bar";

export type IntegrationRow = {
  id: string;
  exchangeName: string;
  integrationType: string;
  contentUpdated: boolean;
  frontendUpdateRequired?: boolean;
  stepsHtml?: string;
  stepsDoc?: unknown;
  documentationSource?: DocumentationSource;
  workingDocUrl?: string;
  mintlifyUrl?: string;
  summaryOfChanges: string;
  whyChangesWereMade: string;
  workflowStatus: string;
  reviewStatus?: string;
  mintlifyStatus: string;
  frontendStatus: string;
  overallStatus: string;
  frontendLabel?: string;
  needsTechAssignment?: boolean;
  ownerId?: string;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  assignedTechAgentId?: string;
  assignedTechAgentName?: string;
  frontendAssignedAt?: string;
  mintlifyPublishedAt?: string;
  mintlifyPublishedByName?: string;
  mintlifyPublicationNotes?: string;
  completedAt?: string;
  nextReviewDate?: string;
  reviewDue?: boolean;
  updatedAt?: string;
  slas?: Record<string, { state: string; timer?: string | null }>;
  actions?: Record<string, boolean>;
  statusHint?: string;
  documentationStatusLabel?: string;
  frontendStatusDisplay?: string;
  lastDocumentationUpdatedAt?: string;
  mintlifyResponsibleUserName?: string;
  hasPendingUpdate?: boolean;
  pendingUpdateStatus?: "Editing" | "Ready to Publish" | null;
  documentationVerificationTask?: import("@/components/documentation-verification-task-row").DocumentationVerificationTask;
  documentationWorkflowTask?: import("@/components/documentation-verification-task-row").DocumentationWorkflowTask;
  myWorkflowTask?: {
    stage: "draft" | "verification_required" | "pending_review" | "ready_to_publish" | "frontend_work";
    actionLabel: string;
    responsibleRole: string;
    responsibleName: string;
    status: "open" | "overdue";
    slaDeadline: string | null;
    slaTimer: string | null;
  };
  pendingUpdate?: {
    active: true;
    status: "Editing" | "Ready to Publish";
    documentationSource?: DocumentationSource;
    workingDocUrl?: string;
    mintlifyUrl?: string;
    summaryOfChanges?: string;
    whyChangesWereMade?: string;
    version?: number;
  } | null;
  documentationView?: "management" | "published";
  requiresUpdateReason?: boolean;
};

function integrationPublishedQuiet(integration: IntegrationRow) {
  return (
    integration.workflowStatus === "Completed" &&
    integration.mintlifyStatus === "Published" &&
    !integration.pendingUpdate?.active &&
    !integration.hasPendingUpdate
  );
}

function integrationDocumentationStatus(
  integration: IntegrationRow,
  publishedQuiet: boolean,
  updating: boolean,
  pendingReady: boolean,
  draftLike: boolean,
) {
  if (publishedQuiet) return "Published";
  if (pendingReady || integration.workflowStatus === "Pending Mintlify") return "Ready to Publish";
  if (updating) return "Updating";
  if (draftLike) return "Draft";
  return integration.workflowStatus;
}

function integrationFrontendStatusText(integration: IntegrationRow) {
  if (!integration.frontendUpdateRequired) return "Not required";
  const label = integration.frontendLabel || "";
  if (label.toLowerCase().includes("updated") || integration.frontendStatus === "Completed") return "Implemented";
  if (label.toLowerCase().includes("pending") || integration.workflowStatus === "Pending Frontend") {
    return "Pending implementation";
  }
  return label || "Required";
}

function trackerDocumentationStatus(row: IntegrationRow) {
  if (row.documentationStatusLabel) return row.documentationStatusLabel;
  const { publishedQuiet, updating, pendingReady, draftLike } = integrationDetailMode(row);
  return integrationDocumentationStatus(row, publishedQuiet, updating, pendingReady, draftLike);
}

function trackerLastUpdatedLabel(row: IntegrationRow) {
  const iso = row.lastDocumentationUpdatedAt;
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatWhen(iso);
}

function trackerFrontendStatus(row: IntegrationRow) {
  if (!row.frontendUpdateRequired) return "Not required";
  if (row.frontendStatusDisplay) return row.frontendStatusDisplay;
  return integrationFrontendStatusText(row);
}

function shouldShowIntegrationChangeTracking(
  integration: IntegrationRow,
  updating: boolean,
  draftLike: boolean,
): boolean {
  if (updating) return true;
  if (!draftLike) return false;
  const reason = (integration.whyChangesWereMade || "").trim();
  if (!reason || reason === "New Integration") return false;
  return true;
}

function integrationDetailMode(integration: IntegrationRow) {
  if (integration.documentationView === "published") {
    return { publishedQuiet: true, updating: false, pendingReady: false, draftLike: false };
  }
  const publishedQuiet = integrationPublishedQuiet(integration);
  const updating = Boolean(integration.pendingUpdate?.active || integration.hasPendingUpdate);
  const pendingReady = integration.pendingUpdate?.status === "Ready to Publish";
  const draftLike = integration.workflowStatus === "Draft" || integration.workflowStatus === "Changes Required";
  return { publishedQuiet, updating, pendingReady, draftLike };
}

const integrationListQueryOpts = { staleTime: 0, refetchOnMount: "always" as const };

type IntegrationTrackerFilter =
  | "all"
  | "pendingReview"
  | "pendingMintlify"
  | "frontendPending"
  | "overdue"
  | "reviewDue";

function trackerSearchParamsForFilter(filter: IntegrationTrackerFilter) {
  const p = new URLSearchParams();
  switch (filter) {
    case "pendingReview":
      p.set("workflowStatus", "Pending Review");
      break;
    case "pendingMintlify":
      p.set("workflowStatus", "Pending Mintlify");
      break;
    case "frontendPending":
      p.set("workflowStatus", "Pending Frontend");
      break;
    case "overdue":
      p.set("overdue", "true");
      break;
    case "reviewDue":
      p.set("reviewDue", "true");
      break;
    default:
      break;
  }
  return p;
}

function buildTrackerListQuery(searchParams: URLSearchParams, q: string) {
  const p = new URLSearchParams();
  p.set("mode", "tracker");
  if (q.trim()) p.set("q", q.trim());
  for (const key of ["workflowStatus", "mintlifyStatus", "frontendStatus", "reviewStatus", "overdue", "reviewDue"]) {
    const v = searchParams.get(key);
    if (v) p.set(key, v);
  }
  return p.toString();
}

function activeTrackerFilter(searchParams: URLSearchParams): IntegrationTrackerFilter {
  if (searchParams.get("overdue") === "true") return "overdue";
  if (searchParams.get("reviewDue") === "true") return "reviewDue";
  if (searchParams.get("workflowStatus") === "Pending Review") return "pendingReview";
  if (searchParams.get("workflowStatus") === "Pending Mintlify") return "pendingMintlify";
  if (searchParams.get("workflowStatus") === "Pending Frontend") return "frontendPending";
  return "all";
}

const TRACKER_FILTER_LABELS: Record<IntegrationTrackerFilter, string | null> = {
  all: null,
  pendingReview: "Pending review",
  pendingMintlify: "Pending Mintlify",
  frontendPending: "Frontend pending",
  overdue: "Overdue SLAs",
  reviewDue: "Review due",
};

function invalidateIntegrationLists(client: QueryClient, detailId?: string) {
  void client.invalidateQueries({ queryKey: ["is-tracker"] });
  void client.invalidateQueries({ queryKey: ["is-my-tasks"] });
  void client.invalidateQueries({ queryKey: ["is-stats"] });
  void client.invalidateQueries({ queryKey: ["dashboard"] });
  if (detailId) void client.invalidateQueries({ queryKey: ["is-detail", detailId] });
}

export function IntegrationStepsDashboardPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canOpenTracker = can("integration.tracker");
  const openTracker = (filter: IntegrationTrackerFilter) => {
    if (!canOpenTracker) return;
    const qs = trackerSearchParamsForFilter(filter).toString();
    navigate(`/integration-steps/tracker${qs ? `?${qs}` : ""}`);
  };
  const stats = useQuery({
    queryKey: ["is-stats"],
    queryFn: () => api<{ stats: Record<string, number> }>("/api/integration-steps/stats"),
    enabled: can("integration.dashboard"),
  });
  const myTasks = useQuery({
    queryKey: ["is-my-tasks"],
    queryFn: () => api<{ integrations: IntegrationRow[] }>("/api/integration-steps?mode=my-tasks"),
    enabled: can("integration.dashboard"),
    ...integrationListQueryOpts,
  });

  if (stats.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      {stats.data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterStat
            label="Total"
            value={stats.data.stats.total || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("all")}
          />
          <FilterStat
            label="Pending review"
            value={stats.data.stats.pendingReview || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("pendingReview")}
          />
          <FilterStat
            label="Pending publication"
            value={stats.data.stats.pendingMintlify || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("pendingMintlify")}
          />
          <FilterStat
            label="Frontend pending"
            value={stats.data.stats.frontendPending || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("frontendPending")}
          />
          <FilterStat
            label="Overdue SLAs"
            value={stats.data.stats.overdue || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("overdue")}
          />
          <FilterStat
            label="Review due"
            value={stats.data.stats.reviewDue || 0}
            disabled={!canOpenTracker}
            onClick={() => openTracker("reviewDue")}
          />
        </div>
      ) : null}
      {can("integration.dashboard") ? (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">Pending action by me</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {myTasks.data?.integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending actions.</p>
            ) : (
              myTasks.data?.integrations.map((row) => (
                <IntegrationTabLink key={row.id} id={row.id} title={row.exchangeName} className="block w-full border-b py-2 text-left last:border-0 hover:text-primary">
                  <span className="font-medium">{row.exchangeName}</span>
                  <span className="text-muted-foreground"> · {row.workflowStatus}</span>
                  {row.statusHint ? <span className="block text-xs text-muted-foreground">{row.statusHint}</span> : null}
                </IntegrationTabLink>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
      {can("integration.library") && !can("integration.tracker") ? (
        <Card>
          <CardHeader><CardTitle>Browse integrations</CardTitle></CardHeader>
          <CardContent>
            <Link to="/integration-steps/tracker" className="text-sm text-primary">Open integration tracker</Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function IntegrationTrackerPage() {
  const { canMutate } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = activeTrackerFilter(searchParams);
  const [q, setQ] = useState("");
  const listQuery = buildTrackerListQuery(searchParams, q);
  const list = useQuery({
    queryKey: ["is-tracker", listQuery],
    queryFn: () => api<{ integrations: IntegrationRow[] }>(`/api/integration-steps?${listQuery}`),
    ...integrationListQueryOpts,
  });
  const activeFilterLabel = TRACKER_FILTER_LABELS[activeFilter];

  return (
    <div className="space-y-4">
      {activeFilterLabel ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{activeFilterLabel}</span>
          </span>
          <Button type="button" variant="link" className="h-auto px-0" onClick={() => setSearchParams({})}>
            Clear filter
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input className="max-w-md" placeholder="Search exchange or type" value={q} onChange={(e) => setQ(e.target.value)} />
        {canMutate("integration.manage") ? (
          <Link to="/integration-steps/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">
            New integration
          </Link>
        ) : null}
      </div>
      {list.isLoading ? <LoadingBlock /> : null}
      {list.data?.integrations.length === 0 ? (
        <Empty title="No integrations yet" body="Integration records will appear here once they are created." />
      ) : null}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Integration</th>
              <th className="px-3 py-2">Documentation</th>
              <th className="px-3 py-2">Frontend</th>
              <th className="px-3 py-2">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.integrations.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/40 dark:hover:bg-muted/40">
                <td className="px-3 py-2">
                  <IntegrationTabLink id={row.id} title={row.exchangeName} className="font-medium text-primary">
                    {row.exchangeName}
                  </IntegrationTabLink>
                  <p className="text-xs text-muted-foreground">{row.integrationType}</p>
                </td>
                <td className="px-3 py-2">
                  <DocumentationStatusBadge label={trackerDocumentationStatus(row)} />
                </td>
                <td className="px-3 py-2">
                  <FrontendStatusBadge label={trackerFrontendStatus(row)} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{trackerLastUpdatedLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function integrationMyTaskStage(row: IntegrationRow) {
  if (row.documentationWorkflowTask?.stage) return row.documentationWorkflowTask.stage;
  if (row.documentationVerificationTask || row.myWorkflowTask?.stage === "verification_required") {
    return "verification_required";
  }
  return row.myWorkflowTask?.stage ?? null;
}

function buildIntegrationTaskItem(row: IntegrationRow, onOpen: () => void): IntegrationTaskItem | null {
  const stage = integrationMyTaskStage(row) as WorkflowStage | null;
  if (!stage) return null;
  const docTask = row.documentationWorkflowTask || row.documentationVerificationTask;
  const wf = row.myWorkflowTask;
  if (docTask) {
    const isDraft = docTask.kind === "documentation_preparation" || docTask.stage === "draft";
    const sla = integrationSlaMeta(docTask.slaDeadline, docTask.slaTimer, docTask.slaState, isDraft);
    const ts = docTask.requiredAt ? new Date(docTask.requiredAt).getTime() : docTask.slaDeadline ? new Date(docTask.slaDeadline).getTime() : 0;
    return {
      id: row.id,
      stage: docTask.stage,
      title: docTask.title,
      category: docTask.subtitle || row.integrationType,
      slaLabel: sla.label,
      overdue: sla.overdue,
      stageTimestamp: Number.isNaN(ts) ? 0 : ts,
      msToDeadline: sla.msToDeadline,
      onOpen,
    };
  }
  const isDraft = stage === "draft";
  const sla = integrationSlaMeta(wf?.slaDeadline, wf?.slaTimer, wf?.status === "overdue" ? "Overdue" : null, isDraft);
  const ts = wf?.slaDeadline ? new Date(wf.slaDeadline).getTime() : 0;
  const title = wf?.actionLabel || row.exchangeName;
  return {
    id: row.id,
    stage,
    title,
    category: row.integrationType,
    slaLabel: sla.label,
    overdue: sla.overdue || wf?.status === "overdue",
    stageTimestamp: Number.isNaN(ts) ? 0 : ts,
    msToDeadline: sla.msToDeadline,
    onOpen,
  };
}

export function IntegrationTasksPage() {
  const { openIntegration } = useIntegrationStepsTabs();
  const { can, effective } = useAuth();
  const [sortBy, setSortBy] = useState<TaskSortOption>("closest_sla");
  const myTasks = useQuery({
    queryKey: ["is-my-tasks"],
    queryFn: () => api<{ integrations: IntegrationRow[] }>("/api/integration-steps?mode=my-tasks"),
    ...integrationListQueryOpts,
  });
  const rows = myTasks.data?.integrations ?? [];
  const integrationOtherGroups = INTEGRATION_OTHER_GROUPS.filter((group) => {
    if (group.stage === "pending_review") {
      return can("integration.review") || effective?.roleKey === "admin" || effective?.roleKey === "supervisor";
    }
    if (group.stage === "frontend_work") {
      return can("integration.tech") || effective?.roleKey === "admin" || effective?.roleKey === "supervisor";
    }
    return true;
  });
  const taskItems = rows
    .map((row) => buildIntegrationTaskItem(row, () => openIntegration(row.id, row.exchangeName)))
    .filter((item): item is IntegrationTaskItem => Boolean(item));
  const empty = !myTasks.isLoading && taskItems.length === 0;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Actionable integration work assigned to your role — verification, review, publication, and frontend tasks.
      </p>
      <div className="flex justify-end">
        <TaskSortSelect value={sortBy} onChange={setSortBy} />
      </div>
      {myTasks.isLoading ? <LoadingBlock /> : null}
      {empty ? (
        <Empty title="No tasks assigned to you" body="When something needs your action, it will show up here." />
      ) : (
        <IntegrationTaskList
          items={taskItems}
          sortBy={sortBy}
          docGroups={INTEGRATION_DOC_TASK_GROUPS}
          otherGroups={integrationOtherGroups}
        />
      )}
    </div>
  );
}

function SubmitMintlifyDialog({
  open,
  onOpenChange,
  integrationId,
  integrationType,
  pendingUpdate,
  requiresUpdateReason = true,
  initialUpdateReason,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationType: string;
  pendingUpdate?: boolean;
  requiresUpdateReason?: boolean;
  initialUpdateReason?: string;
  onSubmitted?: () => void;
}) {
  const client = useQueryClient();
  const [updateReason, setUpdateReason] = useState("");
  const reviewChecklistItems = integrationReviewChecklistItems(integrationType);
  useEffect(() => {
    if (open) setUpdateReason(initialUpdateReason || "");
  }, [open, initialUpdateReason]);
  const submit = useMutation({
    mutationFn: (payload: {
      checklist: Record<string, { result: string; naReason?: string }>;
      whyChangesWereMade?: string;
    }) =>
      api(
        pendingUpdate
          ? `/api/integration-steps/${integrationId}/pending-update/submit`
          : `/api/integration-steps/${integrationId}/submit`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () => {
      toast.success("Verification complete — ready for Mintlify publication");
      invalidateIntegrationLists(client, integrationId);
      onOpenChange(false);
      onSubmitted?.();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <VerificationChecklistDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Integration steps verification"
      subtitle="Confirm the external Mintlify documentation before publication"
      items={reviewChecklistItems}
      allowUnable={false}
      confirmLabel="Complete verification"
      pending={submit.isPending}
      updateReason={
        requiresUpdateReason
          ? { variant: "integration", value: updateReason, onChange: setUpdateReason }
          : undefined
      }
      onConfirm={(checklist, extras) =>
        submit.mutate({
          checklist,
          ...(requiresUpdateReason
            ? { whyChangesWereMade: extras?.updateReason || updateReason }
            : {}),
        })
      }
    />
  );
}

export function IntegrationStepsEditorWindowPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">Integration documentation is edited in Mintlify. Open an integration from the tracker.</p>
      <Button type="button" variant="outline" asChild>
        <Link to="/integration-steps/tracker">Back to Integration Steps</Link>
      </Button>
    </div>
  );
}

export function IntegrationFormPage() {
  const client = useQueryClient();
  const { openIntegration } = useIntegrationStepsTabs();
  const [exchangeName, setExchangeName] = useState("");
  const [integrationType, setIntegrationType] = useState("API");
  const [frontendUpdateRequired, setFrontendUpdateRequired] = useState(false);
  const [summaryOfChanges, setSummaryOfChanges] = useState("");
  const newIntegrationReason = serializeIntegrationUpdateReason("New Integration");

  useEffect(() => {
    const restored = loadIntegrationNewFormDraft();
    if (!restored) return;
    setExchangeName(restored.exchangeName);
    setIntegrationType(restored.integrationType);
    setSummaryOfChanges(restored.summaryOfChanges);
    setFrontendUpdateRequired(restored.frontendUpdateRequired);
  }, []);

  const duplicateCheck = useQuery({
    queryKey: ["is-duplicate", exchangeName, integrationType],
    queryFn: () =>
      api<{ duplicate: { id: string; exchangeName: string; integrationType: string } | null }>(
        `/api/integration-steps/lookup?exchangeName=${encodeURIComponent(exchangeName)}&integrationType=${encodeURIComponent(integrationType)}`,
      ),
    enabled: exchangeName.trim().length >= 2,
  });

  const save = useMutation({
    mutationFn: (): Promise<{ id: string }> =>
      api("/api/integration-steps", {
        method: "POST",
        body: JSON.stringify({
          exchangeName,
          integrationType,
          frontendUpdateRequired,
          summaryOfChanges,
          whyChangesWereMade: newIntegrationReason,
        }),
      }),
    onSuccess: (data) => {
      clearIntegrationNewFormDraft();
      void client.invalidateQueries({ queryKey: ["is-tracker"] });
      toast.success("Integration draft created");
      openIntegration(data.id, exchangeName.trim() || "Integration");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="mx-auto max-w-4xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (duplicateCheck.data?.duplicate) {
          toast.error("An integration with this exchange and type already exists.");
          return;
        }
        save.mutate();
      }}
    >
      <PageHeader title="New integration" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Exchange name</Label>
          <Input value={exchangeName} onChange={(e) => setExchangeName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Integration type</Label>
          <Select value={integrationType} onValueChange={setIntegrationType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["File Upload", "API", "Direct Connect"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {duplicateCheck.data?.duplicate ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
          An integration already exists for this exchange and type.{" "}
          <IntegrationTabLink
            id={duplicateCheck.data.duplicate.id}
            title={duplicateCheck.data.duplicate.exchangeName}
            className="font-medium underline"
          >
            Open existing integration
          </IntegrationTabLink>
        </p>
      ) : null}
      <div className="space-y-2">
        <Label>Summary of changes</Label>
        <Textarea
          placeholder="Briefly describe the integration being added."
          value={summaryOfChanges}
          onChange={(e) => setSummaryOfChanges(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Does this integration require an update to the KoinX frontend?</Label>
          <Select
            value={frontendUpdateRequired ? "yes" : "no"}
            onValueChange={(v) => setFrontendUpdateRequired(v === "yes")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No — Documentation only</SelectItem>
              <SelectItem value="yes">Yes — Frontend changes required</SelectItem>
            </SelectContent>
          </Select>
        </div>
      {frontendUpdateRequired ? (
        <p className="text-xs text-muted-foreground">
          Frontend work is tracked separately and assigned to a Tech Agent when documentation is ready.
        </p>
      ) : null}

      <Button type="submit" disabled={save.isPending || Boolean(duplicateCheck.data?.duplicate)}>
        Create draft
      </Button>
    </form>
  );
}

export function IntegrationEditPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const pendingMode = searchParams.get("pending") === "1";
  if (!id) return <ErrorBlock message="Missing integration id" />;
  const to = pendingMode ? `/integration-steps/${id}?pendingEdit=1` : `/integration-steps/${id}?draftEdit=1`;
  return <Navigate to={to} replace />;
}

export function IntegrationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { openIntegration, setIntegrationTitle, closeIntegrationTab } = useIntegrationStepsTabs();
  const { can, canMutate, readOnly, effective } = useAuth();
  const client = useQueryClient();
  const feedbackDraft = useMentionDraft();
  const [reviewNotes, setReviewNotes] = useState("");
  const clarificationDraft = useMentionDraft();
  const clarificationResponseDraft = useMentionDraft();
  const [techNotes, setTechNotes] = useState("");
  const [mintlifyNotes, setMintlifyNotes] = useState("");
  const [mintlifyUrl, setMintlifyUrl] = useState("");
  const [mintlifyUrlError, setMintlifyUrlError] = useState("");
  const [techAgentId, setTechAgentId] = useState("");
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false);
  const [frontendCompleteOpen, setFrontendCompleteOpen] = useState(false);
  const [overrideCompleteOpen, setOverrideCompleteOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reassignReviewerId, setReassignReviewerId] = useState("");
  const [approveChecklistOpen, setApproveChecklistOpen] = useState(false);
  const [beginUpdateOpen, setBeginUpdateOpen] = useState(false);
  const [discardUpdateOpen, setDiscardUpdateOpen] = useState(false);
  const [confirmMintlifyOpen, setConfirmMintlifyOpen] = useState(false);
  const [returnToDraftOpen, setReturnToDraftOpen] = useState(false);
  const [deleteIntegrationOpen, setDeleteIntegrationOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [verificationHistoryOpen, setVerificationHistoryOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingEditOpen = searchParams.get("pendingEdit") === "1";
  const draftEditOpen = searchParams.get("draftEdit") === "1";
  const [editChangeReason, setEditChangeReason] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editFrontendRequired, setEditFrontendRequired] = useState(false);
  const [editPendingVersion, setEditPendingVersion] = useState(1);

  const query = useQuery({
    queryKey: ["is-detail", id],
    queryFn: () =>
      api<{
        integration: IntegrationRow;
        currentVerification?: {
          documentVersion: number;
          integrationType: string;
          verifiedByName: string;
          verifiedAt: string;
          checklist: Record<string, { result: string; naReason?: string }>;
        } | null;
        verificationHistory?: {
          documentVersion: number;
          integrationType: string;
          verifiedByName: string;
          verifiedAt: string;
          checklist: Record<string, { result: string; naReason?: string }>;
        }[];
        approvalVerification?: {
          documentVersion: number;
          integrationType: string;
          verifiedByName: string;
          verifiedAt: string;
          checklist: Record<string, { result: string; naReason?: string }>;
        } | null;
        activity: { summary: string; actorName: string; createdAt: string }[];
        versions: { version: number; summaryNote: string; savedByName: string; createdAt: string }[];
      }>(`/api/integration-steps/${id}`),
    enabled: Boolean(id),
    ...integrationListQueryOpts,
  });
  const canReassignPeople = effective?.roleKey === "admin" || effective?.roleKey === "supervisor";
  const canDeleteIntegration =
    !readOnly && (effective?.roleKey === "admin" || effective?.roleKey === "supervisor");
  const techAgents = useQuery({
    queryKey: ["is-tech-agents"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/integration-steps/tech-agents"),
    enabled: Boolean(id) && (canMutate("integration.manage") || canReassignPeople),
  });
  const reviewers = useQuery({
    queryKey: ["is-reviewers"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/integration-steps/reviewers"),
    enabled: Boolean(id) && (canMutate("integration.manage") || canReassignPeople),
  });

  useEffect(() => {
    if (!query.data?.integration) return;
    const row = query.data.integration;
    setMintlifyUrl(resolveIntegrationWebsiteUrl(row.exchangeName, row.mintlifyUrl));
    setMintlifyUrlError("");
  }, [query.data?.integration?.id, query.data?.integration?.mintlifyUrl, query.data?.integration?.exchangeName]);

  useEffect(() => {
    if (!id || readOnly) return;
    void markMentionsRead("integration_step", id, { queryClient: client, dashboardUserId: effective?.id }).catch(
      () => undefined,
    );
  }, [id, readOnly, client, effective?.id]);

  useEffect(() => {
    const assigned = query.data?.integration.assignedTechAgentId;
    if (assigned) setTechAgentId(assigned);
  }, [query.data?.integration.assignedTechAgentId]);

  useEffect(() => {
    const assigned = query.data?.integration.assignedReviewerId;
    if (assigned) setReassignReviewerId(assigned);
  }, [query.data?.integration.assignedReviewerId]);

  useEffect(() => {
    const row = query.data?.integration;
    if (!row?.id || !row.exchangeName) return;
    setIntegrationTitle(row.id, row.exchangeName);
  }, [query.data?.integration?.id, query.data?.integration?.exchangeName, setIntegrationTitle]);

  useEffect(() => {
    const row = query.data?.integration;
    if (!row) return;
    if (row.pendingUpdate?.active) {
      const pending = row.pendingUpdate;
      setEditChangeReason(pending.whyChangesWereMade || "");
      setEditSummary(pending.summaryOfChanges || "");
      setEditPendingVersion(pending.version || 1);
    } else {
      setEditChangeReason(row.whyChangesWereMade || "");
      setEditSummary(row.summaryOfChanges || "");
      setEditFrontendRequired(Boolean(row.frontendUpdateRequired));
    }
  }, [
    query.data?.integration?.id,
    query.data?.integration?.pendingUpdate?.version,
    query.data?.integration?.summaryOfChanges,
    query.data?.integration?.whyChangesWereMade,
    query.data?.integration?.frontendUpdateRequired,
  ]);

  const saveMetadata = useMutation({
    mutationFn: async (): Promise<{ version?: number } | void> => {
      if (!id) throw new Error("Missing id");
      const row = query.data?.integration;
      if (!row) throw new Error("Integration not loaded");
      if (row.pendingUpdate?.active) {
        if (!isIntegrationUpdateReasonReadyForPublish(editChangeReason)) {
          throw new Error("Select a reason for this update before saving.");
        }
        return api<{ version?: number }>(`/api/integration-steps/${id}/pending-update`, {
          method: "PATCH",
          body: JSON.stringify({
            summaryOfChanges: editSummary,
            whyChangesWereMade: editChangeReason,
            version: editPendingVersion,
          }),
        });
      }
      const draftBody: Record<string, unknown> = {
        summaryOfChanges: editSummary,
        frontendUpdateRequired: editFrontendRequired,
      };
      if (row.requiresUpdateReason) draftBody.whyChangesWereMade = editChangeReason;
      await api(`/api/integration-steps/${id}`, {
        method: "PATCH",
        body: JSON.stringify(draftBody),
      });
    },
    onSuccess: (data: { version?: number } | void) => {
      if (data && typeof data === "object" && "version" in data && data.version) {
        setEditPendingVersion(data.version);
      }
      toast.success("Saved");
      invalidateIntegrationLists(client, id);
      const next = new URLSearchParams(searchParams);
      next.delete("pendingEdit");
      next.delete("draftEdit");
      setSearchParams(next, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) =>
      api(`/api/integration-steps/${id}${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      toast.success("Updated");
      invalidateIntegrationLists(client, id);
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmMintlifyUpdates = useMutation({
    mutationFn: () => api(`/api/integration-steps/${id}/mintlify-updates/confirm`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Submitted for verification");
      setConfirmMintlifyOpen(false);
      invalidateIntegrationLists(client, id);
    },
    onError: (e) => toast.error(e.message),
  });

  const returnDocumentationToDraft = useMutation({
    mutationFn: () => api(`/api/integration-steps/${id}/mintlify-updates/return-to-draft`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Returned to draft");
      setReturnToDraftOpen(false);
      invalidateIntegrationLists(client, id);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteIntegration = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing integration id");
      return api(`/api/integration-steps/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
    },
    onSuccess: () => {
      toast.success("Integration deleted");
      setDeleteIntegrationOpen(false);
      setDeleteReason("");
      if (id) closeIntegrationTab(id);
      invalidateIntegrationLists(client, id);
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/integration-steps/tracker");
    },
    onError: (e) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <ErrorBlock message={query.error?.message || "Not found"} />;
  const { integration } = query.data;
  const managementView = integration.documentationView !== "published";
  const activity = managementView ? (query.data.activity ?? []) : [];
  const versions = managementView ? (query.data.versions ?? []) : [];
  const currentVerification = managementView
    ? (query.data.currentVerification ?? query.data.approvalVerification ?? null)
    : null;
  const verificationHistory = managementView ? (query.data.verificationHistory ?? []) : [];
  const reviewChecklistItems = integrationReviewChecklistItems(integration.integrationType);
  const supportedFilesHref =
    integration.integrationType === "File Upload"
      ? `/supported-files/tracker?exchange=${encodeURIComponent(integration.exchangeName)}`
      : undefined;
  const a = integration.actions || {};
  const { publishedQuiet, updating, pendingReady, draftLike } = integrationDetailMode(integration);
  const publicationPhase = integrationPublicationPhase(integration);
  const confirmedPublishedWebsiteUrl =
    integration.mintlifyStatus === "Published"
      ? resolveIntegrationWebsiteUrl(integration.exchangeName, integration.mintlifyUrl)
      : "";
  const docSource = normalizeDocumentationSource(
    updating ? integration.pendingUpdate?.documentationSource : integration.documentationSource,
  );
  const frontendStatusLabel = trackerFrontendStatus(integration);
  const showChangeTracking = shouldShowIntegrationChangeTracking(integration, updating, draftLike);
  const showMetadataEdit =
    !readOnly &&
    managementView &&
    ((pendingEditOpen && updating) || (draftEditOpen && draftLike && !updating));
  const docSourceLine = normalizeDocumentationSource(
    integration.pendingUpdate?.documentationSource || integration.documentationSource,
  );
  const docHrefLine = resolveWorkingUrl(
    integration.pendingUpdate?.workingDocUrl || integration.workingDocUrl || "",
    "integrationSteps",
    docSourceLine,
  );
  function closeMetadataEdit() {
    const next = new URLSearchParams(searchParams);
    next.delete("pendingEdit");
    next.delete("draftEdit");
    setSearchParams(next, { replace: true });
  }
  const verificationRequired =
    !readOnly &&
    (a.submit || a.submitPending) &&
    !currentVerification;
  const verificationPendingForDisplay = Boolean((a.submit || a.submitPending) && !currentVerification);
  const titleBadge = integrationTitleBadge({
    integration,
    updating,
    pendingReady,
    verificationRequired: verificationPendingForDisplay,
  });
  const showPublishedInMetadata = integrationWasEverPublished(integration);
  const hasHeaderPrimaryAction =
    !readOnly &&
    (a.beginUpdate || (draftLike && (a.confirmMintlifyUpdates || a.edit) && !updating));
  const techView =
    can("integration.tech") &&
    integration.assignedTechAgentId &&
    !canMutate("integration.manage") &&
    !canMutate("integration.review");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {id ? (
        <>
          <SubmitMintlifyDialog
            open={submitReviewOpen}
            onOpenChange={setSubmitReviewOpen}
            integrationId={id}
            integrationType={integration.integrationType}
            pendingUpdate={Boolean(a.submitPending)}
            requiresUpdateReason={Boolean(integration.pendingUpdate?.active || integration.requiresUpdateReason)}
            initialUpdateReason={
              integration.pendingUpdate?.whyChangesWereMade || integration.whyChangesWereMade || ""
            }
          />
          <ConfirmMintlifyUpdatesDialog
            open={confirmMintlifyOpen}
            onOpenChange={setConfirmMintlifyOpen}
            pending={confirmMintlifyUpdates.isPending}
            onConfirm={() => confirmMintlifyUpdates.mutate()}
          />
          <Dialog
            open={deleteIntegrationOpen}
            onOpenChange={(open) => {
              setDeleteIntegrationOpen(open);
              if (!open) setDeleteReason("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this integration?</DialogTitle>
                <DialogDescription>
                  This permanently removes the integration record and its history. Admins will be notified.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-integration-reason">Reason for deletion (required)</Label>
                <Textarea
                  id="delete-integration-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  placeholder="Why is this integration being removed?"
                  required
                  minLength={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteIntegrationOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteIntegration.isPending || deleteReason.trim().length < 3}
                  onClick={() => deleteIntegration.mutate()}
                >
                  Delete integration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={returnToDraftOpen} onOpenChange={setReturnToDraftOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Return to draft?</DialogTitle>
                <DialogDescription>
                  This cancels the current verification cycle. Make additional edits in Mintlify, then mark updates complete
                  again to start a new 24-hour verification SLA.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReturnToDraftOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={returnDocumentationToDraft.isPending}
                  onClick={() => returnDocumentationToDraft.mutate()}
                >
                  Return to draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-primary/80 uppercase">{integration.integrationType}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem]">{integration.exchangeName}</h1>
            {titleBadge ? (
              <LifecycleStatusBadge label={titleBadge.label} className={titleBadge.className} />
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {a.beginUpdate && !readOnly ? (
            <Button type="button" size="sm" onClick={() => setBeginUpdateOpen(true)}>
              Update integration
            </Button>
          ) : null}
          {canDeleteIntegration ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteIntegrationOpen(true)}
            >
              Delete integration
            </Button>
          ) : null}
          <ReportIssueButton
            variant={hasHeaderPrimaryAction ? "outline" : "default"}
            source={{
              sourceType: "integration_step",
              sourceId: integration.id,
              sourceTypeLabel: "Integration Steps",
              sourceLabel: integration.exchangeName,
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showPublishedInMetadata ? (
          <MetadataChip label="Status">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${publishedMetadataBadgeClass()}`}>
              Published
            </span>
          </MetadataChip>
        ) : null}
        {showPublishedInMetadata && integration.mintlifyPublishedAt ? (
          <MetadataChip label="Last published">{formatPublicationTimestamp(integration.mintlifyPublishedAt)}</MetadataChip>
        ) : null}
        <MetadataChip label="Frontend">
          <FrontendStatusBadge label={frontendStatusLabel} />
        </MetadataChip>
      </div>

      {updating && managementView ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-foreground">
            Documentation update — {pendingReady ? "Ready to Publish" : verificationRequired ? "Verification Required" : "Editing"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {pendingReady
              ? "Verification completed. Publish the changes in Mintlify, then confirm publication here."
              : verificationRequired
                ? "Review the documentation and complete the verification checklist."
                : integration.mintlifyStatus === "Published"
                  ? "The previously published documentation remains live while this update is being prepared."
                  : "Continue preparing this documentation for verification and publication."}
          </p>
          {!readOnly ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pendingReady ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => document.getElementById("is-confirm-publication")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Confirm publication
                </Button>
              ) : verificationRequired ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                    onClick={() => setSubmitReviewOpen(true)}
                  >
                    Verify changes
                  </Button>
                  {a.returnDocumentationToDraft ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setReturnToDraftOpen(true)}>
                      Return to draft
                    </Button>
                  ) : null}
                </>
              ) : (
                <DraftDocumentationWorkflowBar
                  kind="integrationSteps"
                  source={docSourceLine}
                  workingDocUrl={integration.pendingUpdate?.workingDocUrl || integration.workingDocUrl || ""}
                  confirmMintlifyUpdates={Boolean(a.confirmMintlifyUpdates)}
                  returnDocumentationToDraft={false}
                  confirmPending={confirmMintlifyUpdates.isPending}
                  onEditDetails={() => setSearchParams({ pendingEdit: "1" }, { replace: true })}
                  onMarkMintlifyComplete={() => setConfirmMintlifyOpen(true)}
                  onReturnToDraft={() => setReturnToDraftOpen(true)}
                />
              )}
              {a.discardUpdate ? (
                <Button
                  type="button"
                  size="sm"
                  className="border-red-700 bg-red-600 text-white hover:bg-red-700 dark:border-red-800 dark:bg-red-700 dark:hover:bg-red-800"
                  onClick={() => setDiscardUpdateOpen(true)}
                >
                  Discard update
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="min-w-0 space-y-4">
      <DocumentationDetailCard
        kind="integrationSteps"
        recordId={integration.id}
        workflowSnapshot={integration.pendingUpdate?.status || integration.workflowStatus}
        source={docSource}
        workingDocUrl={integration.pendingUpdate?.workingDocUrl || integration.workingDocUrl || ""}
        confirmedPublishedUrl={confirmedPublishedWebsiteUrl}
        publicationPhase={publicationPhase}
        pendingUpdateOnPublished={integration.mintlifyStatus === "Published" && updating}
        showExternalEditor={managementView && !readOnly}
        layout="compact"
      />

      {!publishedQuiet && !readOnly && (a.edit || updating || draftLike) ? (
        <SmartReturnReminder
          recordId={integration.id}
          kind="integration_step"
          source={docSource}
          readOnly={readOnly}
          onVerify={() => setSubmitReviewOpen(true)}
        />
      ) : null}

      {showMetadataEdit ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{updating ? "Update details" : "Draft details"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {updating || integration.requiresUpdateReason ? (
              <IntegrationUpdateReasonFields
                label={updating ? "Reason for update" : undefined}
                value={editChangeReason}
                onChange={setEditChangeReason}
                required={updating || Boolean(integration.requiresUpdateReason)}
              />
            ) : null}
            <div className="space-y-2">
              <Label>Summary of changes</Label>
              <Textarea
                placeholder={
                  updating
                    ? "Briefly describe what changed in the integration instructions."
                    : "Briefly describe the integration being added."
                }
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={3}
              />
            </div>
            {updating ? (
              <p className="text-sm text-muted-foreground">
                Documentation source ·{" "}
                {docHrefLine ? (
                  <a className="font-medium text-primary no-underline hover:text-primary/90" {...externalLinkProps(docHrefLine)}>
                    {docSourceLine}
                  </a>
                ) : (
                  <span className="text-foreground/80">{docSourceLine} — link not configured</span>
                )}
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Does this integration require an update to the KoinX frontend?</Label>
                <Select
                  value={editFrontendRequired ? "yes" : "no"}
                  onValueChange={(v) => setEditFrontendRequired(v === "yes")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No — Documentation only</SelectItem>
                    <SelectItem value="yes">Yes — Frontend changes required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saveMetadata.isPending} onClick={() => saveMetadata.mutate()}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={closeMetadataEdit}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : showChangeTracking ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Change tracking</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Reason for update · </span>{formatIntegrationUpdateReasonDisplay(integration.pendingUpdate?.whyChangesWereMade || integration.whyChangesWereMade)}</p>
            <p className="text-muted-foreground">{integration.pendingUpdate?.summaryOfChanges || integration.summaryOfChanges}</p>
          </CardContent>
        </Card>
      ) : null}

      {Boolean(a.confirmMintlifyUpdates) && !readOnly && managementView ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prepare documentation</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Author content in Mintlify, keep metadata current in the Hub, then confirm when updates are complete.
            </p>
          </CardHeader>
          <CardContent>
            <DraftDocumentationWorkflowBar
              kind="integrationSteps"
              source={docSourceLine}
              workingDocUrl={integration.workingDocUrl || ""}
              confirmMintlifyUpdates={Boolean(a.confirmMintlifyUpdates)}
              returnDocumentationToDraft={false}
              confirmPending={confirmMintlifyUpdates.isPending}
              onEditDetails={() => setSearchParams({ draftEdit: "1" }, { replace: true })}
              onMarkMintlifyComplete={() => setConfirmMintlifyOpen(true)}
              onReturnToDraft={() => setReturnToDraftOpen(true)}
            />
          </CardContent>
        </Card>
      ) : null}

      {verificationRequired && !updating ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            onClick={() => setSubmitReviewOpen(true)}
          >
            Verify changes
          </Button>
          {a.returnDocumentationToDraft ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setReturnToDraftOpen(true)}>
              Return to draft
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={beginUpdateOpen} onOpenChange={setBeginUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start integration update?</DialogTitle>
            <DialogDescription>The published documentation stays live until you confirm the update.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBeginUpdateOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                action.mutate(
                  { path: "/pending-update/begin" },
                  {
                    onSuccess: () => {
                      setBeginUpdateOpen(false);
                      openIntegration(integration.id, integration.exchangeName, { edit: true, search: "?pending=1" });
                    },
                  },
                )
              }
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardUpdateOpen} onOpenChange={setDiscardUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard documentation update?</DialogTitle>
            <DialogDescription>The published integration instructions will remain unchanged.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardUpdateOpen(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={() => action.mutate({ path: "/pending-update/discard" }, { onSuccess: () => setDiscardUpdateOpen(false) })}
            >
              Discard update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {managementView && !readOnly && !techView && (a.submit || a.requestChanges || a.approve || a.confirmMintlify || a.assignTech || a.reassignReviewer || a.reassignTech) ? (
        <Card>
          <CardHeader><CardTitle>Review & publication</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {a.reassignReviewer ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium text-foreground/90">Change reviewer</p>
                <p className="text-sm text-muted-foreground">
                  Currently <strong>{integration.assignedReviewerName || "unassigned"}</strong>. Reassign if they are unavailable.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={reassignReviewerId || undefined} onValueChange={setReassignReviewerId}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Reviewer" /></SelectTrigger>
                    <SelectContent>
                      {reviewers.data?.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!reassignReviewerId || reassignReviewerId === integration.assignedReviewerId}
                    onClick={() => action.mutate({ path: "/assign-reviewer", body: { reviewerId: reassignReviewerId } })}
                  >
                    Update reviewer
                  </Button>
                </div>
              </div>
            ) : null}
            {a.requestChanges || a.approve ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium text-foreground/90">Review</p>
                {a.requestChanges ? (
                  <>
                    <HubMentionTextarea
                      scope="integration_step"
                      recordId={integration.id}
                      value={feedbackDraft.value}
                      onValueChange={feedbackDraft.setValue}
                      mentionRefs={feedbackDraft.mentionRefs}
                      onMentionRefsChange={feedbackDraft.setMentionRefs}
                      placeholder="What needs to change? Type @ to mention someone."
                    />
                    <Button
                      variant="outline"
                      disabled={!feedbackDraft.value.trim()}
                      onClick={() => {
                        const payload = feedbackDraft.buildPayload(1);
                        if (!payload) return;
                        action.mutate({ path: "/request-changes", body: { feedback: payload.message, mentions: payload.mentions } });
                        feedbackDraft.reset();
                      }}
                    >
                      Request changes
                    </Button>
                  </>
                ) : null}
                {a.approve ? (
                  <>
                    <Textarea placeholder="Review notes (optional)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                    <Button type="button" onClick={() => setApproveChecklistOpen(true)}>Approve</Button>
                    <VerificationChecklistDialog
                      open={approveChecklistOpen}
                      onOpenChange={setApproveChecklistOpen}
                      title="Reviewer verification"
                      subtitle={`${integration.exchangeName} · ${integration.integrationType}`}
                      items={reviewChecklistItems}
                      supportedFilesHref={supportedFilesHref}
                      confirmLabel="Approve integration"
                      pending={action.isPending}
                      onConfirm={(checklist) => {
                        action.mutate(
                          { path: "/approve", body: { reviewNotes, checklist } },
                          { onSuccess: () => setApproveChecklistOpen(false) },
                        );
                      }}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
            {integration.mintlifyStatus === "Published" ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Mintlify marked published
                  {integration.mintlifyPublishedByName ? ` by ${integration.mintlifyPublishedByName}` : ""}
                  {integration.mintlifyPublishedAt ? ` · ${formatWhen(integration.mintlifyPublishedAt)}` : ""}
                </p>
                {integration.mintlifyUrl ? (
                  <a href={integration.mintlifyUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    Open in Mintlify
                  </a>
                ) : null}
              </div>
            ) : null}
            {a.confirmMintlify ? (
              <div id="is-confirm-publication" className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium text-foreground/90">Publication</p>
                <p className="text-sm text-muted-foreground">Publish on the KoinX website, then confirm with the public documentation URL.</p>
                <Input
                  placeholder={defaultIntegrationWebsiteUrl(integration.exchangeName) || "https://www.koinx.com/integration/…"}
                  value={mintlifyUrl}
                  onChange={(e) => {
                    setMintlifyUrl(e.target.value);
                    setMintlifyUrlError("");
                  }}
                  aria-invalid={Boolean(mintlifyUrlError)}
                />
                {mintlifyUrlError ? <p className="text-sm text-destructive">{mintlifyUrlError}</p> : null}
                <Input placeholder="Publication notes (optional)" value={mintlifyNotes} onChange={(e) => setMintlifyNotes(e.target.value)} />
                <Button
                  type="button"
                  onClick={() => {
                    const url = mintlifyUrl.trim();
                    if (!isValidMintlifyUrl(url)) {
                      setMintlifyUrlError("Add the published website URL before confirming publication.");
                      return;
                    }
                    if (!window.confirm("Confirm that this integration is published on the website?")) return;
                    action.mutate({ path: "/confirm-mintlify", body: { notes: mintlifyNotes, mintlifyUrl: url } });
                  }}
                >
                  Confirm publication
                </Button>
              </div>
            ) : null}
            {a.assignTech && integration.workflowStatus === "Mintlify Published" ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium text-foreground/90">Frontend update required</p>
                <p className="text-sm text-muted-foreground">The documentation has been published. Assign the frontend update to a Tech Agent.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={techAgentId || undefined} onValueChange={setTechAgentId}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Tech Agent" /></SelectTrigger>
                    <SelectContent>
                      {techAgents.data?.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button disabled={!techAgentId} onClick={() => action.mutate({ path: "/assign-tech", body: { techAgentId } })}>Assign frontend update</Button>
                </div>
              </div>
            ) : null}
            {a.reassignTech ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium text-foreground/90">Reassign Tech Agent</p>
                <p className="text-sm text-muted-foreground">
                  Currently assigned to <strong>{integration.assignedTechAgentName || "—"}</strong>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={techAgentId || undefined} onValueChange={setTechAgentId}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Tech Agent" /></SelectTrigger>
                    <SelectContent>
                      {techAgents.data?.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!techAgentId || techAgentId === integration.assignedTechAgentId}
                    onClick={() => action.mutate({ path: "/reassign-tech", body: { techAgentId } })}
                  >
                    Change Tech Agent
                  </Button>
                </div>
              </div>
            ) : null}
            {a.respondClarification ? (
              <div className="space-y-2 border-t pt-3">
                <HubMentionTextarea
                  scope="integration_step"
                  recordId={integration.id}
                  value={clarificationResponseDraft.value}
                  onValueChange={clarificationResponseDraft.setValue}
                  mentionRefs={clarificationResponseDraft.mentionRefs}
                  onMentionRefsChange={clarificationResponseDraft.setMentionRefs}
                  placeholder="Response to clarification. Type @ to mention someone."
                />
                <Button
                  disabled={!clarificationResponseDraft.value.trim()}
                  onClick={() => {
                    const payload = clarificationResponseDraft.buildPayload(1);
                    if (!payload) return;
                    action.mutate({
                      path: "/respond-clarification",
                      body: { response: payload.message, mentions: payload.mentions },
                    });
                    clarificationResponseDraft.reset();
                  }}
                >
                  Respond to clarification
                </Button>
              </div>
            ) : null}
            {a.overrideCompleteFrontend ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm text-amber-800">Frontend task is with {integration.assignedTechAgentName}. Admins/supervisors may complete it with a logged reason.</p>
                <Button variant="outline" onClick={() => setOverrideCompleteOpen(true)}>Complete on behalf of Tech Agent</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!readOnly && (a.requestClarification || a.completeFrontend) ? (
        <Card>
          <CardHeader><CardTitle>Your frontend task</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {a.requestClarification ? (
              <>
                <HubMentionTextarea
                  scope="integration_step"
                  recordId={integration.id}
                  value={clarificationDraft.value}
                  onValueChange={clarificationDraft.setValue}
                  mentionRefs={clarificationDraft.mentionRefs}
                  onMentionRefsChange={clarificationDraft.setMentionRefs}
                  placeholder="Clarification comment. Type @ to mention someone."
                />
                <Button
                  variant="outline"
                  disabled={!clarificationDraft.value.trim()}
                  onClick={() => {
                    const payload = clarificationDraft.buildPayload(1);
                    if (!payload) return;
                    action.mutate({ path: "/request-clarification", body: { comment: payload.message, mentions: payload.mentions } });
                    clarificationDraft.reset();
                  }}
                >
                  Request clarification
                </Button>
              </>
            ) : null}
            {a.completeFrontend ? (
              <Button onClick={() => setFrontendCompleteOpen(true)}>Mark frontend updated</Button>
            ) : null}
            {a.overrideCompleteFrontend ? (
              <Button variant="outline" onClick={() => setOverrideCompleteOpen(true)}>Complete on behalf of Tech Agent</Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={overrideCompleteOpen} onOpenChange={setOverrideCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete frontend update for Tech Agent?</DialogTitle>
            <DialogDescription>
              You are updating a task assigned to {integration.assignedTechAgentName || "a Tech Agent"}. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideCompleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!overrideReason.trim()}
              onClick={() =>
                action.mutate(
                  { path: "/complete-frontend", body: { technicalNotes: techNotes, overrideReason } },
                  { onSuccess: () => setOverrideCompleteOpen(false) },
                )
              }
            >
              Accept and mark updated
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={frontendCompleteOpen} onOpenChange={setFrontendCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark frontend update as completed?</DialogTitle>
            <DialogDescription>Optional note for the integration record.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Frontend note (optional)" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFrontendCompleteOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                action.mutate(
                  { path: "/complete-frontend", body: { technicalNotes: techNotes } },
                  { onSuccess: () => setFrontendCompleteOpen(false) },
                )
              }
            >
              Confirm frontend updated
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {managementView && publishedQuiet && verificationHistory[0] ? (
        <div className="text-sm text-muted-foreground">
          <p>
            Last verified {formatWhen(verificationHistory[0].verifiedAt)} by {verificationHistory[0].verifiedByName}
          </p>
          {verificationHistory.length > 1 ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-primary hover:underline"
              onClick={() => setVerificationHistoryOpen((o) => !o)}
            >
              {verificationHistoryOpen ? "Hide previous verifications" : `Previous verifications (${verificationHistory.length - 1} older)`}
            </button>
          ) : null}
        </div>
      ) : null}

      {verificationHistory.length > 0 && publishedQuiet && verificationHistoryOpen ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Previous verifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {verificationHistory.slice(1).map((v) => (
              <div key={`${v.documentVersion}-${v.verifiedAt}`} className="border-b border-border/60 pb-2 last:border-0">
                <p className="font-medium text-foreground">
                  Version {v.documentVersion} · {v.integrationType}
                </p>
                <p className="text-muted-foreground">
                  Verified by {v.verifiedByName} · {formatWhen(v.verifiedAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
        </div>

        {managementView ? (
          <aside className="hidden min-w-0 lg:block lg:sticky lg:top-4 lg:self-start">
            <IntegrationStepsHistoryPanel activity={activity} versions={versions} />
          </aside>
        ) : null}
      </div>

      {managementView ? (
        <div className="lg:hidden">
          <IntegrationStepsHistoryPanel activity={activity} versions={versions} />
        </div>
      ) : null}
    </div>
  );
}

export function IntegrationStepsRoutes() {
  return (
    <IntegrationStepsTabsProvider>
      <Routes>
        <Route path="steps-window" element={<IntegrationStepsEditorWindowPage />} />
        <Route element={<IntegrationStepsLayout />}>
          <Route path="dashboard" element={<IntegrationStepsDashboardPage />} />
          <Route path="tracker" element={<IntegrationTrackerPage />} />
          <Route path="library" element={<Navigate to="/integration-steps/tracker" replace />} />
          <Route path="reviews" element={<IntegrationTasksPage />} />
          <Route path="tasks" element={<IntegrationTasksPage />} />
          <Route path="new" element={<IntegrationFormPage />} />
          <Route index element={<IntegrationStepsDashboardPage />} />
          <Route path=":id/edit" element={<IntegrationEditPage />} />
          <Route path=":id" element={<IntegrationDetailPage />} />
        </Route>
      </Routes>
    </IntegrationStepsTabsProvider>
  );
}
