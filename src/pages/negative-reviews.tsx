import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { Empty, ErrorBlock, LoadingBlock, StatusBadge, FilterToolbar, ModuleSubnav, PageHeader, ActivityTimeline } from "@/components/bits";
import { TruncatedHoverField } from "@/components/truncated-hover-field";
import { MetricCard } from "@/components/design/metric-card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { moduleIndexSegment } from "@/lib/module-nav";

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
  linkedCoaching?: { id: string; status: string; href: string } | null;
  actions?: { edit: boolean; markCoachingDone: boolean; acknowledge: boolean };
};

type NrLayoutContext = {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
};

const NrLayoutContext = createContext<NrLayoutContext | null>(null);

export function useNrDashboardToolbar() {
  const ctx = useContext(NrLayoutContext);
  if (!ctx) throw new Error("useNrDashboardToolbar must be used within NrLayout");
  return ctx;
}

function NrLayout() {
  const { can, canMutate } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname.includes("/negative-reviews/dashboard");
  const isTracker = location.pathname.includes("/negative-reviews/tracker");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const links = [
    { to: "/negative-reviews/dashboard", label: "Dashboard", any: ["negative_reviews.dashboard"] },
    { to: "/negative-reviews/tracker", label: "Tracker", any: ["negative_reviews.tracker"] },
  ].filter((l) => can(...l.any));
  const toolbar = { dateFrom, dateTo, setDateFrom, setDateTo, addOpen, setAddOpen };
  return (
    <NrLayoutContext.Provider value={toolbar}>
      <div className="space-y-2">
        <PageHeader
          eyebrow="Quality & performance"
          title="Negative Reviews"
          description="DSAT reviews, coaching follow-up, and agent acknowledgement."
        />
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-3">
          <ModuleSubnav
            links={links.map((l) => ({ to: l.to, label: l.label }))}
            className="mb-0 shrink-0 border-0 pb-0"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isDashboard ? (
              <>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-auto min-w-[9.5rem] bg-card"
                  aria-label="From date"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-auto min-w-[9.5rem] bg-card"
                  aria-label="To date"
                />
              </>
            ) : null}
            {(isDashboard || isTracker) && canMutate("negative_reviews.manage") ? (
              <Button type="button" onClick={() => setAddOpen(true)}>
                Add negative review
              </Button>
            ) : null}
          </div>
        </div>
        <Outlet />
        {isDashboard || isTracker ? <ReviewFormDialog open={addOpen} onOpenChange={setAddOpen} /> : null}
      </div>
    </NrLayoutContext.Provider>
  );
}

function StatusPill({ value }: { value: string }) {
  return <StatusBadge value={value} />;
}

function NegativeReviewsIndex() {
  const { can } = useAuth();
  const segment = moduleIndexSegment(can, "negative_reviews.dashboard", "negative_reviews.tracker");
  return <Navigate to={segment} replace />;
}

export function NegativeReviewsRoutes() {
  return (
    <Routes>
      <Route element={<NrLayout />}>
        <Route path="dashboard" element={<NrDashboardPage />} />
        <Route path="tracker" element={<NrTrackerPage />} />
        <Route path="daily-dsat" element={<NrDailyDsatPage />} />
        <Route index element={<NegativeReviewsIndex />} />
      </Route>
    </Routes>
  );
}

type DsatDailyCheckRow = {
  id: string;
  userId: string;
  dateIst: string;
  completedAt: string;
  outcome: "dsat_found" | "no_dsat_found";
  note: string;
};

