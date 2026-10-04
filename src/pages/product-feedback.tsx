import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  actions?: { approve: boolean; reject: boolean; manage: boolean };
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

export function ProductFeedbackRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="form" replace />} />
      <Route path="form" element={<ProductFeedbackFormPage />} />
      <Route path="tracker" element={<ProductFeedbackTrackerPage />} />
    </Routes>
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
          <Link to="/product-feedback/tracker" className="text-sm text-blue-700">
            Open tracker
          </Link>
        }
      />
      <p className="text-sm leading-relaxed text-slate-600">
        Describe what you noticed — a user pain point, a suggestion, or something you discovered. Keep it concise; operations handles the rest.
      </p>
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          View As is read-only. End View As to submit feedback.
        </p>
      ) : null}
      <form
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
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
  const [sort, setSort] = useState(searchParams.get("sort") || "date_desc");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const client = useQueryClient();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category !== "all") params.set("category", category);
    if (review !== "all") params.set("review", review);
    if (shared !== "all") params.set("shared", shared);
    if (sla !== "all") params.set("sla", sla);
    if (sort !== "date_desc") params.set("sort", sort);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
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
    queryFn: () => api<{ item: FeedbackItem }>(`/api/product-feedback/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["product-feedback"] });
    void client.invalidateQueries({ queryKey: ["product-feedback-item"] });
    void client.invalidateQueries({ queryKey: ["product-feedback-stats"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  if (!can("feedback.view")) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product Feedback"
        title="Tracker"
        action={
          can("feedback.submit") ? (
            <Link to="/product-feedback/form" className="text-sm text-blue-700">
              Submit feedback
            </Link>
          ) : null
        }
      />

      {stats.data?.stats?.audience === "reviewer" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterStat
            label="Pending reviews"
            value={stats.data.stats.pending}
            onClick={() => {
              setReview("Pending Review");
              setSla("all");
            }}
          />
          <FilterStat
            label="Due soon"
            value={stats.data.stats.dueSoon}
            onClick={() => {
              setReview("Pending Review");
              setSla("due-soon");
            }}
          />
          <FilterStat
            label="Overdue"
            value={stats.data.stats.overdue}
            onClick={() => {
              setReview("Pending Review");
              setSla("overdue");
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
            <SelectValue placeholder="Category" />
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
            <SelectValue placeholder="Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviews</SelectItem>
            {REVIEW_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shared} onValueChange={setShared}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Slack" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Shared in Slack</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="review">Review status</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">From date</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">To date</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.items.length === 0 ? (
        <Empty
          title="No product feedback yet"
          body="When someone shares feedback through the form, it will show up here for the team to review and follow up."
        />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Product Feedback</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Agent</th>
              <th className="px-3 py-3 font-medium">Supervisor Review</th>
              <th className="px-3 py-3 font-medium">Rejection Reason</th>
              <th className="px-3 py-3 font-medium">Shared in Slack</th>
              <th className="px-3 py-3 font-medium">Slack Link</th>
              <th className="px-3 py-3 font-medium">Feedback Response</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${selectedId === item.id ? "bg-blue-50/40" : ""}`}
              >
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{formatWhen(item.date)}</td>
                <td className="px-3 py-3 max-w-xs">
                  <button type="button" className="text-left font-medium text-slate-900 hover:text-blue-700" onClick={() => setSelectedId(item.id)}>
                    {item.bodyPreview}
                  </button>
                </td>
                <td className="px-3 py-3">{item.category}</td>
                <td className="px-3 py-3">{item.agentName}</td>
                <td className="px-3 py-3">
                  <ReviewPill value={item.supervisorReview} />
                </td>
                <td className="px-3 py-3 max-w-[10rem] truncate text-slate-600">{item.rejectionReason || "—"}</td>
                <td className="px-3 py-3">{item.sharedInSlack ? "Yes" : "No"}</td>
                <td className="px-3 py-3">
                  {item.sharedInSlack && item.slackLink ? (
                    <a href={item.slackLink} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      Open Slack ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 max-w-[12rem] truncate text-slate-600">{item.feedbackResponse || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FeedbackDetailDialog
        item={detail.data?.item || null}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-slate-900">{value}</CardContent>
    </Card>
  );
}

function FilterStat({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <StatCard label={label} value={value} />
    </button>
  );
}

function FeedbackDetailDialog({
  item,
  open,
  loading,
  readOnly,
  canMutateReview,
  canMutateManage,
  onClose,
  onUpdated,
}: {
  item: FeedbackItem | null;
  open: boolean;
  loading: boolean;
  readOnly: boolean;
  canMutateReview: boolean;
  canMutateManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [sharedInSlack, setSharedInSlack] = useState(false);
  const [slackLink, setSlackLink] = useState("");
  const [feedbackResponse, setFeedbackResponse] = useState("");

  useEffect(() => {
    if (!item) return;
    setSharedInSlack(item.sharedInSlack);
    setSlackLink(item.slackLink);
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
      toast.success("Record updated");
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {loading || !item ? (
            <LoadingBlock />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Product feedback</DialogTitle>
                <DialogDescription>
                  {formatWhen(item.date)} · {item.category} · {item.agentName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{item.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewPill value={item.supervisorReview} />
                  {item.supervisorReview === "Pending Review" && item.slaState && item.slaState !== "Not Applicable" ? (
                    <span className="text-xs text-slate-500">SLA · {item.slaTimer || item.slaState}</span>
                  ) : null}
                </div>
                {item.rejectionReason ? (
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-900">
                    <p className="text-xs font-medium uppercase tracking-wide">Rejection reason</p>
                    <p className="mt-1">{item.rejectionReason}</p>
                  </div>
                ) : null}
                {item.sharedInSlack && item.slackLink ? (
                  <a href={item.slackLink} target="_blank" rel="noreferrer" className="inline-flex text-blue-700 hover:underline">
                    Open Slack ↗
                  </a>
                ) : null}
                {item.feedbackResponse ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Feedback response</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{item.feedbackResponse}</p>
                  </div>
                ) : null}

                {canMutateManage && !readOnly ? (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supervisor follow-up</p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pf-shared" className="text-sm">
                        Shared in Slack
                      </Label>
                      <Select
                        value={sharedInSlack ? "yes" : "no"}
                        onValueChange={(value) => setSharedInSlack(value === "yes")}
                      >
                        <SelectTrigger id="pf-shared" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {sharedInSlack ? (
                      <div className="space-y-1">
                        <Label htmlFor="pf-slack">Slack link</Label>
                        <Input
                          id="pf-slack"
                          placeholder="https://…slack.com/archives/…"
                          value={slackLink}
                          onChange={(e) => setSlackLink(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <Label htmlFor="pf-response">Feedback response</Label>
                      <Textarea
                        id="pf-response"
                        rows={4}
                        value={feedbackResponse}
                        onChange={(e) => setFeedbackResponse(e.target.value)}
                        placeholder="Response from Product, Engineering, or another team"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saveOperational.isPending}
                      onClick={() =>
                        saveOperational.mutate({ sharedInSlack, slackLink, feedbackResponse })
                      }
                    >
                      Save follow-up
                    </Button>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <div className="flex flex-wrap gap-2">
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
