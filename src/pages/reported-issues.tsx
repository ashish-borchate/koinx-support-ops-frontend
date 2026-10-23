import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { Empty, ErrorBlock, FilterToolbar, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { DateRangeDialog } from "@/components/date-range-dialog";
import { GeneralReportIssueDialog } from "@/components/general-report-issue-dialog";
import { IssueEvidenceGallery, IssueEvidencePicker, type PendingEvidenceFile } from "@/components/issue-evidence";
import { HubMentionTextarea, useMentionDraft } from "@/components/hub-mention-textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { renderMentionText } from "@/lib/mention-display";
import { markMentionsRead } from "@/lib/mention-api";
import { fileToUploadPayload, type IssueAttachmentMeta } from "@/lib/issue-attachments";
import { prefetchRecordHref } from "@/lib/route-prefetch";

export type ReportedIssueItem = {
  id: string;
  title: string;
  summary: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceId: string;
  sourceLabel: string;
  sourceHref: string;
  sourceAvailable: boolean;
  sourceUnavailableReason?: string;
  isGeneral: boolean;
  description: string;
  priority: string;
  status: string;
  reportedById: string;
  reportedByName: string;
  reportedAt: string;
  assignedToId: string | null;
  assignedToName: string;
  followUpDate: string;
  suggestedAction: string;
  relatedLink: string;
  resolutionNote: string;
  noActionReason: string;
  resolvedAt: string | null;
  resolvedByName: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedById: string | null;
  deletedByName: string;
  deleteReason: string;
  actions: { manage: boolean; comment: boolean; delete: boolean };
};

type Comment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  mentions: { userId: string; displayNameSnapshot: string }[];
  attachments: IssueAttachmentMeta[];
};

type ActivityRow = { id: string; action: string; summary: string; actorName: string; createdAt: string };

const REPORTED_ISSUE_ACTIVITY_PREVIEW = 5;

