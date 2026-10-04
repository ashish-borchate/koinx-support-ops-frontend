import { Outlet, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { Empty, ErrorBlock, LoadingBlock, StatusBadge, DataTableShell, FilterToolbar, ModuleSubnav, PageHeader, DetailSection, ActivityTimeline } from "@/components/bits";
import { MetricCard } from "@/components/design/metric-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROOT_CAUSES = [
  "Agent Issue",
  "Product Issue",
  "Process Issue",
  "Knowledge Gap",
  "Response / Resolution Issue",
  "Customer Expectation",
  "Other",
] as const;

const SOFT_CATEGORIES = [
  "Tone",
  "Empathy",
  "Ownership",
  "Clarity",
  "Communication",
  "Professionalism",
  "Active Listening",
  "Patience",
  "Other",
] as const;

type ReviewRow = {
  id: string;
  ticketDate: string;
  ticketNumber: string;
  agentId: string;
  agentName: string;
  summaryOfIssue: string;
  summaryPreview: string;
  rootCause: string;
  softSkillsMissing: boolean;
  softSkillsCategories: string[];
  coachingNeeded: boolean;
  coachingStatus: string;
  coachingNotes: string;
  acknowledgedByAgent: boolean;
  reviewDate: string;
  actions?: { edit: boolean; markCoachingDone: boolean; acknowledge: boolean };
};

function NrLayout() {
  const { can } = useAuth();
  const links = [
    { to: "/negative-reviews/dashboard", label: "Dashboard", any: ["negative_reviews.dashboard"] },
    { to: "/negative-reviews/tracker", label: "Tracker", any: ["negative_reviews.tracker"] },
  ].filter((l) => can(...l.any));
  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Quality & performance"
        title="Negative Reviews"
        description="DSAT reviews, coaching follow-up, and agent acknowledgement."
      />
      <ModuleSubnav links={links.map((l) => ({ to: l.to, label: l.label }))} />
      <Outlet />
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <StatusBadge value={value} />;
}

export function NegativeReviewsRoutes() {
  return (
    <Routes>
      <Route element={<NrLayout />}>
        <Route path="dashboard" element={<NrDashboardPage />} />
        <Route path="tracker" element={<NrTrackerPage />} />
        <Route index element={<NrDashboardPage />} />
      </Route>
    </Routes>
  );
}

