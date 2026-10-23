import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompactFilterStat } from "@/components/compact-filter-stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { externalLinkProps, resolveWorkingUrl } from "@/lib/documentation-links";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { ReportIssueButton } from "@/components/report-issue-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { formatOptionalWhen } from "@/lib/format-optional-when";
import { GuideUpdateReasonFields } from "@/components/guide-update-reason-fields";
import { isGuideUpdateReasonReadyForPublish } from "@/lib/guide-update-reason";
import { STALE } from "@/lib/query-client";
import { DocumentationDetailCard } from "@/components/documentation-detail-card";
import { LifecycleStatusBadge, MetadataChip } from "@/components/detail-layout-bits";
import {
  productGuideTitleBadge,
  productGuideWasEverPublished,
  publishedMetadataBadgeClass,
} from "@/lib/record-detail-status";
import { productGuidePublicationPhase } from "@/lib/documentation-publication";
import { ExternalDocumentationPanel } from "@/components/external-documentation-panel";
import { SmartReturnReminder } from "@/components/smart-return-reminder";
import type { DocumentationSource } from "@/lib/documentation-links";
import { normalizeDocumentationSource } from "@/lib/documentation-links";
import { formatGuideUpdateReasonDisplay } from "@/lib/guide-update-reason";
import {
  ProductGuideAgentFeedbackDetailPage,
  ProductGuideAgentFeedbackPage,
} from "@/pages/product-guide-agent-feedback";
import { ProductGuideDailyReviewFormPage, ProductGuideDailyReviewPage } from "@/pages/product-guide-daily-review";
import { GuideWorkflowPanel, useGuideWorkflowViewer } from "@/components/guide-workflow-panel";
import { ProductGuideHistoryPanel } from "@/components/product-guide-history-panel";
import { guideStatusBadgeLabel } from "@/lib/guide-workflow";
import { markMentionsRead } from "@/lib/mention-api";
import {
  ProductGuideTabLink,
  ProductGuideTabsProvider,
  ProductGuidesLayout,
  useProductGuideTabs,
} from "@/components/product-guide-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PeriodicAccuracyReviewDialog } from "@/components/periodic-accuracy-review-dialog";
import { VerificationChecklistDialog } from "@/components/verification-checklist-dialog";
import type { DocumentationWorkflowTask } from "@/components/documentation-verification-task-row";
import {
  DocumentationTaskList,
  PRODUCT_GUIDE_TASK_GROUPS,
  TaskSortSelect,
} from "@/components/my-tasks-workspace";
import { comparePeriodicReviews, parseTaskRecordTitle, type TaskSortOption } from "@/lib/my-tasks-sort";
import { ChevronRight } from "lucide-react";
import { productGuideSectionAttention } from "@/lib/product-guide-section-attention";
import { READY_PUBLISH_CHECKLIST_ITEMS } from "@/lib/ready-publish-checklist";
import { ConfirmMintlifyUpdatesDialog } from "@/components/confirm-mintlify-updates-dialog";
import { DraftDocumentationWorkflowBar } from "@/components/draft-documentation-workflow-bar";
import { ProductGuideCategorySelect } from "@/components/product-guide-category-select";
import {
  PRODUCT_GUIDE_CATEGORY_OPTIONS,
  formatGuideCategoryDetail,
  groupProductGuidesByCategory,
  resolveProductGuideCategoryGroup,
} from "@/lib/product-guide-categories";
import { toKoinxPublishedDocumentationUrl } from "@/lib/koinx-published-url";

export type ProductGuide = {
  id: string;
  title: string;
  productArea: string;
  summary: string;
  updateReason?: string;
  documentationSource?: DocumentationSource;
  workingDocUrl?: string;
  content?: string;
  contentDoc?: unknown;
  status: string;
  ownerId?: string;
  ownerName: string;
  submittedByName?: string;
  mintlifyUrl?: string;
  publishedAt?: string;
  lastReviewedDate?: string;
  nextReviewDate?: string;
  reviewDue?: boolean;
  slaState?: string;
  slaTimer?: string | null;
  reviewFeedback?: string;
  updatedAt?: string;
  actions?: {
    edit: boolean;
    submit: boolean;
    review: boolean;
    publish: boolean;
    accuracyReview?: boolean;
    beginUpdate?: boolean;
    continueUpdate?: boolean;
    discardUpdate?: boolean;
    submitPending?: boolean;
    publishPending?: boolean;
    confirmMintlifyUpdates?: boolean;
    returnDocumentationToDraft?: boolean;
  };
  hasPendingUpdate?: boolean;
  pendingUpdateStatus?: "Editing" | "Ready to Publish" | null;
  pendingUpdate?: {
    active: true;
    status: "Editing" | "Ready to Publish";
    title?: string;
    productArea?: string;
    summary?: string;
    updateReason?: string;
    documentationSource?: DocumentationSource;
    workingDocUrl?: string;
    content?: string;
    contentDoc?: unknown;
    mintlifyUrl?: string;
    version?: number;
  } | null;
  /** Role-based workflow queue — not permission-based; set by API. */
  requiresPersonalAttention?: boolean;
  /** Feature Impact rollout queue only; excludes Published accuracy review. */
  requiresFeatureImpactAttention?: boolean;
  requiresUpdateReason?: boolean;
};

export type FeatureImpactContext = {
  id: string;
  name: string;
  reason?: string;
};