function ReportedIssueActivityList({ activity }: { activity: ActivityRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  const showAll = expanded || activity.length <= REPORTED_ISSUE_ACTIVITY_PREVIEW;
  const visible = showAll ? activity : activity.slice(0, REPORTED_ISSUE_ACTIVITY_PREVIEW);
  return (
    <div className="mt-2">
      <ol className="space-y-3">
        {visible.map((entry) => (
          <li key={entry.id} className="border-l-2 border-primary/40 pl-3">
            <p className="text-sm font-medium leading-snug text-foreground">{entry.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.actorName} · {formatWhen(entry.createdAt)}
            </p>
          </li>
        ))}
      </ol>
      {activity.length > REPORTED_ISSUE_ACTIVITY_PREVIEW ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all activity (${activity.length})`}
        </button>
      ) : null}
    </div>
  );
}

const priorityTone: Record<string, string> = {
  Normal: "bg-muted text-foreground/90",
  Important: "bg-amber-100 text-amber-900",
  Critical: "bg-rose-100 text-rose-900",
};

const statusTone: Record<string, string> = {
  "Pending Review": "bg-blue-100 text-blue-900",
  "In Progress": "bg-violet-100 text-violet-900",
  Resolved: "bg-emerald-100 text-emerald-900",
  "No Action Required": "bg-muted text-foreground",
};

function TruncateText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`block truncate ${className}`} title={text}>
      {text}
    </span>
  );
}

function ReportedIssuesSectionNav({ active }: { active: "active" | "deleted" }) {
  const { effective } = useAuth();
  const isAdmin = effective?.roleKey === "admin";
  const linkClass = (section: "active" | "deleted") =>
    `border-b-2 pb-2 text-sm font-medium transition-colors ${
      active === section
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav className="flex flex-wrap gap-6 border-b border-border">
      <Link to="/reported-issues" className={linkClass("active")}>Reported Issues</Link>
      {isAdmin ? (
        <Link to="/reported-issues/deleted" className={linkClass("deleted")}>Deleted Reported Issues</Link>
      ) : null}
    </nav>
  );
}

export function ReportedIssuesPage() {
  const { can, canMutate, readOnly } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const client = useQueryClient();

  if (!can("reported_issues.view_all", "reported_issues.view_own")) return <Navigate to="/" replace />;

  const title = can("reported_issues.view_all") ? "Reported Issues" : "My Reported Issues";

  return (
    <>
      <ReportedIssuesList
        title={title}
        sectionNav={<ReportedIssuesSectionNav active="active" />}
        headerAction={
          canMutate("reported_issues.create") && !readOnly ? (
            <Button size="sm" onClick={() => setReportOpen(true)}>Report Issue</Button>
          ) : null
        }
      />
      <GeneralReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmitted={() => {
          void client.invalidateQueries({ queryKey: ["reported-issues"] });
          void client.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </>
  );
}

export function DeletedReportedIssuesPage() {
  const { effective } = useAuth();
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQ(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  if (effective?.roleKey !== "admin") return <Navigate to="/reported-issues" replace />;

  const list = useQuery({
    queryKey: ["reported-issues-deleted", q, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "40", offset: String(offset) });
      if (q) params.set("q", q);
      return api<{ items: ReportedIssueItem[]; total: number }>(`/api/reported-issues/deleted?${params}`);
    },
  });

  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message={list.error.message} />;

  const items = list.data?.items || [];
  const total = list.data?.total || 0;

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeader eyebrow="Operations" title="Deleted Reported Issues" />
      <ReportedIssuesSectionNav active="deleted" />
      <p className="text-sm text-muted-foreground">
        Archived records removed from the active queue. Visible to admins for audit only.
      </p>
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-9"
          placeholder="Search deleted…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>
      {items.length === 0 ? (
        <Empty title="No deleted issues" body="Deleted reported issues will appear here for audit." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-[7.5rem] px-4 py-3">Deleted</th>
                <th className="px-4 py-3">Issue</th>
                <th className="w-[8rem] px-4 py-3">Deleted by</th>
                <th className="px-4 py-3">Reason</th>
                <th className="w-[4rem] px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 align-middle text-xs text-muted-foreground whitespace-nowrap">
                    {row.deletedAt ? formatWhen(row.deletedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Link to={`/reported-issues/${row.id}`} className="block truncate font-medium text-primary hover:underline" title={row.summary}>
                      {row.summary}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{row.status} · {row.priority}</p>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <TruncateText text={row.deletedByName || "—"} className="text-muted-foreground" />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <TruncateText text={row.deleteReason || "—"} className="text-muted-foreground" />
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <Link to={`/reported-issues/${row.id}`} className="text-xs font-semibold text-primary hover:underline">VIEW</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {offset + items.length < total ? (
            <div className="border-t p-3">
              <Button variant="secondary" className="w-full" onClick={() => setOffset(offset + 40)}>Load more</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ReportedIssuesList({
  title,
  headerAction,
  sectionNav,
}: {
  title: string;
  headerAction?: React.ReactNode;
  sectionNav?: React.ReactNode;
}) {
  const { can } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "custom_range">("date_desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQ(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const meta = useQuery({
    queryKey: ["reported-issues-meta"],
    queryFn: () =>
      api<{ sourceTypes: { key: string; label: string }[]; priorities: string[]; statuses: string[]; authors: { id: string; name: string }[] }>(
        "/api/reported-issues/meta",
      ),
  });

  const assignees = useQuery({
    queryKey: ["reported-issues-assignees"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/reported-issues/assignees"),
    enabled: can("reported_issues.view_all"),
  });

  const list = useQuery({
    queryKey: ["reported-issues", q, sourceType, priority, status, assignedTo, sort, dateFrom, dateTo, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "40", offset: String(offset) });
      if (q) params.set("q", q);
      if (sourceType) params.set("sourceType", sourceType);
      if (priority) params.set("priority", priority);
      if (status) params.set("status", status);
      if (assignedTo) params.set("assignedTo", assignedTo);
      if (sort !== "date_desc") params.set("sort", sort);
      if (sort === "custom_range") {
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
      }
      return api<{ items: ReportedIssueItem[]; total: number }>(`/api/reported-issues?${params}`);
    },
  });

  function resetFilters() {
    setSearchInput("");
    setQ("");
    setSourceType("");
    setPriority("");
    setStatus("");
    setAssignedTo("");
    setSort("date_desc");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  }

  const sortLabel =
    sort === "date_desc" ? "Newest first" : sort === "date_asc" ? "Oldest first" : "Custom range";

  const onSortChange = (value: string) => {
    if (value === "custom_range") {
      setRangeOpen(true);
      return;
    }
    setSort(value as "date_desc" | "date_asc");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  const hasFilters = Boolean(q || sourceType || priority || status || assignedTo || sort !== "date_desc" || dateFrom || dateTo);

  if (list.isLoading || meta.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message={list.error.message} />;

  const items = list.data?.items || [];
  const total = list.data?.total || 0;
  const emptyBody = can("reported_issues.view_all")
    ? "Resource issues and operational reports will appear here."
    : "Issues you report or are assigned will appear here.";

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeader eyebrow="Operations" title={title} />
      {sectionNav}

      <FilterToolbar
        showClear={hasFilters}
        onClear={resetFilters}
        trailing={headerAction}
        className="!flex-row !flex-wrap !items-center"
        searchClassName="min-w-0 w-full max-w-[11rem] flex-none sm:max-w-[12rem]"
        search={
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-9"
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        }
        filters={
          <>
            <Select value={sourceType || "all"} onValueChange={(v) => { setSourceType(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-8 w-[8rem]" aria-label="Source"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {(meta.data?.sourceTypes || []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority || "all"} onValueChange={(v) => { setPriority(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-8 w-[7rem]" aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                {(meta.data?.priorities || []).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-8 w-[7.5rem]" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {(meta.data?.statuses || []).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("reported_issues.view_all") && (assignees.data?.users?.length || 0) > 0 ? (
              <Select value={assignedTo || "all"} onValueChange={(v) => { setAssignedTo(v === "all" ? "" : v); setOffset(0); }}>
                <SelectTrigger className="h-8 w-[8rem]" aria-label="Assigned to"><SelectValue placeholder="Assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  {(assignees.data?.users || []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={sort} onValueChange={onSortChange}>
              <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Sort"><SelectValue>{sortLabel}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="custom_range">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onConfirm={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
          setSort("custom_range");
          setOffset(0);
        }}
      />

      {items.length === 0 ? (
        <Empty title="No reported issues" body={emptyBody} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-[7.5rem] px-4 py-3">Reported</th>
                <th className="w-[9rem] px-4 py-3">Source / Area</th>
                <th className="px-4 py-3">Issue</th>
                <th className="w-[8rem] px-4 py-3">Owner</th>
                <th className="w-[6rem] px-4 py-3">Priority</th>
                <th className="w-[9rem] px-4 py-3">Status</th>
                <th className="w-[4rem] px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => {
                const owner = row.assignedToName || row.reportedByName;
                const area = row.isGeneral ? row.sourceTypeLabel : row.sourceTypeLabel;
                const issueLabel = row.summary;
                return (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-muted-foreground">{formatWhen(row.reportedAt)}</td>
                    <td className="px-4 py-3 align-middle">
                      <TruncateText text={area} className="text-muted-foreground" />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link to={`/reported-issues/${row.id}`} className="block truncate font-medium text-primary hover:underline" title={issueLabel}>
                        {issueLabel}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <TruncateText text={owner} className="text-muted-foreground" />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone[row.priority] || priorityTone.Normal}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone[row.status] || ""}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <Link to={`/reported-issues/${row.id}`} className="text-xs font-semibold text-primary hover:underline">VIEW</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {offset + items.length < total ? (
            <div className="border-t p-3">
              <Button variant="secondary" className="w-full" onClick={() => setOffset(offset + 40)}>Load more</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ReportedIssueDetailPage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/reported-issues" replace />;
  return <ReportedIssueDetail id={id} />;
}

function ReportedIssueDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { canMutate, readOnly, effective } = useAuth();
  const client = useQueryClient();
  const dashboardUserId = effective?.id;
  const isAdmin = effective?.roleKey === "admin";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [noActionReason, setNoActionReason] = useState("");
  const [assignedToId, setAssignedToId] = useState<string | "">("");
  const commentDraft = useMentionDraft();
  const [commentEvidence, setCommentEvidence] = useState<PendingEvidenceFile[]>([]);

  const query = useQuery({
    queryKey: ["reported-issue", id],
    queryFn: () =>
      api<{ item: ReportedIssueItem; comments: Comment[]; activity: ActivityRow[]; attachments: IssueAttachmentMeta[] }>(
        `/api/reported-issues/${id}`,
      ),
  });

  const discussionRef = useRef<HTMLElement | null>(null);
  const mentionsMarkedReadRef = useRef(false);

  useEffect(() => {
    mentionsMarkedReadRef.current = false;
  }, [id]);

  useEffect(() => {
    if (readOnly || mentionsMarkedReadRef.current) return;
    const el = discussionRef.current;
    if (!el) return;
    const markRead = () => {
      if (mentionsMarkedReadRef.current) return;
      mentionsMarkedReadRef.current = true;
      void markMentionsRead("reported_issue", id, { queryClient: client, dashboardUserId }).catch(() => undefined);
    };
    if (typeof window !== "undefined" && window.location.hash === "#discussion") {
      markRead();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markRead();
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, readOnly, client, dashboardUserId, query.data?.comments.length]);

  const assignees = useQuery({
    queryKey: ["reported-issues-assignees"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/reported-issues/assignees"),
  });

  useEffect(() => {
    if (query.data?.item) {
      setAssignedToId(query.data.item.assignedToId || "");
    }
  }, [query.data?.item?.id, query.data?.item?.assignedToId]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ item: ReportedIssueItem }>(`/api/reported-issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Report updated");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["reported-issues"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteIssue = useMutation({
    mutationFn: () =>
      api(`/api/reported-issues/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason.trim() }),
      }),
    onSuccess: () => {
      toast.success("Issue deleted");
      setDeleteOpen(false);
      setDeleteReason("");
      void client.invalidateQueries({ queryKey: ["reported-issues"] });
      void client.invalidateQueries({ queryKey: ["reported-issues-deleted"] });
      void client.invalidateQueries({ queryKey: ["hub-notifications"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/reported-issues");
    },
    onError: (e) => toast.error(e.message),
  });

  const postComment = useMutation({
    mutationFn: async () => {
      const attachments = await Promise.all(commentEvidence.map((e) => fileToUploadPayload(e.file)));
      return api(`/api/reported-issues/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: commentDraft.value,
          mentions: commentDraft.mentionRefs.map((m) => ({ userId: m.userId })),
          attachments,
        }),
      });
    },
    onSuccess: () => {
      commentDraft.reset();
      setCommentEvidence([]);
      void query.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const item = query.data!.item;
  const comments = query.data!.comments;
  const activity = query.data!.activity;
  const issueAttachments = query.data!.attachments || [];
  const archived = Boolean(item.deletedAt);
  const manage = item.actions.manage && canMutate("reported_issues.manage") && !readOnly && !archived;
  const canDelete = item.actions.delete && !readOnly;
  const canComment = item.actions.comment && !readOnly && !archived;
  const canUploadEvidence = canComment;
  const canDeleteAttachment = (att: IssueAttachmentMeta) =>
    Boolean(
      !readOnly &&
        (canMutate("reported_issues.manage") || (effective?.id && att.uploadedById === effective.id)),
    );
  const displayTitle = item.title || item.summary;

  const backHref = archived && isAdmin ? "/reported-issues/deleted" : "/reported-issues";
  const backLabel = archived && isAdmin ? "← Deleted Reported Issues" : "← Reported Issues";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <Link to={backHref} className="text-sm text-primary">{backLabel}</Link>

      {archived ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Archived — deleted for audit</p>
          <p className="mt-1">
            Removed {item.deletedAt ? formatWhen(item.deletedAt) : ""}
            {item.deletedByName ? ` by ${item.deletedByName}` : ""}.
            {item.deleteReason ? ` Reason: ${item.deleteReason}` : ""}
          </p>
        </div>
      ) : null}

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this reported issue?</DialogTitle>
            <DialogDescription>
              The issue is removed from active lists. Admins can still view it under Deleted Reported Issues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-reported-issue-reason">Reason for deletion (required)</Label>
            <Textarea
              id="delete-reported-issue-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              placeholder="Why is this issue being removed?"
              minLength={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteIssue.isPending || deleteReason.trim().length < 3}
              onClick={() => deleteIssue.mutate()}
            >
              Delete issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone[item.priority]}`}>{item.priority}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[item.status]}`}>{item.status}</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{displayTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {item.sourceTypeLabel} · Reported {formatWhen(item.reportedAt)} by {item.reportedByName}
          {item.assignedToName ? ` · Assigned to ${item.assignedToName}` : ""}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,20rem)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">{item.description}</p>
            {!item.isGeneral && (
              <div className="border-t border-border/50 pt-3 text-sm">
                <p className="text-muted-foreground">{item.sourceTypeLabel}</p>
                <p className="font-medium text-foreground">{item.sourceLabel}</p>
                {item.sourceAvailable ? (
                  <Link
                    to={item.sourceHref}
                    className="mt-1 inline-block text-sm font-medium text-primary"
                    onMouseEnter={() => prefetchRecordHref(client, item.sourceHref)}
                    onFocus={() => prefetchRecordHref(client, item.sourceHref)}
                  >
                    View source →
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-amber-800">{item.sourceUnavailableReason || "Source unavailable"}</p>
                )}
              </div>
            )}
            {item.suggestedAction ? (
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Suggested action</p>
                <p className="mt-1 text-sm text-foreground">{item.suggestedAction}</p>
              </div>
            ) : null}
            {item.followUpDate ? (
              <p className="text-xs text-muted-foreground">Follow-up date: {item.followUpDate}</p>
            ) : null}
            {item.relatedLink ? (
              <a href={item.relatedLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                Related link →
              </a>
            ) : null}
            {(issueAttachments.length > 0 || canUploadEvidence) ? (
              <div className="border-t border-border/50 pt-3">
                <IssueEvidenceGallery
                  issueId={id}
                  attachments={issueAttachments}
                  canUpload={canUploadEvidence}
                  canDelete={archived ? () => false : canDeleteAttachment}
                  onChange={() => void query.refetch()}
                />
              </div>
            ) : null}
          </section>

          {(item.status === "Resolved" && item.resolutionNote) || (item.status === "No Action Required" && item.noActionReason) ? (
            <section className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Outcome</h2>
              {item.resolutionNote ? <p className="text-sm"><strong>Resolution:</strong> {item.resolutionNote}</p> : null}
              {item.noActionReason ? <p className="text-sm"><strong>No action:</strong> {item.noActionReason}</p> : null}
              {item.resolvedByName && item.resolvedAt ? (
                <p className="text-xs text-muted-foreground">Closed by {item.resolvedByName} · {formatWhen(item.resolvedAt)}</p>
              ) : null}
            </section>
          ) : null}

          <section
            ref={discussionRef}
            id="discussion"
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <SectionHeader title="Discussion" className="mb-3" />
            <div className="space-y-3">
              {comments.length === 0 ? <p className="text-sm text-muted-foreground">No discussion yet.</p> : null}
              {comments.map((c) => (
                <div key={c.id} className="border-l-2 border-primary/45 bg-primary/[0.03] py-2 pl-3 pr-2">
                  <p className="text-xs font-medium text-muted-foreground">{c.authorName} · {formatWhen(c.createdAt)}</p>
                  {c.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{renderMentionText(c.body, c.mentions)}</p>
                  ) : null}
                  {c.attachments?.length ? (
                    <div className="mt-2">
                      <IssueEvidenceGallery
                        issueId={id}
                        attachments={c.attachments}
                        canDelete={canDeleteAttachment}
                        onChange={() => void query.refetch()}
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {canComment ? (
              <div className="mt-4 space-y-2 border-t border-primary/25 pt-4">
                <HubMentionTextarea
                  scope="reported_issue"
                  recordId={id}
                  value={commentDraft.value}
                  onValueChange={commentDraft.setValue}
                  mentionRefs={commentDraft.mentionRefs}
                  onMentionRefsChange={commentDraft.setMentionRefs}
                  placeholder="Add an update… Type @ to mention someone"
                  className="min-h-[4.5rem]"
                />
                <IssueEvidencePicker
                  files={commentEvidence}
                  onChange={setCommentEvidence}
                  maxFiles={5}
                  disabled={postComment.isPending}
                />
                <Button
                  size="sm"
                  disabled={(!commentDraft.value.trim() && commentEvidence.length === 0) || postComment.isPending}
                  onClick={() => postComment.mutate()}
                >
                  Post
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          {canDelete ? (
            <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete issue
              </Button>
            </section>
          ) : null}
          {manage ? (
            <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Management</h2>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={status || item.status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pending Review", "In Progress", "Resolved", "No Action Required"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <Select value={priority || item.priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Normal", "Important", "Critical"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Assigned to</Label>
                <Select
                  value={assignedToId || item.assignedToId || "none"}
                  onValueChange={(v) => setAssignedToId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(assignees.data?.users || []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(status || item.status) === "Resolved" || item.status === "Resolved" ? (
                <div className="space-y-2">
                  <Label className="text-xs">Resolution note (optional)</Label>
                  <Textarea rows={3} value={resolutionNote || item.resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
                </div>
              ) : null}
              {(status || item.status) === "No Action Required" ? (
                <div className="space-y-2">
                  <Label className="text-xs">Reason (required)</Label>
                  <Textarea rows={3} value={noActionReason || item.noActionReason} onChange={(e) => setNoActionReason(e.target.value)} />
                </div>
              ) : null}
              <Button
                size="sm"
                className="w-full"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    status: status || undefined,
                    priority: priority || undefined,
                    resolutionNote,
                    noActionReason,
                    assignedToId: assignedToId || null,
                  })
                }
              >
                Save changes
              </Button>
            </section>
          ) : null}

          {activity.length > 0 ? (
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <h2 className="text-sm font-semibold text-foreground">Activity</h2>
              <ReportedIssueActivityList activity={activity} />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
