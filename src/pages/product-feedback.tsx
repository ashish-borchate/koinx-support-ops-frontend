import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { MessageSquarePlus, TableProperties } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FilterStat, StatCard } from "@/components/filter-stat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateRangeDialog } from "@/components/date-range-dialog";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

const CATEGORIES = ["User Feedback", "Own Suggestion", "Discovery"] as const;
const REVIEW_STATUSES = ["Pending Review", "Approved", "Rejected"] as const;

export type FeedbackItem = {
  id: string;
  date: string;
  body: string;
  bodyPreview: string;
  category: string;
  agentId: string;
  agentName: string;
  supervisorReview: string;
  rejectionReason: string;
  sharedInSlack: boolean;
  slackLink: string;
  feedbackResponse: string;
  slaState?: string;
  slaTimer?: string | null;
  actions?: { approve: boolean; reject: boolean; manage: boolean; editSubmission?: boolean };
};

type FeedbackActivity = {
  id: string;
  summary: string;
  action: string;
  actorName: string;
  createdAt: string;
};

type Stats =
  | { audience: "reviewer"; pending: number; dueSoon: number; overdue: number }
  | { audience: "submitter"; submitted: number; pendingReview: number; approved: number; rejected: number };

function ReviewPill({ value }: { value: string }) {
  const tone =
    value === "Approved"
      ? "bg-emerald-50 text-emerald-800"
      : value === "Rejected"
        ? "bg-rose-50 text-rose-800"
        : "bg-blue-50 text-blue-800";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{value}</span>;
}

function ProductFeedbackHome() {
  const { can } = useAuth();
  if (can("feedback.view")) return <Navigate to="tracker" replace />;
  if (can("feedback.submit")) return <Navigate to="form" replace />;
  return <Navigate to="/" replace />;
}

export function ProductFeedbackRoutes() {
  return (
    <Routes>
      <Route index element={<ProductFeedbackHome />} />
      <Route path="form" element={<ProductFeedbackFormPage />} />
      <Route path="tracker" element={<ProductFeedbackTrackerPage />} />
    </Routes>
  );
}

function isSlackUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && (url.hostname === "slack.com" || url.hostname.endsWith(".slack.com"));
  } catch {
    return false;
  }
}

function TruncateWithHoverTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`group/tr relative inline-block max-w-full align-middle ${className}`}>
      <span className="block truncate" title={text}>{text}</span>
      <span
        className="pointer-events-none absolute bottom-full right-0 z-[100] mb-1.5 hidden max-w-[min(20rem,70vw)] rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-xs leading-snug whitespace-normal text-popover-foreground shadow-md group-hover/tr:block dark:bg-popover"
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

function TableViewLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="font-medium uppercase tracking-wide text-primary hover:underline"
    >
      VIEW
    </button>
  );
}

function FeedbackDetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ProductFeedbackFormPage() {
  const { can, readOnly } = useAuth();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [success, setSuccess] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api<{ item: FeedbackItem }>("/api/product-feedback", {
        method: "POST",
        body: JSON.stringify({ body, category }),
      }),
    onSuccess: () => {
      setBody("");
      setCategory(CATEGORIES[0]);
      setSuccess("Thanks — your feedback is in the tracker.");
      toast.success("Feedback submitted");
      void client.invalidateQueries({ queryKey: ["product-feedback"] });
      void client.invalidateQueries({ queryKey: ["product-feedback-stats"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (!can("feedback.submit")) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Product Feedback"
        title="Share feedback"
        action={
          can("feedback.view") ? (
            <Button size="sm" className="h-8 gap-1" asChild>
              <Link to="/product-feedback/tracker">
                <TableProperties className="size-3.5" />
                Open tracker
              </Link>
            </Button>
          ) : undefined
        }
      />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Describe what you noticed — a user pain point, a suggestion, or something you discovered. Keep it concise; operations handles the rest.
      </p>
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          View As is read-only. End View As to submit feedback.
        </p>
      ) : null}
      <form
        className="space-y-5 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setSuccess("");
          submit.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="pf-body">Product Feedback</Label>
          <Textarea
            id="pf-body"
            rows={6}
            required
            disabled={readOnly || submit.isPending}
            placeholder="What did you observe? Include enough context for a supervisor to understand without a long thread."
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-category">Category</Label>
          <Select value={category} onValueChange={setCategory} disabled={readOnly || submit.isPending}>
            <SelectTrigger id="pf-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {success ? <p className="text-sm font-medium text-emerald-800">{success}</p> : null}
        <Button type="submit" className="w-full" disabled={readOnly || submit.isPending || !body.trim()}>
          {submit.isPending ? "Submitting…" : "Submit Feedback"}
        </Button>
      </form>
    </div>
  );
}

export function ProductFeedbackTrackerPage() {
  const { can, canMutate, readOnly } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [review, setReview] = useState(searchParams.get("review") || "all");
  const [shared, setShared] = useState(searchParams.get("shared") || "all");
  const [sla, setSla] = useState(searchParams.get("sla") || "all");
  const [sort, setSort] = useState(() => {
    const fromUrl = searchParams.get("sort");
    const hasRange = Boolean(searchParams.get("dateFrom") || searchParams.get("dateTo"));
    if (fromUrl === "date_asc") return "date_asc";
    if (fromUrl === "custom_range" || hasRange) return "custom_range";
    return "date_desc";
  });
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const client = useQueryClient();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category !== "all") params.set("category", category);
    if (review !== "all") params.set("review", review);
    if (shared !== "all") params.set("shared", shared);
    if (sla !== "all") params.set("sla", sla);
    const listSort = sort === "custom_range" ? "date_desc" : sort;
    if (listSort !== "date_desc") params.set("sort", listSort);
    if (sort === "custom_range") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    return params.toString();
  }, [q, category, review, shared, sla, sort, dateFrom, dateTo]);

  useEffect(() => {
    const next = new URLSearchParams(queryString);
    if (selectedId) next.set("id", selectedId);
    setSearchParams(next, { replace: true });
  }, [queryString, selectedId, setSearchParams]);

  const stats = useQuery({
    queryKey: ["product-feedback-stats"],
    queryFn: () => api<{ stats: Stats | null }>("/api/product-feedback/stats"),
    enabled: can("feedback.view"),
  });

  const list = useQuery({
    queryKey: ["product-feedback", queryString],
    queryFn: () => api<{ items: FeedbackItem[] }>(`/api/product-feedback?${queryString}`),
    enabled: can("feedback.view"),
  });

  const detail = useQuery({
    queryKey: ["product-feedback-item", selectedId],
    queryFn: () => api<{ item: FeedbackItem; activity: FeedbackActivity[] }>(`/api/product-feedback/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["product-feedback"] });
    void client.invalidateQueries({ queryKey: ["product-feedback-item"] });
    void client.invalidateQueries({ queryKey: ["product-feedback-stats"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  if (!can("feedback.view")) return <Navigate to="/" replace />;

  const categoryTriggerLabel = category === "all" ? "Category" : category;
  const statusTriggerLabel = review === "all" ? "Status" : review;
  const slackTriggerLabel =
    shared === "all" ? "Slack" : shared === "yes" ? "Shared" : "Not shared";
  const sortTriggerLabel =
    sort === "date_desc" ? "Newest First" : sort === "date_asc" ? "Oldest First" : "Custom range";

  const onSortChange = (value: string) => {
    if (value === "custom_range") {
      setRangeOpen(true);
      return;
    }
    setSort(value);
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product Feedback"
        title="Tracker"
        action={
          can("feedback.submit") ? (
            <Button size="sm" className="h-8 gap-1" asChild>
              <Link to="/product-feedback/form">
                <MessageSquarePlus className="size-3.5" />
                Submit feedback
              </Link>
            </Button>
          ) : null
        }
      />

      {stats.data?.stats?.audience === "reviewer" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterStat
            label="Pending reviews"
            value={stats.data.stats.pending}
            active={review === "Pending Review" && sla === "all"}
            onClick={() => {
              if (review === "Pending Review" && sla === "all") {
                setReview("all");
                setSla("all");
              } else {
                setReview("Pending Review");
                setSla("all");
              }
            }}
          />
          <FilterStat
            label="Due soon"
            value={stats.data.stats.dueSoon}
            active={review === "Pending Review" && sla === "due-soon"}
            onClick={() => {
              if (review === "Pending Review" && sla === "due-soon") {
                setReview("all");
                setSla("all");
              } else {
                setReview("Pending Review");
                setSla("due-soon");
              }
            }}
          />
          <FilterStat
            label="Overdue"
            value={stats.data.stats.overdue}
            active={review === "Pending Review" && sla === "overdue"}
            onClick={() => {
              if (review === "Pending Review" && sla === "overdue") {
                setReview("all");
                setSla("all");
              } else {
                setReview("Pending Review");
                setSla("overdue");
              }
            }}
          />
        </div>
      ) : null}

      {stats.data?.stats?.audience === "submitter" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Submitted" value={stats.data.stats.submitted} />
          <StatCard label="Pending review" value={stats.data.stats.pendingReview} />
          <StatCard label="Approved" value={stats.data.stats.approved} />
          <StatCard label="Rejected" value={stats.data.stats.rejected} />
        </div>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-[1fr_160px_160px_160px_160px]">
        <Input placeholder="Search feedback, category, agent, response…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full">
            <SelectValue>{categoryTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={review} onValueChange={setReview}>
          <SelectTrigger className="w-full">
            <SelectValue>{statusTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REVIEW_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shared} onValueChange={setShared}>
          <SelectTrigger className="w-full">
            <SelectValue>{slackTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="no">Not shared</SelectItem>
            <SelectItem value="yes">Shared</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-full">
            <SelectValue>{sortTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="custom_range">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onConfirm={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
          setSort("custom_range");
        }}
      />

      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.items.length === 0 ? (
        <Empty
          title="No product feedback yet"
          body="When someone shares feedback through the form, it will show up here for the team to review and follow up."
        />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[44rem] table-fixed text-left text-sm">
          <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground [&_th]:whitespace-nowrap">
            <tr>
              <th className="w-[8rem] px-4 py-3 text-left">Date</th>
              <th className="w-[5.5rem] px-4 py-3 text-left">Feedback</th>
              <th className="w-[24%] px-4 py-3 text-left">Category</th>
              <th className="w-[20%] px-4 py-3 text-left">Agent</th>
              <th className="w-[10.5rem] px-4 py-3 text-left">Review</th>
              <th className="w-[4.5rem] px-4 py-3 text-left">Slack</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.data?.items.map((item) => {
              const slackHref =
                item.sharedInSlack && item.slackLink && isSlackUrl(item.slackLink) ? item.slackLink : null;
              return (
                <tr
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(item.id);
                    }
                  }}
                  className={`cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/30 ${selectedId === item.id ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                >
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-muted-foreground">{formatWhen(item.date)}</td>
                  <td className="px-4 py-3 align-middle">
                    <TableViewLink onClick={() => setSelectedId(item.id)} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="block truncate text-muted-foreground" title={item.category}>{item.category}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="block truncate text-muted-foreground" title={item.agentName}>{item.agentName}</span>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-left">
                    <ReviewPill value={item.supervisorReview} />
                  </td>
                  <td className="px-4 py-3 align-middle text-left whitespace-nowrap">
                    {slackHref ? (
                      <a
                        href={slackHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="font-medium uppercase tracking-wide text-primary hover:underline"
                      >
                        LINK
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FeedbackDetailDialog
        item={detail.data?.item || null}
        activity={detail.data?.activity ?? []}
        open={Boolean(selectedId)}
        loading={detail.isLoading}
        readOnly={readOnly}
        canMutateReview={canMutate("feedback.review")}
        canMutateManage={canMutate("feedback.manage")}
        onClose={() => setSelectedId(null)}
        onUpdated={refresh}
      />
    </div>
  );
}

function FollowUpLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function FeedbackActivityList({ activity }: { activity: FeedbackActivity[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ol className="space-y-5">
      {activity.map((entry) => (
        <li key={entry.id} className="border-l-2 border-border pl-4 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">{entry.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {entry.actorName} · {formatWhen(entry.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function FeedbackEditSubmissionDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: FeedbackItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(item.body);
  const [category, setCategory] = useState(item.category);

  useEffect(() => {
    setBody(item.body);
    setCategory(item.category);
  }, [item]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/product-feedback/${item.id}/submission`, {
        method: "PATCH",
        body: JSON.stringify({ body, category }),
      }),
    onSuccess: () => {
      toast.success("Feedback updated");
      onOpenChange(false);
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle>Edit feedback</DialogTitle>
          <DialogDescription className="text-sm">Update your submission while it is still pending review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="pf-edit-body">Product Feedback</Label>
            <Textarea id="pf-edit-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="pf-edit-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="!mx-0 !mb-0 border-t bg-muted/50 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!body.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDetailDialog({
  item,
  activity,
  open,
  loading,
  readOnly,
  canMutateReview,
  canMutateManage,
  onClose,
  onUpdated,
}: {
  item: FeedbackItem | null;
  activity: FeedbackActivity[];
  open: boolean;
  loading: boolean;
  readOnly: boolean;
  canMutateReview: boolean;
  canMutateManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [slackLinkDraft, setSlackLinkDraft] = useState("");
  const [sharingDraftOpen, setSharingDraftOpen] = useState(false);
  const [feedbackResponse, setFeedbackResponse] = useState("");

  useEffect(() => {
    if (!item) return;
    setSlackLinkDraft(item.slackLink);
    setSharingDraftOpen(false);
    setFeedbackResponse(item.feedbackResponse);
  }, [item]);

  const approve = useMutation({
    mutationFn: (id: string) => api(`/api/product-feedback/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Feedback approved");
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api(`/api/product-feedback/${id}/reject`, { method: "POST", body: JSON.stringify({ rejectionReason }) }),
    onSuccess: () => {
      toast.success("Feedback rejected");
      setRejectOpen(false);
      setRejectReason("");
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });

  const saveOperational = useMutation({
    mutationFn: (payload: { sharedInSlack: boolean; slackLink: string; feedbackResponse: string }) =>
      api(`/api/product-feedback/${item!.id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });

  const canManageFollowUp = canMutateManage && !readOnly;

  const confirmMarkShared = () => {
    if (!item) return;
    const trimmed = slackLinkDraft.trim();
    if (!trimmed) {
      toast.error("Slack link is required when marked as shared");
      return;
    }
    if (!isSlackUrl(trimmed)) {
      toast.error("Enter a valid Slack message or thread URL (https://…slack.com/…)");
      return;
    }
    saveOperational.mutate(
      {
        sharedInSlack: true,
        slackLink: trimmed,
        feedbackResponse: item.feedbackResponse,
      },
      {
        onSuccess: () => {
          toast.success("Marked as shared in Slack");
          setSharingDraftOpen(false);
        },
      },
    );
  };

  const saveResponseIfDirty = () => {
    if (!item) return;
    saveOperational.mutate(
      {
        sharedInSlack: item.sharedInSlack,
        slackLink: item.slackLink,
        feedbackResponse,
      },
      {
        onSuccess: () => {
          toast.success("Response saved");
        },
      },
    );
  };

  const responseDirty = item ? feedbackResponse !== item.feedbackResponse : false;

  const slackHref =
    item && item.sharedInSlack && item.slackLink && isSlackUrl(item.slackLink) ? item.slackLink : null;

  const followUpHint = (text: string) => (
    <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground dark:bg-muted/10">
      {text}
    </p>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {loading || !item ? (
            <div className="p-8">
              <LoadingBlock />
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl tracking-tight">{item.category}</DialogTitle>
                  <DialogDescription className="mt-1 text-sm">{item.agentName}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Submission</h3>
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground dark:bg-muted/20">
                      {item.body}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Details</h3>
                    <dl className="divide-y divide-border/60 rounded-xl border border-border bg-muted/40/50 dark:bg-muted/20">
                      <FeedbackDetailRow label="Category">{item.category}</FeedbackDetailRow>
                      <FeedbackDetailRow label="Submitted by">{item.agentName}</FeedbackDetailRow>
                      <FeedbackDetailRow label="Date and time">{formatWhen(item.date)}</FeedbackDetailRow>
                      <FeedbackDetailRow label="Supervisor review">
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <ReviewPill value={item.supervisorReview} />
                          {item.supervisorReview === "Pending Review" && item.slaState && item.slaState !== "Not Applicable" ? (
                            <span className="text-xs font-normal text-muted-foreground">SLA · {item.slaTimer || item.slaState}</span>
                          ) : null}
                        </span>
                      </FeedbackDetailRow>
                      {item.supervisorReview === "Rejected" && item.rejectionReason ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <dt className="shrink-0 text-sm text-muted-foreground">Rejection reason</dt>
                          <dd className="min-w-0 max-w-[58%] text-right text-sm font-normal text-rose-900 dark:text-rose-200">
                            <TruncateWithHoverTip text={item.rejectionReason} />
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Follow-up</h3>
                    <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3 dark:bg-muted/10">
                      {item.supervisorReview === "Pending Review" ? (
                        followUpHint("Follow-up becomes available after supervisor approval.")
                      ) : null}
                      {item.supervisorReview === "Rejected" ? followUpHint("No follow-up required.") : null}
                      {item.supervisorReview === "Approved" ? (
                        <div className="space-y-4">
                          <FollowUpLine label="SLACK">
                            {!item.sharedInSlack ? (
                              <span className="inline-flex flex-col items-start gap-2 sm:inline">
                                <span className="text-muted-foreground">Not shared</span>
                                {canManageFollowUp ? (
                                  sharingDraftOpen ? (
                                    <span className="mt-2 block w-full space-y-3 sm:mt-0">
                                      <Input
                                        id="pf-slack"
                                        placeholder="https://…slack.com/archives/…"
                                        value={slackLinkDraft}
                                        onChange={(e) => setSlackLinkDraft(e.target.value)}
                                        className="max-w-md"
                                      />
                                      <span className="flex flex-wrap gap-2">
                                        <Button type="button" size="sm" disabled={saveOperational.isPending} onClick={confirmMarkShared}>
                                          {saveOperational.isPending ? "Saving…" : "Mark as shared"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSharingDraftOpen(false);
                                            setSlackLinkDraft(item.slackLink);
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </span>
                                    </span>
                                  ) : (
                                    <Button type="button" size="sm" variant="outline" className="ml-0 sm:ml-2" onClick={() => setSharingDraftOpen(true)}>
                                      Mark as shared
                                    </Button>
                                  )
                                ) : null}
                              </span>
                            ) : slackHref ? (
                              <a href={slackHref} target="_blank" rel="noreferrer" className="font-medium uppercase tracking-wide text-primary hover:underline">
                                LINK
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </FollowUpLine>
                          {item.sharedInSlack ? (
                            <div className="space-y-2">
                              {canManageFollowUp ? (
                                <>
                                  <p className="text-sm font-medium text-muted-foreground">Feedback Response:</p>
                                  <Textarea
                                    id="pf-response"
                                    rows={4}
                                    className="min-h-[6rem] resize-y"
                                    value={feedbackResponse}
                                    onChange={(e) => setFeedbackResponse(e.target.value)}
                                    placeholder="Response from Product, Engineering, or another team"
                                  />
                                  {responseDirty ? (
                                    <Button type="button" size="sm" disabled={saveOperational.isPending} onClick={saveResponseIfDirty}>
                                      {saveOperational.isPending ? "Saving…" : "Save response"}
                                    </Button>
                                  ) : null}
                                </>
                              ) : (
                                <FollowUpLine label="Feedback Response">
                                  {item.feedbackResponse ? (
                                    <span className="block whitespace-pre-wrap">{item.feedbackResponse}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </FollowUpLine>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>

                <section className="flex min-h-0 flex-col md:min-h-[18rem]">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-muted/10 p-4 dark:bg-muted/5">
                    <FeedbackActivityList activity={activity} />
                  </div>
                </section>
              </div>
              <DialogFooter className="!mx-0 !mb-0 !flex-row flex-nowrap items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <div className="flex shrink-0 items-center gap-2">
                  {item.actions?.editSubmission && !readOnly ? (
                    <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                  ) : null}
                  {canMutateReview && item.actions?.reject && !readOnly ? (
                    <Button type="button" variant="outline" onClick={() => setRejectOpen(true)}>
                      Reject
                    </Button>
                  ) : null}
                  {canMutateReview && item.actions?.approve && !readOnly ? (
                    <Button type="button" disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>
                      Approve
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {item && editOpen ? (
        <FeedbackEditSubmissionDialog item={item} open={editOpen} onOpenChange={setEditOpen} onSaved={onUpdated} />
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject feedback</DialogTitle>
            <DialogDescription>Explain why this feedback is not being taken forward. The record stays in the tracker.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Duplicate of an item already shared, not actionable with current scope…"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending || !item}
              onClick={() => item && reject.mutate({ id: item.id, rejectionReason: rejectReason.trim() })}
            >
              Reject feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