export function NrDashboardPage() {
  const navigate = useNavigate();
  const { canMutate } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const dash = useQuery({
    queryKey: ["nr-dashboard", dateFrom, dateTo],
    queryFn: () =>
      api<{
        cards: Record<string, number>;
        trends: {
          byRootCause: { label: string; count: number }[];
          byAgent: { name: string; count: number }[];
          bySoftSkill: { label: string; count: number }[];
          overTime: { month: string; count: number }[];
        };
      }>(`/api/negative-reviews/dashboard?${params.toString()}`),
  });

  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const { cards, trends } = dash.data!;

  const filterLink = (query: Record<string, string>) => {
    const p = new URLSearchParams(query);
    navigate(`/negative-reviews/tracker?${p.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto bg-card" aria-label="From date" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto bg-card" aria-label="To date" />
        </div>
        {canMutate("negative_reviews.manage") ? (
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add negative review
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardButton label="Total Negative Reviews" value={cards.total} onClick={() => filterLink({})} />
        <CardButton label="Agent Issues" value={cards.agentIssues} onClick={() => filterLink({ rootCause: "Agent Issue" })} />
        <CardButton label="Product Issues" value={cards.productIssues} onClick={() => filterLink({ rootCause: "Product Issue" })} />
        <CardButton label="Soft Skills Missing" value={cards.softSkillsMissing} onClick={() => filterLink({ softSkills: "yes" })} />
        <CardButton label="Coaching Required" value={cards.coachingRequired} onClick={() => filterLink({ coachingNeeded: "yes" })} />
        <CardButton label="Coaching Pending" value={cards.coachingPending} onClick={() => filterLink({ coachingStatus: "Pending" })} />
        <CardButton label="Coaching Completed" value={cards.coachingCompleted} onClick={() => filterLink({ coachingStatus: "Done" })} />
        <CardButton label="Agent Acknowledgement Pending" value={cards.ackPending} onClick={() => filterLink({ ack: "pending" })} />
      </div>
      {cards.total === 0 ? (
        <Empty title="No negative reviews yet." body="Log a review from the tracker when DSAT coaching is required." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {trends.overTime.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reviews over time</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.overTime}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
          {trends.byRootCause.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By root cause</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.byRootCause} layout="vertical">
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="count" fill="#64748b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
      <ReviewFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function CardButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <MetricCard label={label} value={value} interactive onClick={onClick} tone={value > 0 && label.includes("Pending") ? "warning" : "default"} />
  );
}

export function NrTrackerPage() {
  const { canMutate } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("id"));
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "all") p.set(key, value);
    else p.delete(key);
    p.delete("page");
    setSearchParams(p, { replace: true });
    setPage(1);
  };

  const queryString = useMemo(() => {
    const p = new URLSearchParams(searchParams);
    if (q) p.set("q", q);
    else p.delete("q");
    p.set("page", String(page));
    return p.toString();
  }, [searchParams, q, page]);

  useEffect(() => {
    const p = new URLSearchParams(queryString);
    if (detailId) p.set("id", detailId);
    setSearchParams(p, { replace: true });
  }, [queryString, detailId, setSearchParams]);

  const list = useQuery({
    queryKey: ["nr-list", queryString],
    queryFn: () => api<{ items: ReviewRow[]; total: number; page: number; pageSize: number }>(`/api/negative-reviews?${queryString}`),
  });

  const hasActiveFilters =
    Boolean(searchParams.get("rootCause")) ||
    Boolean(searchParams.get("coachingStatus")) ||
    Boolean(searchParams.get("ack")) ||
    Boolean(q);

  const clearFilters = () => {
    setQ("");
    setSearchParams({}, { replace: true });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <FilterToolbar
        search={
          <Input
            placeholder="Search ticket, summary, agent…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card"
          />
        }
        filters={
          <>
            <Select value={searchParams.get("rootCause") || "all"} onValueChange={(v) => setFilter("rootCause", v)}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Root cause" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All root causes</SelectItem>
                {ROOT_CAUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={searchParams.get("coachingStatus") || "all"} onValueChange={(v) => setFilter("coachingStatus", v)}>
              <SelectTrigger className="w-[160px] bg-card">
                <SelectValue placeholder="Coaching" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All coaching</SelectItem>
                <SelectItem value="Not Required">Not Required</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={searchParams.get("ack") || "all"} onValueChange={(v) => setFilter("ack", v)}>
              <SelectTrigger className="w-[160px] bg-card">
                <SelectValue placeholder="Acknowledgement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ack states</SelectItem>
                <SelectItem value="pending">Ack pending</SelectItem>
                <SelectItem value="yes">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        showClear={hasActiveFilters}
        onClear={clearFilters}
        trailing={
          canMutate("negative_reviews.manage") ? (
            <Button type="button" onClick={() => setAddOpen(true)}>
              Add review
            </Button>
          ) : null
        }
      />
      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.items.length === 0 ? <Empty title="No negative reviews in this view." body="Adjust filters or add a review if you manage this tracker." /> : null}
      <DataTableShell>
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ticket date</TableHead>
              <TableHead>Ticket number</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Root cause</TableHead>
              <TableHead>Soft skills</TableHead>
              <TableHead>Coaching</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead>Review date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((row) => (
              <TableRow key={row.id} className="cursor-default">
                <TableCell className="text-muted-foreground">{row.ticketDate}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    onClick={() => setDetailId(row.id)}
                  >
                    {row.ticketNumber}
                  </button>
                </TableCell>
                <TableCell>{row.agentName}</TableCell>
                <TableCell className="max-w-xs truncate whitespace-normal text-muted-foreground">{row.summaryPreview}</TableCell>
                <TableCell>{row.rootCause}</TableCell>
                <TableCell>{row.softSkillsMissing ? "Yes" : "No"}</TableCell>
                <TableCell>{row.coachingNeeded ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <StatusPill value={row.coachingStatus} />
                </TableCell>
                <TableCell>{row.acknowledgedByAgent ? "Yes" : "No"}</TableCell>
                <TableCell className="text-muted-foreground">{row.reviewDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
      {list.data && list.data.total > list.data.pageSize ? (
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-slate-500">
            Page {list.data.page} · {list.data.total} records
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page * list.data.pageSize >= list.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
      <ReviewFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <ReviewDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function ReviewFormDialog({
  open,
  onOpenChange,
  editId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId?: string;
  initial?: Partial<ReviewRow>;
}) {
  const client = useQueryClient();
  const agents = useQuery({
    queryKey: ["nr-agents"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/negative-reviews/agents"),
    enabled: open,
  });
  const [ticketDate, setTicketDate] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [agentId, setAgentId] = useState("");
  const [summary, setSummary] = useState("");
  const [rootCause, setRootCause] = useState<string>(ROOT_CAUSES[0]);
  const [softMissing, setSoftMissing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [coachingNeeded, setCoachingNeeded] = useState(false);
  const [coachingNotes, setCoachingNotes] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  useEffect(() => {
    if (!open || !initial) return;
    setTicketDate(initial.ticketDate || "");
    setTicketNumber(initial.ticketNumber || "");
    setAgentId(initial.agentId || "");
    setSummary(initial.summaryOfIssue || "");
    setRootCause(initial.rootCause || ROOT_CAUSES[0]);
    setSoftMissing(Boolean(initial.softSkillsMissing));
    setCategories(initial.softSkillsCategories || []);
    setCoachingNeeded(Boolean(initial.coachingNeeded));
    setCoachingNotes(initial.coachingNotes || "");
    setReviewDate(initial.reviewDate || "");
  }, [open, initial]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ticketDate,
        ticketNumber,
        agentId,
        summaryOfIssue: summary,
        rootCause,
        softSkillsMissing: softMissing,
        softSkillsCategories: softMissing ? categories : [],
        coachingNeeded,
        coachingNotes: coachingNeeded ? coachingNotes : "",
        reviewDate,
      };
      if (editId) return api(`/api/negative-reviews/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
      return api("/api/negative-reviews", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success(editId ? "Review updated" : "Review created");
      onOpenChange(false);
      void client.invalidateQueries({ queryKey: ["nr-list"] });
      void client.invalidateQueries({ queryKey: ["nr-dashboard"] });
      void client.invalidateQueries({ queryKey: ["nr-detail"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleCategory(cat: string) {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit negative review" : "Add negative review"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ticket Date</Label>
              <Input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} required />
            </div>
            <div>
              <Label>Review Date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Ticket Number</Label>
            <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} required />
          </div>
          <div>
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.data?.agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Summary of Issue</Label>
            <Textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Briefly summarize the customer's issue and what happened."
              required
            />
          </div>
          <div>
            <Label>Root Cause of DSAT</Label>
            <Select value={rootCause} onValueChange={setRootCause}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOT_CAUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Soft Skills Missing?</Label>
            <Select
              value={softMissing ? "yes" : "no"}
              onValueChange={(v) => {
                const yes = v === "yes";
                setSoftMissing(yes);
                if (!yes) setCategories([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {softMissing ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <Label>Soft Skills Category</Label>
              {SOFT_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={categories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="rounded border-slate-300"
                  />
                  {cat}
                </label>
              ))}
            </div>
          ) : null}
          <div>
            <Label>Coaching Needed?</Label>
            <Select value={coachingNeeded ? "yes" : "no"} onValueChange={(v) => setCoachingNeeded(v === "yes")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coachingNeeded ? (
            <div>
              <Label>Coaching Notes</Label>
              <Textarea
                rows={4}
                value={coachingNotes}
                onChange={(e) => setCoachingNotes(e.target.value)}
                placeholder="What was discussed and what should the Agent improve?"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["nr-detail", id],
    queryFn: () =>
      api<{ item: ReviewRow; activity: { id: string; summary: string; actorName: string; createdAt: string }[] }>(
        `/api/negative-reviews/${id}`,
      ),
    enabled: Boolean(id),
  });

  const coachingDone = useMutation({
    mutationFn: () => api(`/api/negative-reviews/${id}/coaching-done`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Coaching marked done");
      void client.invalidateQueries({ queryKey: ["nr-detail", id] });
      void client.invalidateQueries({ queryKey: ["nr-list"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const acknowledge = useMutation({
    mutationFn: () => api(`/api/negative-reviews/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Coaching acknowledged");
      void client.invalidateQueries({ queryKey: ["nr-detail", id] });
      void client.invalidateQueries({ queryKey: ["nr-list"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const item = detail.data?.item;
  const activity = detail.data?.activity ?? [];

  return (
    <>
      <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail.isLoading || !item ? (
            <LoadingBlock />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Ticket #{item.ticketNumber}</DialogTitle>
                <DialogDescription>
                  {item.agentName} · Review {item.reviewDate}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 text-sm">
                <DetailSection title="Ticket">
                  <p className="text-muted-foreground">Date: {item.ticketDate}</p>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">{item.summaryOfIssue}</p>
                </DetailSection>
                <DetailSection title="Review">
                  <p>Root cause: {item.rootCause}</p>
                  <p className="mt-1">Soft skills missing: {item.softSkillsMissing ? "Yes" : "No"}</p>
                  {item.softSkillsCategories.length ? (
                    <p className="mt-1">Categories: {item.softSkillsCategories.join(", ")}</p>
                  ) : null}
                </DetailSection>
                <DetailSection title="Coaching">
                  <p>Needed: {item.coachingNeeded ? "Yes" : "No"}</p>
                  <p className="mt-1 flex items-center gap-2">
                    Status: <StatusPill value={item.coachingStatus} />
                  </p>
                  {item.coachingNotes ? (
                    <div className="mt-2 rounded-lg bg-muted/50 p-3 whitespace-pre-wrap leading-relaxed">{item.coachingNotes}</div>
                  ) : null}
                </DetailSection>
                <DetailSection title="Agent">
                  <p>Acknowledged: {item.acknowledgedByAgent ? "Yes" : "No"}</p>
                </DetailSection>
                <DetailSection title="Activity">
                  <ActivityTimeline entries={activity} />
                </DetailSection>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <div className="flex flex-wrap gap-2">
                  {item.actions?.edit && canMutate("negative_reviews.manage") && !readOnly ? (
                    <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                  ) : null}
                  {item.actions?.markCoachingDone && !readOnly ? (
                    <Button type="button" onClick={() => coachingDone.mutate()} disabled={coachingDone.isPending}>
                      Mark Coaching Done
                    </Button>
                  ) : null}
                  {item.actions?.acknowledge && !readOnly ? (
                    <Button type="button" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                      Acknowledge Coaching
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {item && editOpen ? (
        <ReviewFormDialog open={editOpen} onOpenChange={setEditOpen} editId={item.id} initial={item} />
      ) : null}
    </>
  );
}