export function NrDailyDsatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dateIst = searchParams.get("date") ?? "";
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateIst);
  const [outcome, setOutcome] = useState<"" | "dsat_found" | "no_dsat_found">("");
  const [note, setNote] = useState("");

  const checks = useQuery({
    queryKey: ["dsat-daily-checks", dateIst],
    enabled: validDate,
    queryFn: () =>
      api<{ checks: DsatDailyCheckRow[] }>(
        `/api/dsat/daily-checks?dateFrom=${encodeURIComponent(dateIst)}&dateTo=${encodeURIComponent(dateIst)}`,
      ),
  });

  const existing = checks.data?.checks.find((c) => c.dateIst === dateIst) ?? null;

  const submit = useMutation({
    mutationFn: () =>
      api<{ check: DsatDailyCheckRow }>("/api/dsat/daily-checks", {
        method: "POST",
        body: JSON.stringify({
          dateIst,
          outcome,
          note: note.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Daily DSAT review recorded");
      void queryClient.invalidateQueries({ queryKey: ["dsat-daily-checks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!validDate) {
    return <ErrorBlock message="Open this page from your Daily DSAT Check task or add a valid ?date=YYYY-MM-DD." />;
  }
  if (checks.isLoading) return <LoadingBlock />;
  if (checks.isError) return <ErrorBlock message={checks.error.message} />;

  const formatted = new Date(`${dateIst}T12:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (existing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily DSAT Check — {formatted}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This review was completed on{" "}
            {new Date(existing.completedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.
          </p>
          <p>
            Outcome:{" "}
            <span className="font-medium text-foreground">
              {existing.outcome === "no_dsat_found" ? "Checked Freshdesk — No DSAT Found" : "DSAT found"}
            </span>
          </p>
          {existing.note ? <p>Note: {existing.note}</p> : null}
          <Button type="button" variant="outline" onClick={() => navigate("/negative-reviews/tracker")}>
            Open Negative Reviews tracker
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily DSAT Check — {formatted}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Confirm you reviewed Freshdesk for negative and neutral customer satisfaction responses for this date (IST).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Outcome</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant={outcome === "dsat_found" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setOutcome("dsat_found")}
            >
              DSAT found
            </Button>
            <Button
              type="button"
              variant={outcome === "no_dsat_found" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setOutcome("no_dsat_found")}
            >
              Checked Freshdesk — No DSAT Found
            </Button>
          </div>
          {outcome === "dsat_found" ? (
            <p className="text-sm text-muted-foreground">
              Investigate responses and record cases in the{" "}
              <Link to="/negative-reviews/tracker" className="text-primary underline-offset-4 hover:underline">
                Negative Reviews tracker
              </Link>{" "}
              before confirming.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dsat-note">Notes (optional)</Label>
          <Textarea id="dsat-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!outcome || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Confirm completion
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>
            Back to dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NrDashboardPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const hasDashboard = can("negative_reviews.dashboard");
  const { dateFrom, dateTo } = useNrDashboardToolbar();
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const dash = useQuery({
    queryKey: ["nr-dashboard", dateFrom, dateTo],
    enabled: hasDashboard,
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

  if (!hasDashboard) return <Navigate to="/negative-reviews/tracker" replace />;
  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const { cards, trends } = dash.data!;

  const filterLink = (query: Record<string, string>) => {
    const p = new URLSearchParams(query);
    navigate(`/negative-reviews/tracker?${p.toString()}`);
  };

  return (
    <div className="space-y-6">
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
    </div>
  );
}

function CardButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <MetricCard label={label} value={value} interactive onClick={onClick} tone={value > 0 && label.includes("Pending") ? "warning" : "default"} />
  );
}

export function NrTrackerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("id"));
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
      />
      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {!list.isLoading && !list.isError && list.data?.items.length === 0 ? (
        <Empty title="No negative reviews in this view." body="Adjust filters or add a review if you manage this tracker." />
      ) : null}
      {!list.isLoading && list.data && list.data.items.length > 0 ? (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-border bg-muted/20 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Ticket date</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Ticket #</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Agent</th>
              <th className="min-w-[10rem] max-w-[14rem] px-3 py-3 font-medium">Summary</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Root cause</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Soft skills</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Coaching</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Status</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Ack</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Review date</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.ticketDate}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    onClick={() => setDetailId(row.id)}
                  >
                    {row.ticketNumber}
                  </button>
                </td>
                <td className="max-w-[10rem] truncate px-3 py-3 whitespace-nowrap">{row.agentName}</td>
                <td className="px-3 py-3">
                  <TruncatedHoverField
                    variant="inline"
                    value={row.summaryPreview || row.summaryOfIssue || ""}
                    popoverTitle="Summary"
                    valueClassName="font-normal text-muted-foreground"
                    className="max-w-[14rem]"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{row.rootCause}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.softSkillsMissing ? "Yes" : "No"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.coachingNeeded ? "Yes" : "No"}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <StatusPill value={row.coachingStatus} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{row.acknowledgedByAgent ? "Yes" : "No"}</td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{row.reviewDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
      {list.data && list.data.total > list.data.pageSize ? (
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
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
    if (!open) return;
    if (initial) {
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
      return;
    }
    setTicketDate("");
    setTicketNumber("");
    setAgentId("");
    setSummary("");
    setRootCause(ROOT_CAUSES[0]);
    setSoftMissing(false);
    setCategories([]);
    setCoachingNeeded(false);
    setCoachingNotes("");
    setReviewDate("");
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

  const fieldLabel = "text-xs font-medium text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-5 pb-2 text-left">
          <DialogTitle>{editId ? "Edit negative review" : "Add negative review"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(70vh,34rem)] space-y-4 overflow-y-auto px-6 pb-6 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Ticket date</Label>
              <Input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Review date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Ticket number</Label>
            <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} required autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Summary of issue</Label>
            <Textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Briefly summarize the customer's issue and what happened."
              required
              className="min-h-[4.5rem] resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Root cause of DSAT</Label>
            <Select value={rootCause} onValueChange={setRootCause}>
              <SelectTrigger className="w-full">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Soft skills missing?</Label>
              <Select
                value={softMissing ? "yes" : "no"}
                onValueChange={(v) => {
                  const yes = v === "yes";
                  setSoftMissing(yes);
                  if (!yes) setCategories([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Coaching needed?</Label>
              <Select value={coachingNeeded ? "yes" : "no"} onValueChange={(v) => setCoachingNeeded(v === "yes")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {softMissing ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <Label className={fieldLabel}>Soft skills category</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {SOFT_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="rounded border-border"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {coachingNeeded ? (
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Coaching notes</Label>
              <Textarea
                rows={3}
                value={coachingNotes}
                onChange={(e) => setCoachingNotes(e.target.value)}
                placeholder="What was discussed and what should the agent improve?"
                className="min-h-[4.5rem] resize-y"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="!mx-0 !mb-0 !flex-row items-center justify-end gap-2 border-t bg-muted/50 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {detail.isLoading || !item ? (
            <div className="p-8">
              <LoadingBlock />
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl tracking-tight">Ticket #{item.ticketNumber}</DialogTitle>
                  <DialogDescription className="mt-1 text-sm">
                    {item.agentName} · Review {item.reviewDate}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Details</h3>
                  <dl className="divide-y divide-border/60 rounded-xl border border-border bg-muted/40/50">
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Ticket date</dt>
                      <dd className="text-sm font-medium text-foreground">{item.ticketDate}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Agent</dt>
                      <dd className="text-sm font-medium text-foreground">{item.agentName}</dd>
                    </div>
                    <TruncatedHoverField
                      variant="detail"
                      label="Summary"
                      popoverTitle="Summary"
                      value={item.summaryOfIssue}
                    />
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Root cause</dt>
                      <dd className="text-sm font-medium text-foreground">{item.rootCause}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Soft skills missing</dt>
                      <dd className="text-sm font-medium text-foreground">{item.softSkillsMissing ? "Yes" : "No"}</dd>
                    </div>
                    {item.softSkillsCategories.length ? (
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <dt className="shrink-0 text-sm text-muted-foreground">Categories</dt>
                        <dd className="text-right text-sm font-medium text-foreground">
                          {item.softSkillsCategories.join(", ")}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Coaching needed</dt>
                      <dd className="text-sm font-medium text-foreground">{item.coachingNeeded ? "Yes" : "No"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="shrink-0 text-sm text-muted-foreground">Coaching status</dt>
                      <dd className="m-0 shrink-0 text-right">
                        {item.linkedCoaching ? (
                          <Link className="text-sm font-medium text-primary hover:underline" to={item.linkedCoaching.href}>
                            {item.linkedCoaching.status} →
                          </Link>
                        ) : (
                          <StatusPill value={item.coachingStatus} />
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Acknowledged</dt>
                      <dd className="text-sm font-medium text-foreground">{item.acknowledgedByAgent ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                </section>
                <section className="flex min-h-0 flex-col">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <div className="mt-4 max-h-[min(22rem,50vh)] flex-1 overflow-y-auto pr-1">
                    <ActivityTimeline entries={activity} />
                  </div>
                </section>
              </div>
              <DialogFooter className="!mx-0 !mb-0 !flex-row flex-nowrap items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.actions?.edit && canMutate("negative_reviews.manage") && !readOnly ? (
                    <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                  ) : null}
                  {item.actions?.markCoachingDone && !readOnly ? (
                    <Button type="button" onClick={() => coachingDone.mutate()} disabled={coachingDone.isPending}>
                      Mark coaching done
                    </Button>
                  ) : null}
                  {item.actions?.acknowledge && !readOnly ? (
                    <Button type="button" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                      Acknowledge coaching
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