function isValidMintlifyUrl(value: string) {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Matches server `canManageProductGuides` (Admin/Supervisor + guides.manage). */
function canManageProductGuidesClient(readOnly: boolean, can: (...keys: string[]) => boolean, roleKey?: string) {
  if (readOnly) return false;
  if (roleKey === "admin" || roleKey === "supervisor") return true;
  return can("guides.manage");
}

function shouldShowGuideChangeTracking(guide: ProductGuide, updating: boolean, draftLike: boolean): boolean {
  if (updating) return true;
  if (!draftLike) return false;
  return Boolean((guide.updateReason || "").trim());
}

function productGuideDetailMode(guide: ProductGuide) {
  const publishedQuiet = guide.status === "Published" && !guide.pendingUpdate?.active;
  const updating = Boolean(guide.pendingUpdate?.active);
  const pendingReady = guide.pendingUpdate?.status === "Ready to Publish";
  const draftLike = !publishedQuiet && guide.status !== "Published";
  return { publishedQuiet, updating, pendingReady, draftLike };
}

function publishedGuideUpdateControl(guide: ProductGuide, canManage: boolean) {
  if (!canManage || guide.status !== "Published") return null;
  const hasPending = Boolean(guide.pendingUpdate?.active);
  const canBegin = guide.actions?.beginUpdate ?? !hasPending;
  const canContinue = guide.actions?.continueUpdate ?? hasPending;
  if (!canBegin && !canContinue) return null;
  return { resume: Boolean(canContinue && hasPending) };
}

function UpdateStatusBadge({ guide }: { guide: ProductGuide }) {
  if (!guide.hasPendingUpdate || !guide.pendingUpdateStatus) {
    return <span className="block text-center text-muted-foreground">—</span>;
  }
  if (guide.pendingUpdateStatus === "Ready to Publish") {
    return (
      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-100">
        Update ready
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-100">
      Updating
    </span>
  );
}

function StatusPill({ value, sla }: { value: string; sla?: string }) {
  const tone =
    value === "Published"
      ? "bg-emerald-50 text-emerald-800"
      : value === "Changes Required"
        ? "bg-amber-50 text-amber-900"
        : value === "Ready to Publish" || value === "Approved — Ready to Publish"
          ? "bg-violet-50 text-violet-900"
          : "bg-muted text-foreground/90";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{guideStatusBadgeLabel(value)}</span>
      {sla && sla !== "Not Applicable" ? <span className="text-xs text-muted-foreground">SLA · {sla}</span> : null}
    </span>
  );
}

function ProductGuideWrites({ children }: { children: ReactNode }) {
  const { readOnly, can, effective } = useAuth();
  if (!canManageProductGuidesClient(readOnly, can, effective?.roleKey)) {
    return <Navigate to="/product-guides" replace />;
  }
  return children;
}

export function ProductGuidesRoutes() {
  return (
    <ProductGuideTabsProvider>
      <Routes>
        <Route element={<ProductGuidesLayout />}>
          <Route index element={<ProductGuidesPage />} />
          <Route path="tasks" element={<ProductGuideTasksPage />} />
          <Route path="daily-review" element={<ProductGuideDailyReviewPage />} />
          <Route path="daily-review/:guideId" element={<ProductGuideDailyReviewFormPage />} />
          <Route path="agent-feedback" element={<ProductGuideAgentFeedbackPage />} />
          <Route path="agent-feedback/:guideId" element={<ProductGuideAgentFeedbackDetailPage />} />
          <Route path="new" element={<ProductGuideWrites><ProductGuideFormPage /></ProductGuideWrites>} />
          <Route path=":id/edit" element={<ProductGuideWrites><ProductGuideFormPage /></ProductGuideWrites>} />
          <Route path=":id" element={<ProductGuideDetailRoute />} />
        </Route>
      </Routes>
    </ProductGuideTabsProvider>
  );
}

/** Tab workspace + beforeunload only — `useBlocker` requires a data router (we use BrowserRouter). */
function useProductGuideEditGuard(guideId: string, dirty: boolean) {
  const { registerDirty } = useProductGuideTabs();

  useEffect(() => {
    registerDirty(`edit:${guideId}`, dirty);
    return () => registerDirty(`edit:${guideId}`, false);
  }, [guideId, dirty, registerDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

function ProductGuideDetailRoute() {
  const { id } = useParams();
  return <ProductGuideDetailPage key={id} />;
}

export function ProductGuidesPage() {
  const { can, canMutate } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [slaState, setSlaState] = useState("all");
  const [reviewDueOnly, setReviewDueOnly] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("all");
  const [categoryGroup, setCategoryGroup] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const stats = useQuery({ queryKey: ["pg-stats"], queryFn: () => api<{ stats: Record<string, number> }>("/api/product-guides/stats"), enabled: can("guides.view") });
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (!reviewDueOnly && status !== "all") params.set("status", status);
  if (slaState !== "all") params.set("slaState", slaState);
  if (reviewDueOnly) params.set("reviewDue", "true");
  if (updateStatus !== "all") params.set("updateStatus", updateStatus);
  if (categoryGroup !== "all") params.set("categoryGroup", categoryGroup);
  const list = useQuery({
    queryKey: ["product-guides", q, status, slaState, reviewDueOnly, updateStatus, categoryGroup],
    queryFn: () => api<{ guides: ProductGuide[] }>(`/api/product-guides?${params.toString()}`),
    enabled: can("guides.view"),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });
  const guideSections = useMemo(
    () => groupProductGuidesByCategory(list.data?.guides ?? [], categoryGroup),
    [list.data?.guides, categoryGroup],
  );
  const categoryFilterOptions = useMemo(() => {
    const extras = new Set<string>();
    for (const guide of list.data?.guides ?? []) {
      const group = resolveProductGuideCategoryGroup(guide.productArea);
      if (!(PRODUCT_GUIDE_CATEGORY_OPTIONS as readonly string[]).includes(group)) extras.add(group);
    }
    return [...PRODUCT_GUIDE_CATEGORY_OPTIONS, ...[...extras].sort((a, b) => a.localeCompare(b))];
  }, [list.data?.guides]);
  const allSectionsCollapsed =
    guideSections.length > 0 && guideSections.every((section) => collapsedSections[section.label]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="Product Guides"
        action={canMutate("guides.manage") ? <Link to="/product-guides/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">New guide</Link> : null}
      />
      {stats.data ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <CompactFilterStat
            label="All Guides"
            value={stats.data.stats.total}
            active={status === "all" && slaState === "all" && !reviewDueOnly && updateStatus === "all"}
            onClick={() => {
              if (status === "all" && slaState === "all" && !reviewDueOnly && updateStatus === "all") return;
              setStatus("all");
              setSlaState("all");
              setReviewDueOnly(false);
              setUpdateStatus("all");
            }}
          />
          <CompactFilterStat
            label="Published Guides"
            value={stats.data.stats.Published || 0}
            active={status === "Published" && !reviewDueOnly && updateStatus === "all"}
            onClick={() => {
              if (status === "Published" && !reviewDueOnly) {
                setStatus("all");
              } else {
                setStatus("Published");
                setSlaState("all");
                setReviewDueOnly(false);
                setUpdateStatus("all");
              }
            }}
          />
          <CompactFilterStat
            label="Draft"
            value={stats.data.stats.Draft || 0}
            active={status === "Draft" && !reviewDueOnly}
            onClick={() => {
              if (status === "Draft" && !reviewDueOnly) {
                setStatus("all");
              } else {
                setStatus("Draft");
                setSlaState("all");
                setReviewDueOnly(false);
              }
            }}
          />
          <CompactFilterStat
            label="Updating"
            value={stats.data.stats.updating || 0}
            active={updateStatus === "active"}
            onClick={() => {
              if (updateStatus === "active") {
                setUpdateStatus("all");
              } else {
                setUpdateStatus("active");
                setReviewDueOnly(false);
              }
            }}
          />
          <CompactFilterStat
            label="Ready to Publish"
            labelClassName="whitespace-nowrap"
            value={stats.data.stats["Ready to Publish"] || 0}
            active={status === "Ready to Publish" && !reviewDueOnly}
            onClick={() => {
              if (status === "Ready to Publish" && !reviewDueOnly) {
                setStatus("all");
              } else {
                setStatus("Ready to Publish");
                setSlaState("all");
                setReviewDueOnly(false);
              }
            }}
          />
          <CompactFilterStat
            label="Periodic Review Due"
            labelClassName="whitespace-nowrap"
            value={stats.data.stats.reviewDue || 0}
            active={reviewDueOnly}
            onClick={() => {
              if (reviewDueOnly) {
                setReviewDueOnly(false);
              } else {
                setReviewDueOnly(true);
                setStatus("all");
                setSlaState("all");
              }
            }}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Input
          className="min-w-0 md:min-w-[12rem] md:flex-1"
          placeholder="Search title, category, content"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={categoryGroup} onValueChange={setCategoryGroup}>
          <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryFilterOptions.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={reviewDueOnly ? "all" : status}
          onValueChange={(v) => {
            setReviewDueOnly(false);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Draft", "Changes Required", "Ready to Publish", "Published"].map((item) => (
              <SelectItem key={item} value={item}>{item === "Ready to Publish" ? "Ready to publish" : item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={updateStatus}
          onValueChange={(v) => {
            setReviewDueOnly(false);
            setUpdateStatus(v);
          }}
        >
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Update status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All updates</SelectItem>
            <SelectItem value="active">Any active update</SelectItem>
            <SelectItem value="editing">Updating</SelectItem>
            <SelectItem value="ready">Update ready</SelectItem>
            <SelectItem value="none">No active update</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={slaState}
          onValueChange={(v) => {
            setReviewDueOnly(false);
            setSlaState(v);
          }}
        >
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="SLA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SLA states</SelectItem>
            {["On Track", "Due Soon", "Overdue", "Not Applicable"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 whitespace-nowrap"
          disabled={guideSections.length === 0}
          onClick={() => {
            if (allSectionsCollapsed) {
              setCollapsedSections({});
              return;
            }
            setCollapsedSections(Object.fromEntries(guideSections.map((section) => [section.label, true])));
          }}
        >
          {allSectionsCollapsed ? "Expand all" : "Collapse all"}
        </Button>
      </div>
      {(list.isPending && !list.data) ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.guides.length === 0 ? <Empty title="No product guides yet" body="Create your first guide to start building the knowledge library." /> : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Guide</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-center font-medium">Update status</th>
              <th className="px-3 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {guideSections.map((section) => {
              const collapsed = Boolean(collapsedSections[section.label]);
              const attention = productGuideSectionAttention(section.guides);
              return (
                <Fragment key={section.label}>
                  <tr
                    className="border-y border-primary/35 bg-primary/10 cursor-pointer select-none hover:bg-primary/15"
                    onClick={() =>
                      setCollapsedSections((prev) => ({ ...prev, [section.label]: !prev[section.label] }))
                    }
                  >
                    <td
                      colSpan={5}
                      className="border-l-4 border-primary px-4 py-2.5 text-sm font-semibold tracking-wide text-primary"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${collapsed ? "" : "rotate-90"}`}
                            aria-hidden
                          />
                          <span className="truncate">{section.label}</span>
                          <span className="font-normal text-primary/70">({section.guides.length})</span>
                        </span>
                        {attention !== "none" ? (
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-primary/10 ${
                              attention === "red" ? "bg-red-500" : "bg-amber-400"
                            }`}
                            title={
                              attention === "red"
                                ? "Needs attention in this category"
                                : "Items pending review or publish in this category"
                            }
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {!collapsed
                    ? section.guides.map((guide) => (
                        <tr key={guide.id} className="border-t border-border/60 hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <ProductGuideTabLink
                              id={guide.id}
                              title={guide.title}
                              className="font-medium text-foreground hover:text-primary text-left"
                            >
                              {guide.title}
                            </ProductGuideTabLink>
                            <p className="mt-0.5 text-xs text-muted-foreground">{guide.summary}</p>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {formatGuideCategoryDetail(guide.productArea)}
                          </td>
                          <td className="px-3 py-3">
                            <StatusPill value={guide.status} sla={guide.slaTimer || guide.slaState} />
                          </td>
                          <td className="px-3 py-3 text-center"><UpdateStatusBadge guide={guide} /></td>
                          <td className="px-3 py-3">{formatWhen(guide.updatedAt)}</td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type PeriodicReviewTask = {
  guideId: string;
  guideTitle: string;
  productArea: string;
  dueDate: string;
  daysUntilDue: number;
  overdue: boolean;
  overdueDays: number;
  phase: "upcoming" | "acknowledged" | "completed";
  acknowledgedAt?: string;
  acknowledgedByName?: string;
  completedAt?: string;
  completedByName?: string;
  outcome?: string;
  canAcknowledge: boolean;
  canCompleteReview: boolean;
};

function taskStatusLabel(task: PeriodicReviewTask) {
  if (task.phase === "completed") return "Completed";
  if (task.overdue) return `Overdue · ${task.overdueDays} day${task.overdueDays === 1 ? "" : "s"}`;
  if (task.phase === "acknowledged") return "Acknowledged";
  if (task.daysUntilDue === 0) return "Due today";
  if (task.daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${task.daysUntilDue} days`;
}

export function ProductGuideTasksPage() {
  const { can, readOnly } = useAuth();
  const { openGuide } = useProductGuideTabs();
  const [sortBy, setSortBy] = useState<TaskSortOption>("closest_sla");
  const [searchParams] = useSearchParams();
  const highlightGuide = searchParams.get("guide");
  const client = useQueryClient();
  const workflowTasks = useQuery({
    queryKey: ["pg-workflow-tasks"],
    queryFn: () =>
      api<{ tasks: DocumentationWorkflowTask[]; verificationTasks: DocumentationWorkflowTask[] }>(
        "/api/product-guides/workflow-tasks",
      ),
    enabled: can("guides.view"),
    staleTime: STALE.reference,
  });
  const docTasks = workflowTasks.data?.tasks ?? workflowTasks.data?.verificationTasks ?? [];
  const tasks = useQuery({
    queryKey: ["pg-review-tasks", "open"],
    queryFn: () => api<{ tasks: PeriodicReviewTask[] }>("/api/product-guides/review-tasks?filter=open"),
    enabled: can("guides.view"),
    staleTime: STALE.reference,
  });
  const periodicTasks = [...(tasks.data?.tasks ?? [])].sort((a, b) => comparePeriodicReviews(a, b, sortBy));
  const acknowledge = useMutation({
    mutationFn: (guideId: string) =>
      api(`/api/product-guides/${guideId}/review-task/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      void client.invalidateQueries({ queryKey: ["pg-review-tasks"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const hasPeriodic = periodicTasks.length > 0;
  const showEmpty = !workflowTasks.isPending && docTasks.length === 0 && !tasks.isPending && !hasPeriodic;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Knowledge" title="Product Guides" />
      <div className="flex justify-end">
        <TaskSortSelect value={sortBy} onChange={setSortBy} />
      </div>
      {workflowTasks.isPending && !workflowTasks.data ? <LoadingBlock /> : null}
      {workflowTasks.isError ? <ErrorBlock message={workflowTasks.error.message} /> : null}
      <DocumentationTaskList
        tasks={docTasks}
        sortBy={sortBy}
        groups={PRODUCT_GUIDE_TASK_GROUPS}
        onOpenTask={(task) => openGuide(task.recordId, parseTaskRecordTitle(task))}
      />
      {showEmpty ? (
        <Empty
          title="No open tasks"
          body="Documentation workflow tasks and periodic reviews will appear here when action is required."
        />
      ) : null}
      {tasks.isPending && !tasks.data ? <LoadingBlock /> : null}
      {tasks.isError ? <ErrorBlock message={tasks.error.message} /> : null}
      {hasPeriodic ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Periodic accuracy reviews ({periodicTasks.length})
          </h2>
          <div className="overflow-hidden rounded-xl border bg-card divide-y">
            {periodicTasks.map((task) => (
              <div
                key={`${task.guideId}:${task.dueDate}`}
                className={highlightGuide === task.guideId ? "ring-2 ring-inset ring-primary/40" : undefined}
              >
                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() =>
                      openGuide(
                        task.guideId,
                        task.guideTitle,
                        task.phase !== "completed" ? "?review=1" : undefined,
                      )
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.guideTitle}</p>
                      <p className="truncate text-xs text-muted-foreground">{task.productArea}</p>
                    </div>
                    <span
                      className={
                        task.overdue
                          ? "shrink-0 text-xs font-medium text-red-700 dark:text-red-300"
                          : "shrink-0 text-xs text-muted-foreground"
                      }
                    >
                      {taskStatusLabel(task)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-2 pl-0 sm:pl-0">
                    {task.canAcknowledge && !readOnly ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => acknowledge.mutate(task.guideId)}>
                        Acknowledge
                      </Button>
                    ) : null}
                    {task.phase !== "completed" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openGuide(task.guideId, task.guideTitle, "?review=1")}
                      >
                        Review
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type GuideActivity = {
  id: string;
  action?: string;
  summary: string;
  actorName: string;
  createdAt: string;
  meta?: { feedback?: string };
};

function reviewFeedbackHistory(activity: GuideActivity[], latestOnRecord?: string) {
  const fromLog = activity
    .filter((item) => item.action === "guide.changes_requested")
    .map((item) => {
      const text = typeof item.meta?.feedback === "string" ? item.meta.feedback.trim() : "";
      if (!text) return null;
      return { id: item.id, feedback: text, actorName: item.actorName, createdAt: item.createdAt };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (fromLog.length) return fromLog;
  const latest = latestOnRecord?.trim();
  if (!latest) return [];
  return [{ id: "latest", feedback: latest, actorName: "Reviewer", createdAt: "" }];
}

export function ProductGuideDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { readOnly, effective, can } = useAuth();
  const canManageGuides = canManageProductGuidesClient(readOnly, can, effective?.roleKey);
  const canDeleteGuide =
    !readOnly && (effective?.roleKey === "admin" || effective?.roleKey === "supervisor");
  const { setGuideTitle } = useProductGuideTabs();
  const viewer = useGuideWorkflowViewer();
  const client = useQueryClient();
  const [mintlifyUrl, setMintlifyUrl] = useState("");
  const [pendingMintlifyUrl, setPendingMintlifyUrl] = useState("");
  const [publishUrlError, setPublishUrlError] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [readyPublishOpen, setReadyPublishOpen] = useState(false);
  const [pendingReadyOpen, setPendingReadyOpen] = useState(false);
  const [beginUpdateOpen, setBeginUpdateOpen] = useState(false);
  const [discardUpdateOpen, setDiscardUpdateOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [confirmMintlifyOpen, setConfirmMintlifyOpen] = useState(false);
  const [returnToDraftOpen, setReturnToDraftOpen] = useState(false);
  const [deleteGuideOpen, setDeleteGuideOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [verifyUpdateReason, setVerifyUpdateReason] = useState("");
  const pendingEditOpen = searchParams.get("pendingEdit") === "1";
  const draftEditOpen = searchParams.get("draftEdit") === "1";
  const presetUpdateReason = searchParams.get("updateReason");
  const [editTitle, setEditTitle] = useState("");
  const [editProductArea, setEditProductArea] = useState("");
  const [editUpdateReason, setEditUpdateReason] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editPendingVersion, setEditPendingVersion] = useState(1);
  const query = useQuery({
    queryKey: ["product-guide", id],
    queryFn: () =>
      api<{
        guide: ProductGuide;
        readyVerification?: {
          contentVersionAt: string;
          verifiedByName: string;
          verifiedAt: string;
          checklist: Record<string, { result: string; naReason?: string }>;
        } | null;
        activity: GuideActivity[];
        revisions: { id: string; note: string; savedByName: string; createdAt: string }[];
        featureImpacts: { id: string; name: string; reason: string; progress: { published: number; total: number } }[];
      }>(`/api/product-guides/${id}`),
    enabled: Boolean(id),
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!id || readOnly) return;
    void markMentionsRead("product_guide", id, { queryClient: client, dashboardUserId: effective?.id }).catch(
      () => undefined,
    );
  }, [id, readOnly, client, effective?.id]);

  const submit = useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body?: object; method?: string }) =>
      api(`/api/product-guides/${id}${path}`, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      toast.success("Guide updated");
      void client.invalidateQueries({ queryKey: ["product-guide", id] });
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      void client.invalidateQueries({ queryKey: ["pg-stats"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["pg-review-tasks"] });
      void client.invalidateQueries({ queryKey: ["pg-workflow-tasks"] });
      void client.invalidateQueries({ queryKey: ["is-my-tasks"] });
      setReviewDialogOpen(false);
      setBeginUpdateOpen(false);
      setDiscardUpdateOpen(false);
      setConfirmMintlifyOpen(false);
      setReturnToDraftOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteGuide = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing guide id");
      return api(`/api/product-guides/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
    },
    onSuccess: () => {
      toast.success("Guide deleted");
      setDeleteGuideOpen(false);
      setDeleteReason("");
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      void client.invalidateQueries({ queryKey: ["pg-stats"] });
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
      navigate("/product-guides");
    },
    onError: (error) => toast.error(error.message),
  });

  const confirmMintlifyUpdates = useMutation({
    mutationFn: () => api(`/api/product-guides/${id}/mintlify-updates/confirm`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Submitted for verification");
      setConfirmMintlifyOpen(false);
      void client.invalidateQueries({ queryKey: ["product-guide", id] });
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      void client.invalidateQueries({ queryKey: ["pg-workflow-tasks"] });
      void client.invalidateQueries({ queryKey: ["is-my-tasks"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const fromFeatureImpact = (location.state as { fromFeatureImpact?: FeatureImpactContext } | null)?.fromFeatureImpact;
  const featureImpacts = query.data?.featureImpacts ?? [];
  const activity = query.data?.activity ?? [];
  const guide = query.data?.guide;
  const publishedUpdate = useMemo(
    () => (guide ? publishedGuideUpdateControl(guide, canManageGuides) : null),
    [guide, canManageGuides],
  );

  useEffect(() => {
    if (!guide) return;
    setGuideTitle(guide.id, guide.title);
    setMintlifyUrl(guide.mintlifyUrl || "");
    const pendingUrl = guide.pendingUpdate?.mintlifyUrl;
    setPendingMintlifyUrl(pendingUrl || guide.mintlifyUrl || "");
    setPublishUrlError("");
  }, [guide?.id, guide?.mintlifyUrl, guide?.title, guide?.pendingUpdate, setGuideTitle]);

  useEffect(() => {
    if (searchParams.get("review") === "1" && guide?.actions?.accuracyReview) {
      setReviewDialogOpen(true);
    }
  }, [searchParams, guide?.actions?.accuracyReview]);

  useEffect(() => {
    if (!guide) return;
    if (pendingReadyOpen || readyPublishOpen) {
      setVerifyUpdateReason(guide.pendingUpdate?.updateReason || guide.updateReason || "");
    }
  }, [guide, pendingReadyOpen, readyPublishOpen]);

  useEffect(() => {
    if (!guide) return;
    if (guide.pendingUpdate?.active) {
      const pending = guide.pendingUpdate;
      setEditTitle(pending.title || guide.title);
      setEditProductArea(pending.productArea || guide.productArea);
      setEditUpdateReason(pending.updateReason || presetUpdateReason || "");
      setEditSummary(pending.summary || "");
      setEditPendingVersion(pending.version || 1);
    } else {
      setEditTitle(guide.title);
      setEditProductArea(guide.productArea);
      setEditUpdateReason(guide.updateReason || "");
      setEditSummary(guide.summary || "");
    }
  }, [
    guide?.id,
    guide?.title,
    guide?.productArea,
    guide?.summary,
    guide?.updateReason,
    guide?.pendingUpdate?.version,
    presetUpdateReason,
  ]);

  const saveGuideMetadata = useMutation({
    mutationFn: async (): Promise<{ version?: number } | void> => {
      if (!id) throw new Error("Missing guide id");
      if (guide?.pendingUpdate?.active) {
        if (!isGuideUpdateReasonReadyForPublish(editUpdateReason)) {
          throw new Error("Select a reason for this update before saving.");
        }
        return api<{ version?: number }>(`/api/product-guides/${id}/pending-update`, {
          method: "PATCH",
          body: JSON.stringify({
            title: editTitle,
            productArea: editProductArea,
            updateReason: editUpdateReason,
            summary: editSummary,
            version: editPendingVersion,
          }),
        });
      }
      await api(`/api/product-guides/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          productArea: editProductArea,
          summary: editSummary,
        }),
      });
    },
    onSuccess: (data: { version?: number } | void) => {
      if (data && typeof data === "object" && "version" in data && data.version) {
        setEditPendingVersion(data.version);
      }
      toast.success("Guide saved");
      void client.invalidateQueries({ queryKey: ["product-guide", id] });
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      const next = new URLSearchParams(searchParams);
      next.delete("pendingEdit");
      next.delete("draftEdit");
      next.delete("updateReason");
      setSearchParams(next, { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });

  function closeGuideMetadataEdit() {
    const next = new URLSearchParams(searchParams);
    next.delete("pendingEdit");
    next.delete("draftEdit");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (searchParams.get("verify") !== "1" || !guide || readOnly) return;
    setVerifyUpdateReason(guide.pendingUpdate?.updateReason || guide.updateReason || "");
    if (guide.pendingUpdate?.active && guide.actions?.submitPending) setPendingReadyOpen(true);
    else if (guide.actions?.submit) setReadyPublishOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("verify");
    setSearchParams(next, { replace: true });
  }, [searchParams, guide, readOnly, setSearchParams]);

  const feedbackHistory = useMemo(
    () => reviewFeedbackHistory(activity, guide?.reviewFeedback),
    [activity, guide?.reviewFeedback],
  );

  const primaryImpact = useMemo(() => {
    if (fromFeatureImpact) {
      const match = featureImpacts.find((i) => i.id === fromFeatureImpact.id);
      return match ? { id: match.id, name: match.name, reason: match.reason } : fromFeatureImpact;
    }
    if (featureImpacts.length === 1) {
      const only = featureImpacts[0];
      return { id: only.id, name: only.name, reason: only.reason };
    }
    return null;
  }, [fromFeatureImpact, featureImpacts]);

  const relatedImpacts = primaryImpact
    ? featureImpacts.filter((i) => i.id !== primaryImpact.id)
    : featureImpacts;

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data || !guide) return <ErrorBlock message={query.error?.message || "Guide not found"} />;
  const revisions = query.data.revisions;
  const { updating, pendingReady, draftLike } = productGuideDetailMode(guide);
  const submitPending = Boolean(guide.actions?.submitPending);
  const docSource = normalizeDocumentationSource(
    updating ? guide.pendingUpdate?.documentationSource : guide.documentationSource,
  );
  const publicationPhase = productGuidePublicationPhase(guide);
  const confirmedPublishedGuideUrl =
    guide.status === "Published" ? toKoinxPublishedDocumentationUrl(guide.mintlifyUrl || "") : "";
  const showSmartReturnReminder =
    !readOnly && canManageGuides && draftLike && !guide.pendingUpdate?.active;
  const titleBadge = productGuideTitleBadge({ guide, updating, pendingReady, submitPending });
  const showPublishedInMetadata = productGuideWasEverPublished(guide);
  const hasHeaderPrimaryAction =
    !readOnly &&
    canManageGuides &&
    ((guide.actions?.edit && draftLike && !updating) || (publishedUpdate && !updating));
  const showGuideMetadataEdit =
    !readOnly &&
    canManageGuides &&
    ((pendingEditOpen && updating) || (draftEditOpen && draftLike && !updating));
  const pendingDocSource = normalizeDocumentationSource(
    guide.pendingUpdate?.documentationSource || guide.documentationSource,
  );
  const pendingDocHref = resolveWorkingUrl(
    guide.pendingUpdate?.workingDocUrl || guide.workingDocUrl || "",
    "productGuides",
    pendingDocSource,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ConfirmMintlifyUpdatesDialog
        open={confirmMintlifyOpen}
        onOpenChange={setConfirmMintlifyOpen}
        pending={confirmMintlifyUpdates.isPending}
        onConfirm={() => confirmMintlifyUpdates.mutate()}
      />
      <Dialog
        open={deleteGuideOpen}
        onOpenChange={(open) => {
          setDeleteGuideOpen(open);
          if (!open) setDeleteReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this product guide?</DialogTitle>
            <DialogDescription>
              This permanently removes the guide and its activity history. Admins will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-guide-reason">Reason for deletion (required)</Label>
            <Textarea
              id="delete-guide-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              placeholder="Why is this guide being removed?"
              required
              minLength={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteGuideOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteGuide.isPending || deleteReason.trim().length < 3}
              onClick={() => deleteGuide.mutate()}
            >
              Delete guide
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
              disabled={submit.isPending}
              onClick={() => submit.mutate({ path: "/mintlify-updates/return-to-draft" })}
            >
              Return to draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {primaryImpact ? (
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product change</p>
          <p className="mt-1 font-semibold text-foreground">{primaryImpact.name}</p>
          {primaryImpact.reason ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{primaryImpact.reason}</p>
          ) : null}
          <Link
            to={`/feature-impacts/${primaryImpact.id}`}
            className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
          >
            View feature impact →
          </Link>
        </div>
      ) : null}

      {primaryImpact ? (
        <Link
          to={`/feature-impacts/${primaryImpact.id}`}
          className="inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to {primaryImpact.name}
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-primary/80 uppercase">{guide.productArea}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem]">{guide.title}</h1>
            {titleBadge ? (
              <LifecycleStatusBadge label={titleBadge.label} className={titleBadge.className} />
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {!readOnly && canManageGuides ? (
            <>
              {publishedUpdate && !updating ? (
                <Button type="button" size="sm" onClick={() => setBeginUpdateOpen(true)}>Update guide</Button>
              ) : null}
            </>
          ) : null}
          {canDeleteGuide ? (
            <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteGuideOpen(true)}>
              Delete guide
            </Button>
          ) : null}
          <ReportIssueButton
            variant={hasHeaderPrimaryAction ? "outline" : "default"}
            source={{
              sourceType: "product_guide",
              sourceId: guide.id,
              sourceTypeLabel: "Product Guide",
              sourceLabel: guide.title,
            }}
          />
        </div>
      </div>
      {guide.pendingUpdate?.active && canManageGuides ? (
        <div
          className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="font-medium text-foreground">
            {pendingReady ? "Ready to publish" : submitPending ? "Verification required" : "Updating"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {pendingReady
              ? "Verification completed. Publish the changes in your documentation source, then confirm publication here."
              : submitPending
                ? "Complete the verification checklist when your documentation changes are ready."
                : "The published guide stays live while you prepare this update."}
          </p>
          {!readOnly ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pendingReady ? (
                <>
                  <Button type="button" size="sm" onClick={() => setPublishConfirmOpen(true)}>Confirm publication</Button>
                  {guide.actions?.continueUpdate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSearchParams({ pendingEdit: "1" }, { replace: true })}
                    >
                      Return to editing
                    </Button>
                  ) : null}
                </>
              ) : submitPending ? (
                <>
                  <Button type="button" size="sm" onClick={() => setPendingReadyOpen(true)}>Verify changes</Button>
                  {guide.actions?.returnDocumentationToDraft ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setReturnToDraftOpen(true)}>
                      Return to draft
                    </Button>
                  ) : null}
                </>
              ) : (
                <DraftDocumentationWorkflowBar
                  kind="productGuides"
                  source={pendingDocSource}
                  workingDocUrl={guide.pendingUpdate?.workingDocUrl || guide.workingDocUrl || ""}
                  confirmMintlifyUpdates={Boolean(guide.actions?.confirmMintlifyUpdates)}
                  returnDocumentationToDraft={false}
                  confirmPending={confirmMintlifyUpdates.isPending}
                  onEditDetails={() => setSearchParams({ pendingEdit: "1" }, { replace: true })}
                  onMarkMintlifyComplete={() => setConfirmMintlifyOpen(true)}
                  onReturnToDraft={() => setReturnToDraftOpen(true)}
                />
              )}
              {guide.actions?.discardUpdate ? (
                <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setDiscardUpdateOpen(true)}>
                  Discard update
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {guide.pendingUpdate?.active && !canManageGuides ? (
        <p className="text-sm text-muted-foreground">An updated version is being prepared.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {showPublishedInMetadata ? (
          <MetadataChip label="Status">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${publishedMetadataBadgeClass()}`}>
              Published
            </span>
          </MetadataChip>
        ) : null}
        {guide.ownerName ? <MetadataChip label="Owner">{guide.ownerName}</MetadataChip> : null}
        {guide.updatedAt ? <MetadataChip label="Updated">{formatWhen(guide.updatedAt)}</MetadataChip> : null}
        {guide.nextReviewDate && !updating ? (
          <MetadataChip label="Next review">
            {formatCalendarDate(guide.nextReviewDate)}
            {guide.reviewDue ? " · Review due" : ""}
          </MetadataChip>
        ) : null}
        {showPublishedInMetadata && guide.publishedAt ? (
          <MetadataChip label="Last published">{formatOptionalWhen(guide.publishedAt)}</MetadataChip>
        ) : null}
        {guide.slaTimer && guide.slaTimer !== "Not Applicable" && guide.status !== "Published" ? (
          <MetadataChip label="SLA">{guide.slaTimer}</MetadataChip>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="min-w-0 space-y-4">
          <DocumentationDetailCard
            kind="productGuides"
            recordId={guide.id}
            workflowSnapshot={guide.pendingUpdate?.status || guide.status}
            source={docSource}
            workingDocUrl={guide.pendingUpdate?.workingDocUrl || guide.workingDocUrl || ""}
            confirmedPublishedUrl={confirmedPublishedGuideUrl}
            publicationPhase={publicationPhase}
            pendingUpdateOnPublished={guide.status === "Published" && updating}
            showExternalEditor={canManageGuides && !readOnly}
            layout="compact"
          />
          {showGuideMetadataEdit ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{updating ? "Update details" : "Draft details"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <ProductGuideCategorySelect value={editProductArea} onChange={setEditProductArea} />
                </div>
                {updating ? (
                  <GuideUpdateReasonFields value={editUpdateReason} onChange={setEditUpdateReason} required />
                ) : null}
                <div className="space-y-2">
                  <Label>Summary of changes</Label>
                  <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={3} />
                </div>
                {updating ? (
                  <p className="text-sm text-muted-foreground">
                    Documentation source ·{" "}
                    {pendingDocHref ? (
                      <a
                        className="font-medium text-primary no-underline hover:text-primary/90"
                        {...externalLinkProps(pendingDocHref)}
                      >
                        {pendingDocSource}
                      </a>
                    ) : (
                      <span className="text-foreground/80">{pendingDocSource} — link not configured</span>
                    )}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={saveGuideMetadata.isPending} onClick={() => saveGuideMetadata.mutate()}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={closeGuideMetadataEdit}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : canManageGuides && shouldShowGuideChangeTracking(guide, updating, draftLike) ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Change tracking</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Reason for update · </span>
                  {formatGuideUpdateReasonDisplay(guide.pendingUpdate?.updateReason || guide.updateReason)}
                </p>
                <p className="text-muted-foreground">
                  {guide.pendingUpdate?.summary || guide.summary}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <GuideWorkflowPanel guide={guide} viewer={viewer} />

          {!readOnly && guide.actions?.accuracyReview ? (
            <Card className="border-blue-200/80 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Accuracy review due</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Complete the verification checklist and record the outcome for this review cycle.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {guide.lastReviewedDate ? <p>Last reviewed: {formatCalendarDate(guide.lastReviewedDate)}</p> : null}
                  {guide.nextReviewDate ? <p>Next review: {formatCalendarDate(guide.nextReviewDate)}</p> : null}
                </div>
                <Button type="button" onClick={() => setReviewDialogOpen(true)} disabled={submit.isPending}>
                  Start accuracy review
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <PeriodicAccuracyReviewDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            guideTitle={guide.title}
            pending={submit.isPending}
            onSubmit={({ outcome, checklist, correctionNotes }) =>
              submit.mutate({
                path: "/accuracy-review",
                body: { outcome, checklist, correctionNotes },
              })
            }
          />

          {guide.actions?.confirmMintlifyUpdates && !readOnly && canManageGuides ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Prepare documentation</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Author content in Mintlify, keep metadata current in the Hub, then confirm when updates are complete.
                </p>
              </CardHeader>
              <CardContent>
                <DraftDocumentationWorkflowBar
                  kind="productGuides"
                  source={docSource}
                  workingDocUrl={guide.workingDocUrl || ""}
                  confirmMintlifyUpdates={Boolean(guide.actions?.confirmMintlifyUpdates)}
                  returnDocumentationToDraft={false}
                  confirmPending={confirmMintlifyUpdates.isPending}
                  onEditDetails={() => setSearchParams({ draftEdit: "1" }, { replace: true })}
                  onMarkMintlifyComplete={() => setConfirmMintlifyOpen(true)}
                  onReturnToDraft={() => setReturnToDraftOpen(true)}
                />
              </CardContent>
            </Card>
          ) : null}

          {!readOnly && guide.actions?.submit && !guide.pendingUpdate?.active ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setReadyPublishOpen(true)}>Verify changes</Button>
              {guide.actions?.returnDocumentationToDraft ? (
                <Button type="button" variant="outline" onClick={() => setReturnToDraftOpen(true)}>
                  Return to draft
                </Button>
              ) : null}
            </div>
          ) : null}
          {!readOnly && guide.actions?.submit ? (
            <VerificationChecklistDialog
              open={readyPublishOpen}
              onOpenChange={setReadyPublishOpen}
              title="Documentation verification"
              subtitle={guide.title}
              items={[...READY_PUBLISH_CHECKLIST_ITEMS]}
              allowUnable={false}
              confirmLabel="Complete verification"
              pending={submit.isPending}
              updateReason={
                guide.requiresUpdateReason
                  ? { variant: "guide", value: verifyUpdateReason, onChange: setVerifyUpdateReason }
                  : undefined
              }
              onConfirm={(checklist, extras) =>
                submit.mutate(
                  {
                    path: "/submit",
                    body: guide.requiresUpdateReason
                      ? { checklist, updateReason: extras?.updateReason || verifyUpdateReason }
                      : { checklist },
                  },
                  { onSuccess: () => setReadyPublishOpen(false) },
                )
              }
            />
          ) : null}
          {!readOnly && guide.actions?.submitPending ? (
            <VerificationChecklistDialog
              open={pendingReadyOpen}
              onOpenChange={setPendingReadyOpen}
              title="Documentation verification"
              subtitle={guide.title}
              items={[...READY_PUBLISH_CHECKLIST_ITEMS]}
              allowUnable={false}
              confirmLabel="Complete verification"
              pending={submit.isPending}
              updateReason={{ variant: "guide", value: verifyUpdateReason, onChange: setVerifyUpdateReason }}
              onConfirm={(checklist, extras) =>
                submit.mutate(
                  {
                    path: "/pending-update/submit",
                    body: { checklist, updateReason: extras?.updateReason || verifyUpdateReason },
                  },
                  { onSuccess: () => setPendingReadyOpen(false) },
                )
              }
            />
          ) : null}
          {!readOnly && guide.actions?.publish && !guide.pendingUpdate?.active ? (
            <Button type="button" onClick={() => setPublishConfirmOpen(true)}>Confirm publication</Button>
          ) : null}
          {showSmartReturnReminder ? (
            <SmartReturnReminder
              recordId={guide.id}
              kind="product_guide"
              source={docSource}
              readOnly={false}
              onVerify={() => {
                if (guide.pendingUpdate?.active && guide.actions?.submitPending) setPendingReadyOpen(true);
                else if (guide.actions?.submit) setReadyPublishOpen(true);
              }}
            />
          ) : null}
          <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm guide publication</DialogTitle>
                <DialogDescription>
                  Have you published the verified changes to the live documentation website?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="pg-publish-url">Published website URL</Label>
                <Input
                  id="pg-publish-url"
                  placeholder="https://www.koinx.com/guides/…"
                  value={guide.actions?.publishPending ? pendingMintlifyUrl : mintlifyUrl}
                  onChange={(e) => {
                    if (guide.actions?.publishPending) setPendingMintlifyUrl(e.target.value);
                    else setMintlifyUrl(e.target.value);
                    setPublishUrlError("");
                  }}
                  aria-invalid={Boolean(publishUrlError)}
                />
                {publishUrlError ? <p className="text-sm text-destructive">{publishUrlError}</p> : null}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={submit.isPending}
                  onClick={() => {
                    const url = (guide.actions?.publishPending ? pendingMintlifyUrl : mintlifyUrl).trim();
                    if (!isValidMintlifyUrl(url)) {
                      setPublishUrlError("Enter a valid published website URL.");
                      return;
                    }
                    const path = guide.actions?.publishPending ? "/pending-update/publish" : "/publish";
                    submit.mutate(
                      { path, body: { mintlifyUrl: url } },
                      { onSuccess: () => setPublishConfirmOpen(false) },
                    );
                  }}
                >
                  Confirm publication
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={beginUpdateOpen} onOpenChange={setBeginUpdateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start guide update?</DialogTitle>
                <DialogDescription>
                  Create an update for this guide? The current published version will remain available until your changes are published.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setBeginUpdateOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  onClick={() =>
                    submit.mutate(
                      { path: "/pending-update/begin" },
                      {
                        onSuccess: () => {
                          setBeginUpdateOpen(false);
                          const params = new URLSearchParams({ pendingEdit: "1" });
                          if (searchParams.get("review") === "1") params.set("updateReason", "Periodic Review");
                          setSearchParams(params, { replace: true });
                        },
                      },
                    )
                  }
                  disabled={submit.isPending}
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={discardUpdateOpen} onOpenChange={setDiscardUpdateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard unpublished update?</DialogTitle>
                <DialogDescription>
                  The published guide will stay unchanged. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDiscardUpdateOpen(false)}>Keep editing</Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => submit.mutate({ path: "/pending-update/discard" })}
                  disabled={submit.isPending}
                >
                  Discard update
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {feedbackHistory.length > 1 ? (
            <Card className="border-amber-200/70 border-l-4 border-l-amber-500 dark:border-amber-900/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Earlier review feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {feedbackHistory.slice(0, -1).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm shadow-sm"
                  >
                    <p className="line-clamp-6 whitespace-pre-wrap text-foreground">{entry.feedback}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {entry.actorName}
                      {entry.createdAt ? ` · ${formatWhen(entry.createdAt)}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {relatedImpacts.length ? (
            <details className="rounded-lg border border-primary/40 text-sm">
              <summary className="cursor-pointer px-3 py-2 font-medium text-muted-foreground hover:text-foreground">
                Related product changes ({relatedImpacts.length})
              </summary>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {relatedImpacts.map((impact) => (
                  <li key={impact.id}>
                    <Link
                      to={`/feature-impacts/${impact.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--hover-surface)]"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">{impact.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {impact.progress.published}/{impact.progress.total} published →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <aside className="hidden min-w-0 lg:block lg:sticky lg:top-4 lg:self-start">
          <ProductGuideHistoryPanel activity={activity} revisions={revisions} />
        </aside>
      </div>

      <div className="lg:hidden">
        <ProductGuideHistoryPanel activity={activity} revisions={revisions} />
      </div>

    </div>
  );
}

export function ProductGuideFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingMode = searchParams.get("pending") === "1";
  const presetUpdateReason = searchParams.get("updateReason");
  const client = useQueryClient();
  const { setGuideTitle } = useProductGuideTabs();
  const existing = useQuery({
    queryKey: ["product-guide", id],
    queryFn: () => api<{ guide: ProductGuide }>(`/api/product-guides/${id}`),
    enabled: Boolean(id),
  });
  const [title, setTitle] = useState("");
  const [productArea, setProductArea] = useState("");
  const [documentationSource, setDocumentationSource] = useState<DocumentationSource>("Mintlify");
  const [workingDocUrl, setWorkingDocUrl] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [summary, setSummary] = useState("");
  const [version, setVersion] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const initialSnapshot = useRef<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    initialSnapshot.current = null;
  }, [id, pendingMode]);

  useEffect(() => {
    if (!existing.data?.guide) return;
    const g = existing.data.guide;
    setGuideTitle(g.id, g.title);
    if (pendingMode && g.pendingUpdate?.active) {
      const pending = g.pendingUpdate;
      setTitle(pending.title || g.title);
      setProductArea(pending.productArea || g.productArea);
      setUpdateReason(pending.updateReason || presetUpdateReason || "");
      setSummary(pending.summary || "");
      setDocumentationSource((pending.documentationSource || g.documentationSource || "Mintlify") as DocumentationSource);
      setWorkingDocUrl(pending.workingDocUrl || g.workingDocUrl || "");
      setPublishedUrl(pending.mintlifyUrl || g.mintlifyUrl || "");
      setVersion(pending.version || 1);
    } else {
      setTitle(g.title);
      setProductArea(g.productArea);
      setUpdateReason(g.updateReason || presetUpdateReason || "");
      setSummary(g.summary || "");
      setDocumentationSource((g.documentationSource || "Mintlify") as DocumentationSource);
      setWorkingDocUrl(g.workingDocUrl || "");
      setPublishedUrl(g.mintlifyUrl || "");
    }
    setLoaded(true);
  }, [existing.data, pendingMode, presetUpdateReason, setGuideTitle]);

  const snapshot = useMemo(
    () => JSON.stringify({ title, productArea, updateReason, summary, documentationSource, workingDocUrl, publishedUrl }),
    [title, productArea, updateReason, summary, documentationSource, workingDocUrl, publishedUrl],
  );
  useEffect(() => {
    if (loaded && initialSnapshot.current === null) initialSnapshot.current = snapshot;
  }, [loaded, snapshot]);
  const dirty = loaded && initialSnapshot.current !== null && snapshot !== initialSnapshot.current;

  useProductGuideEditGuard(id || "new", dirty);

  const save = useMutation({
    mutationFn: (): Promise<{ id?: string; version?: number }> => {
      if (!id) {
        return api("/api/product-guides", {
          method: "POST",
          body: JSON.stringify({
            title,
            productArea,
            summary,
          }),
        });
      }
      if (pendingMode) {
        if (!isGuideUpdateReasonReadyForPublish(updateReason)) {
          throw new Error("Select a reason for this update before saving.");
        }
        return api(`/api/product-guides/${id}/pending-update`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            productArea,
            updateReason,
            summary,
            documentationSource,
            workingDocUrl,
            mintlifyUrl: publishedUrl,
            version,
          }),
        });
      }
      return api(`/api/product-guides/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          productArea,
          updateReason,
          documentationSource,
          workingDocUrl,
          mintlifyUrl: publishedUrl,
        }),
      });
    },
    onSuccess: (data: { id?: string; version?: number }) => {
      toast.success("Guide saved");
      if (data.version) setVersion(data.version);
      initialSnapshot.current = snapshot;
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      void client.invalidateQueries({ queryKey: ["pg-stats"] });
      void client.invalidateQueries({ queryKey: ["product-guide", id] });
      navigate(`/product-guides/${id || data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (existing.isLoading) return <LoadingBlock />;
  if (id) {
    const params = new URLSearchParams(pendingMode ? { pendingEdit: "1" } : { draftEdit: "1" });
    if (presetUpdateReason) params.set("updateReason", presetUpdateReason);
    return <Navigate to={`/product-guides/${id}?${params.toString()}`} replace />;
  }

  return (
    <>
      <form
        className="mx-auto max-w-4xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <PageHeader title={id ? (pendingMode ? "Edit guide update" : "Edit product guide") : "New product guide"} />
        <Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Label>Category</Label>
        <ProductGuideCategorySelect value={productArea} onChange={setProductArea} />
        {!id ? (
          <div className="space-y-2">
            <Label>Summary of changes</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
        ) : pendingMode ? (
          <>
            <GuideUpdateReasonFields value={updateReason} onChange={setUpdateReason} required />
            <div className="space-y-2">
              <Label>Summary of changes</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
            </div>
            <p className="text-sm text-muted-foreground">
              Documentation source ·{" "}
              {(() => {
                const href = resolveWorkingUrl(workingDocUrl, "productGuides", documentationSource);
                if (!href) return documentationSource;
                return (
                  <a className="font-medium text-primary no-underline hover:text-primary/90" {...externalLinkProps(href)}>
                    {documentationSource}
                  </a>
                );
              })()}
            </p>
          </>
        ) : (
          <ExternalDocumentationPanel
            kind="productGuides"
            recordId={id}
            workflowSnapshot="Draft"
            values={{
              documentationSource,
              workingDocUrl,
              publishedUrl,
              summaryOfChanges: summary,
              updateReason,
            }}
            showUpdateReason={false}
            showPublishedUrlField
            onChange={(patch) => {
              if (patch.documentationSource != null) setDocumentationSource(patch.documentationSource);
              if (patch.workingDocUrl != null) setWorkingDocUrl(patch.workingDocUrl);
              if (patch.publishedUrl != null) setPublishedUrl(patch.publishedUrl);
              if (patch.summaryOfChanges != null) setSummary(patch.summaryOfChanges);
            }}
          />
        )}
        <Button type="submit" disabled={save.isPending}>Save</Button>
      </form>
      {id ? (
        <SmartReturnReminder
          recordId={id}
          kind="product_guide"
          source={documentationSource}
          onVerify={() => navigate(`/product-guides/${id}?verify=1`)}
        />
      ) : null}
    </>
  );
}
